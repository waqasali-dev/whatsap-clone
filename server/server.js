import express from 'express';
import path from 'path';
import cors from 'cors';
import bcrypt from "bcrypt";
import { Server } from "socket.io";
import http from "http";
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import pool from './db.js';
import redis from './redis.js';
import { bufferMessage, getBufferedMessages, markBufferMessagesAsRead } from './redisBuffer.js';
dotenv.config();

// Get the directory name and file name from the URL
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

let staticDir = '../chat-app/build';
let indexPath = path.join(__dirname, staticDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  staticDir = '../chat-app/public';
  indexPath = path.join(__dirname, staticDir, 'index.html');
}
app.use(express.static(path.join(__dirname, staticDir)));

redis.ping()
  .then(() => console.log('Connected to Upstash Redis'))
  .catch(err => console.error('Redis connection error:', err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For development; restrict in production
    methods: ["GET", "POST"]
  }
});

const users = {};
const activeChats = {};

io.on("connection", (socket) => {
  // Listen for user registration
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  // Track active chats and mark received messages as read
  socket.on("start_chat_session", async (data) => {
    const userId = data.userId;
    const otherUserId = data.otherUserId;
    console.log(`User ${userId} started chat with ${otherUserId}`);
    activeChats[userId] = otherUserId;

    try {
      // 1. Mark unread messages received by this user as read in PostgreSQL
      await pool.query(
        `UPDATE messages SET is_read = TRUE 
         WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
        [otherUserId, userId]
      );

      // 2. Reset unread count for this user in user_conversations
      await pool.query(
        `UPDATE user_conversations SET unread_count = 0 
         WHERE user_id = $1 AND connected_id = $2`,
        [userId, otherUserId]
      );

      // 3. Mark pending messages in Redis buffer as read
      await markBufferMessagesAsRead(userId, otherUserId, userId);

      // 4. Notify sender in real time if online that their messages were read
      const senderSocketId = users[otherUserId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages_read", {
          readerId: userId,
          otherUserId: otherUserId
        });
      }
    } catch (err) {
      console.error("Error marking messages as read on start_chat_session:", err);
    }
  });

  // Dedicated event to mark messages as read
  socket.on("mark_messages_read", async ({ userId, otherUserId }) => {
    if (!userId || !otherUserId) return;
    try {
      await pool.query(
        `UPDATE messages SET is_read = TRUE 
         WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
        [otherUserId, userId]
      );

      await pool.query(
        `UPDATE user_conversations SET unread_count = 0 
         WHERE user_id = $1 AND connected_id = $2`,
        [userId, otherUserId]
      );

      await markBufferMessagesAsRead(userId, otherUserId, userId);

      const senderSocketId = users[otherUserId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages_read", {
          readerId: userId,
          otherUserId: otherUserId
        });
      }
    } catch (err) {
      console.error("Error in mark_messages_read:", err);
    }
  });

  // Listen for sending messages
  socket.on("send_message", async ({ from, to, message }) => {
    try {
      const sent_at = new Date().toISOString();

      // Check if receiver is currently connected to sender in active chat
      const isConnectedInChat = activeChats[to] === from;
      const is_read = isConnectedInChat;

      // Buffer message in Redis with is_read status; flushes to DB if count reaches 5 or after 5s
      await bufferMessage({ from, to, message, sent_at, is_read }, pool);

      // Fetch sender & receiver emails so both clients have full metadata immediately
      const senderUser = await pool.query('SELECT email FROM authenticate WHERE id = $1', [from]);
      const senderEmail = senderUser.rows[0]?.email || "";

      const receiverUser = await pool.query('SELECT email FROM authenticate WHERE id = $1', [to]);
      const receiverEmail = receiverUser.rows[0]?.email || "";

      // Emit to receiver if online
      const receiverSocketId = users[to];
      if (receiverSocketId) {
        // Emit receive_on_Sidebar with full contact metadata and read status
        io.to(receiverSocketId).emit("receive_on_Sidebar", {
          from,
          email: senderEmail,
          message,
          sent_at,
          is_read
        });

        // Emit receive_message if receiver is currently in this active chat
        if (isConnectedInChat) {
          io.to(receiverSocketId).emit("receive_message", {
            from,
            email: senderEmail,
            message,
            sent_at,
            is_read: true
          });
        }
      }

      // Also send back to sender for their own UI with is_read status
      const senderSocketId = users[from];
      if (senderSocketId) {
        io.to(senderSocketId).emit("message_sent", {
          to,
          email: receiverEmail,
          message,
          sent_at,
          is_read
        });
      }

    } catch (err) {
      console.error("Error handling send_message with Redis buffer:", err);
    }
  });

  // Fetch user conversations
  socket.on("get_user_conversations", async ({ userId }) => {
    try {
      const result = await pool.query(
        `SELECT uc.connected_id, uc.last_message, uc.last_message_timestamp, 
        uc.unread_count, a.email AS connected_email
        FROM user_conversations uc
        JOIN authenticate a ON uc.connected_id = a.id
        WHERE uc.user_id = $1
        ORDER BY uc.last_message_timestamp DESC`,
        [userId]
      );
      socket.emit("user_conversations", result.rows);
    } catch (err) {
      console.error("Error fetching user conversations:", err);
    }
  });

  // Fetch message history and mark unread as read
  socket.on("get_message_history", async ({ userId, otherUserId }) => {
    try {
      // Mark messages sent by otherUserId to userId as read
      await pool.query(
        `UPDATE messages SET is_read = TRUE 
         WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
        [otherUserId, userId]
      );

      await pool.query(
        `UPDATE user_conversations SET unread_count = 0 
         WHERE user_id = $1 AND connected_id = $2`,
        [userId, otherUserId]
      );

      await markBufferMessagesAsRead(userId, otherUserId, userId);

      const senderSocketId = users[otherUserId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages_read", {
          readerId: userId,
          otherUserId: otherUserId
        });
      }

      const dbResult = await pool.query(
        `SELECT msg_id, sender_id, receiver_id, message_text, sent_at, is_read 
         FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY sent_at`,
        [userId, otherUserId]
      );

      // Merge messages pending in Redis buffer that haven't flushed to DB yet
      const bufferedMessages = await getBufferedMessages(userId, otherUserId);
      const allMessages = [...dbResult.rows, ...bufferedMessages];
      allMessages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      socket.emit("message_history", allMessages);
    } catch (err) {
      console.error("Error fetching message history:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    for (const [userId, socketId] of Object.entries(users)) {
      if (socketId === socket.id) {
        delete users[userId];
        delete activeChats[userId];
        break;
      }
    }
    console.log(`Socket ${socket.id} disconnected`);
  });
});



app.use(cors());
app.use(express.json());

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    pool.query('SELECT * FROM authenticate WHERE email = $1', [email], async (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
          return res.json({ message: "Login successful!", id: user.id });
        } else {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      } else {
        return res.status(401).json({ message: "Invalid email or password" });
      }
    });
  } else {
    return res.status(400).json({ message: "Email and password are required" });
  }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    // Check if the user already exists
    try {
      const existingUser = await pool.query('SELECT * FROM authenticate WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: "User already exists" });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query(
        'INSERT INTO authenticate (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hashedPassword]
      );
      return res.json({ message: "Signup successful!", id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
  } else {
    return res.status(400).json({ message: "Email and password are required" });
  }
});

app.post('/checkExistance', (req, res) => {
  const receiver = req.body.input;

  if (receiver) {
    pool.query('SELECT * FROM authenticate WHERE id = $1', [receiver], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      if (result.rows.length > 0) {
        return res.json({ message: "User exists", id: result.rows[0].id, email: result.rows[0].email });
      } else {
        return res.status(404).json({ message: "User not found" });
      }
    });
  } else {
    return res.status(400).json({ message: "Receiver ID is required" });
  }
});

// app.get('*', (req, res) => {
//   res.sendFile(indexPath);
// });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
