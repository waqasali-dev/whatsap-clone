import redis from './redis.js';

const BATCH_SIZE = 5;
const FLUSH_INTERVAL_MS = 5000;

const flushTimers = new Map();
const isFlushing = new Map();

/**
 * Returns a canonical conversation key between two users.
 */
export function getConversationKey(userId1, userId2) {
  return [userId1, userId2].sort().join(':');
}

/**
 * Flushes all buffered messages for a given conversation from Redis into PostgreSQL.
 */
export async function flushMessages(convKey, pool) {
  // Clear any active timer for this conversation
  if (flushTimers.has(convKey)) {
    clearTimeout(flushTimers.get(convKey));
    flushTimers.delete(convKey);
  }

  // Prevent concurrent flushes for the same conversation
  if (isFlushing.get(convKey)) {
    return;
  }
  isFlushing.set(convKey, true);

  const bufferKey = `messages:buffer:${convKey}`;

  try {
    // Atomically retrieve and delete all messages from Redis buffer
    const pipeline = redis.pipeline();
    pipeline.lrange(bufferKey, 0, -1);
    pipeline.del(bufferKey);
    const [rawMessages] = await pipeline.exec();

    if (!rawMessages || rawMessages.length === 0) {
      isFlushing.set(convKey, false);
      return;
    }

    // Parse messages (Upstash Redis might return JSON objects or strings)
    const messages = rawMessages.map((m) =>
      typeof m === 'string' ? JSON.parse(m) : m
    );

    console.log(
      `[Redis Buffer] Flushing ${messages.length} message(s) to PostgreSQL for [${convKey}]`
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bulk insert messages into PostgreSQL with is_read column
      const valueClauses = [];
      const queryParams = [];
      let paramIdx = 1;

      for (const msg of messages) {
        valueClauses.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`
        );
        queryParams.push(
          msg.sender_id,
          msg.receiver_id,
          msg.message_text,
          msg.sent_at,
          msg.is_read || false
        );
        paramIdx += 5;
      }

      await client.query(
        `INSERT INTO messages (sender_id, receiver_id, message_text, sent_at, is_read)
         VALUES ${valueClauses.join(', ')}`,
        queryParams
      );

      // 2. Determine latest message in this batch
      const lastMsg = messages[messages.length - 1];

      // 3. Count unread messages per recipient in this batch
      const unreadCounts = {};
      for (const msg of messages) {
        if (!msg.is_read) {
          unreadCounts[msg.receiver_id] = (unreadCounts[msg.receiver_id] || 0) + 1;
        }
      }

      // Update conversation for each receiver
      for (const [receiverId, unreadCount] of Object.entries(unreadCounts)) {
        const otherUserId =
          receiverId === lastMsg.sender_id
            ? lastMsg.receiver_id
            : lastMsg.sender_id;

        await client.query(
          `INSERT INTO user_conversations 
           (user_id, connected_id, last_message, last_message_timestamp, unread_count)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, connected_id)
           DO UPDATE SET 
             last_message = $3,
             last_message_timestamp = $4,
             unread_count = user_conversations.unread_count + $5`,
          [
            receiverId,
            otherUserId,
            lastMsg.message_text,
            lastMsg.sent_at,
            unreadCount,
          ]
        );
      }

      // If receiver had 0 unread in this batch (e.g. connected in chat), make sure last_message is updated
      if (!unreadCounts[lastMsg.receiver_id]) {
        await client.query(
          `INSERT INTO user_conversations 
           (user_id, connected_id, last_message, last_message_timestamp, unread_count)
           VALUES ($1, $2, $3, $4, 0)
           ON CONFLICT (user_id, connected_id)
           DO UPDATE SET 
             last_message = $3,
             last_message_timestamp = $4`,
          [
            lastMsg.receiver_id,
            lastMsg.sender_id,
            lastMsg.message_text,
            lastMsg.sent_at,
          ]
        );
      }

      // Update sender conversation (unread_count remains 0)
      await client.query(
        `INSERT INTO user_conversations 
         (user_id, connected_id, last_message, last_message_timestamp, unread_count)
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (user_id, connected_id)
         DO UPDATE SET 
           last_message = $3,
           last_message_timestamp = $4,
           unread_count = 0`,
        [
          lastMsg.sender_id,
          lastMsg.receiver_id,
          lastMsg.message_text,
          lastMsg.sent_at,
        ]
      );

      await client.query('COMMIT');
      console.log(
        `[PostgreSQL] Successfully batch-inserted ${messages.length} message(s).`
      );
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL Error] Batch insert failed, rolling back:', dbErr);

      // Re-queue messages into Redis so they are not lost
      for (const msg of messages) {
        await redis.rpush(bufferKey, msg);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[Redis Buffer Error] Error flushing conversation ${convKey}:`, err);
  } finally {
    isFlushing.set(convKey, false);
  }
}

/**
 * Buffers a message in Redis and schedules or triggers a flush to PostgreSQL.
 * Flushes when:
 * 1. Buffer reaches 5 messages between two users.
 * 2. OR 5 seconds elapse since the first buffered message in that conversation.
 */
export async function bufferMessage({ from, to, message, sent_at, is_read = false }, pool) {
  const convKey = getConversationKey(from, to);
  const bufferKey = `messages:buffer:${convKey}`;

  const messageData = {
    sender_id: from,
    receiver_id: to,
    message_text: message,
    sent_at,
    is_read: !!is_read,
  };

  // Push message into Redis list
  await redis.rpush(bufferKey, messageData);
  const currentLength = await redis.llen(bufferKey);

  console.log(
    `[Redis Buffer] Conversation [${convKey}] count: ${currentLength}/${BATCH_SIZE} (is_read: ${!!is_read})`
  );

  // Condition 1: Hit 5 messages between two users -> flush immediately
  if (currentLength >= BATCH_SIZE) {
    console.log(
      `[Redis Buffer] Hit threshold (${BATCH_SIZE}) for [${convKey}]. Triggering immediate flush.`
    );
    await flushMessages(convKey, pool);
  } else {
    // Condition 2: If no timer is currently active for this conversation, start 5s countdown
    if (!flushTimers.has(convKey)) {
      console.log(
        `[Redis Buffer] Started 5-second flush timer for conversation [${convKey}].`
      );
      const timer = setTimeout(async () => {
        console.log(`[Redis Buffer] 5s timeout reached for [${convKey}]. Flushing to DB.`);
        await flushMessages(convKey, pool);
      }, FLUSH_INTERVAL_MS);

      flushTimers.set(convKey, timer);
    }
  }
}

/**
 * Marks unread buffered messages in Redis as read for a given reader.
 */
export async function markBufferMessagesAsRead(userId1, userId2, readerId) {
  try {
    const convKey = getConversationKey(userId1, userId2);
    const bufferKey = `messages:buffer:${convKey}`;
    const raw = await redis.lrange(bufferKey, 0, -1);
    if (!raw || raw.length === 0) return;

    let hasChanges = false;
    const updated = raw.map((m) => {
      const msg = typeof m === 'string' ? JSON.parse(m) : m;
      if (msg.receiver_id === readerId && !msg.is_read) {
        msg.is_read = true;
        hasChanges = true;
      }
      return msg;
    });

    if (hasChanges) {
      const pipeline = redis.pipeline();
      pipeline.del(bufferKey);
      for (const item of updated) {
        pipeline.rpush(bufferKey, item);
      }
      await pipeline.exec();
      console.log(`[Redis Buffer] Marked buffered messages as read for reader [${readerId}]`);
    }
  } catch (err) {
    console.error('[Redis Buffer Error] Failed to mark buffer messages as read:', err);
  }
}

/**
 * Retrieves any pending messages currently stored in Redis for this conversation.
 */
export async function getBufferedMessages(userId1, userId2) {
  try {
    const convKey = getConversationKey(userId1, userId2);
    const bufferKey = `messages:buffer:${convKey}`;
    const raw = await redis.lrange(bufferKey, 0, -1);
    return (raw || []).map((m) =>
      typeof m === 'string' ? JSON.parse(m) : m
    );
  } catch (err) {
    console.error('[Redis Buffer Error] Failed to get buffered messages:', err);
    return [];
  }
}
