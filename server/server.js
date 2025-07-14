import express from 'express';
import path from 'path';
import cors from 'cors';
import pg from 'pg';
import bcrypt from "bcrypt";
import { Server } from "socket.io";
import http from "http";
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from "dotenv";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
// Importing the pg module for PostgreSQL
const { Pool } = pg;
const app = express();

const pool = new Pool({
  user: process.env.db_user,
  host: process.env.db_host,
  database: process.env.db_name,
  password: process.env.db_pass,
  port: process.env.db_port,
});



let staticDir = '../chat-app/build';
let indexPath = path.join(__dirname, staticDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  staticDir = '../chat-app/public';
  indexPath = path.join(__dirname, staticDir, 'index.html');
}
app.use(express.static(path.join(__dirname, staticDir)));

pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Connection error', err.stack));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
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

  // Track active chats
  socket.on("open_chat", ({ userId, withUserId }) => {
    activeChats[userId] = withUserId;
    console.log(`User ${userId} opened chat with ${withUserId}`);
  });

  // Listen for sending messages
  socket.on("send_message", async ({ from, to, message }) => {
    try {
      // Store message in database
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message_text)
         VALUES ($1, $2, $3) RETURNING *`,
        [from, to, message]
      );

      console.log("Message saved:", result.rows[0]);

      // Update conversation for receiver (increment unread) - moved up
      await pool.query(`
        INSERT INTO user_conversations 
        (user_id, connected_id, last_message, last_message_timestamp, unread_count)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (user_id, connected_id)
        DO UPDATE SET 
        last_message = $3,
        last_message_timestamp = $4,
        unread_count = user_conversations.unread_count + 1`,
        [to, from, message, result.rows[0].sent_at]
      );

      // Emit to receiver if online
      const receiverSocketId = users[to];
      if (receiverSocketId) {
        // Emit receive_on_Sidebar first to ensure sidebar update
        io.to(receiverSocketId).emit("receive_on_Sidebar", {
          from,
          message
        });

        // Then emit receive_message if active chat condition is met
        if (activeChats[to] === from) {
          io.to(receiverSocketId).emit("receive_message", {
            from,
            message,
            sent_at: result.rows[0].sent_at
          });
        }
      }

      // Also send back to sender for their own UI
      const senderSocketId = users[from];
      if (senderSocketId) {
        io.to(senderSocketId).emit("message_sent", {
          to,
          message,
          sent_at: result.rows[0].sent_at
        });
      }

      // Update conversation for sender (unread_count = 0)
      await pool.query(`
        INSERT INTO user_conversations 
        (user_id, connected_id, last_message, last_message_timestamp, unread_count)
        VALUES ($1, $2, $3, $4, 0)
        ON CONFLICT (user_id, connected_id)
        DO UPDATE SET 
        last_message = $3,
        last_message_timestamp = $4,
        unread_count = 0`,
        [from, to, message, result.rows[0].sent_at]
      );
      
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  // Add this new event to fetch user conversations
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

  // Add this new event to fetch message history
  socket.on("get_message_history", async ({ userId, otherUserId }) => {
    try {
      const result = await pool.query(
        `SELECT * FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY sent_at`,
        [userId, otherUserId]
      );
      socket.emit("message_history", result.rows);
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
        const isMatch = await bcrypt.compare(password, user.pass);
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
        'INSERT INTO authenticate (email, pass) VALUES ($1, $2) RETURNING id',
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
        return res.json({ message: "User exists", id: result.rows[0].id });
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