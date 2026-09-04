import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Read connections securely from environment variables
const localConnectionString =
  process.env.LOCAL_DATABASE_URL ||
  (process.env.DB_PASSWORD
    ? `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'whatsapp'}`
    : null);

const localPool = new pg.Pool({
  connectionString: localConnectionString,
  ssl: false
});

const neonPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('1. Adding is_read column to messages table in both local and Neon...');
    await localPool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;');
    await neonPool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;');
    console.log('Added is_read column.');

    console.log('2. Fetching records from local DB...');
    const auth = await localPool.query('SELECT * FROM authenticate');
    const convs = await localPool.query('SELECT * FROM user_conversations');
    const connd = await localPool.query('SELECT * FROM user_connected');
    const msgs = await localPool.query('SELECT * FROM messages');

    console.log(`Found: ${auth.rows.length} users, ${convs.rows.length} conversations, ${msgs.rows.length} messages.`);

    console.log('3. Migrating users to Neon...');
    for (const u of auth.rows) {
      await neonPool.query(
        `INSERT INTO authenticate (id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
        [u.id, u.email, u.password_hash, u.created_at, u.updated_at]
      );
    }

    console.log('4. Migrating conversations to Neon...');
    for (const c of convs.rows) {
      await neonPool.query(
        `INSERT INTO user_conversations (conversation_id, user_id, connected_id, last_message, last_message_timestamp, unread_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, connected_id) DO UPDATE SET
           last_message = EXCLUDED.last_message,
           last_message_timestamp = EXCLUDED.last_message_timestamp,
           unread_count = EXCLUDED.unread_count`,
        [c.conversation_id, c.user_id, c.connected_id, c.last_message, c.last_message_timestamp, c.unread_count]
      );
    }

    console.log('5. Migrating user_connected to Neon...');
    for (const uc of connd.rows) {
      await neonPool.query(
        `INSERT INTO user_connected (user_id, connected_id, last_message)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, connected_id) DO UPDATE SET last_message = EXCLUDED.last_message`,
        [uc.user_id, uc.connected_id, uc.last_message]
      );
    }

    console.log('6. Migrating messages to Neon...');
    for (const m of msgs.rows) {
      await neonPool.query(
        `INSERT INTO messages (msg_id, sender_id, receiver_id, message_text, sent_at, is_read)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (msg_id) DO UPDATE SET is_read = EXCLUDED.is_read`,
        [m.msg_id, m.sender_id, m.receiver_id, m.message_text, m.sent_at, m.is_read || false]
      );
    }

    console.log('7. Verifying Neon database counts...');
    const nAuth = await neonPool.query('SELECT count(*) FROM authenticate');
    const nConvs = await neonPool.query('SELECT count(*) FROM user_conversations');
    const nMsgs = await neonPool.query('SELECT count(*) FROM messages');
    console.log(`Neon counts: Users = ${nAuth.rows[0].count}, Conversations = ${nConvs.rows[0].count}, Messages = ${nMsgs.rows[0].count}`);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await localPool.end();
    await neonPool.end();
  }
}

migrate();
