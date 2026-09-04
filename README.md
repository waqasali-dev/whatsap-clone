# 💬 WhatsApp Clone - Real-Time Messaging Application

A modern, minimal, and responsive full-stack WhatsApp Web clone built with **React**, **Node.js / Express**, **Socket.IO**, and **PostgreSQL**.

---

## ✨ Features

- **⚡ Real-Time Messaging**: Instant bidirectional communication powered by Socket.IO with real-time delivery and message status.
- **🎨 Sleek Obsidian UI**: Minimal, modern dark theme interface with custom CSS design tokens, smooth micro-interactions, and Google Fonts typography.
- **📱 Responsive Layout**:
  - **Desktop / Tablet (≥ 768px)**: Split-pane layout with persistent sidebar and expansive chat area.
  - **Mobile (< 768px)**: Seamless view transitions between the conversations list and active chat with a dedicated back button.
- **👥 Dynamic Contact Discovery**:
  - Add any user to your contacts list instantly using their unique User ID (UUID).
  - Instant real-time contact creation on the receiver's sidebar upon incoming message (no refresh required).
- **📋 1-Click Copy User ID**: Modal with one-click clipboard copy to share your ID with friends.
- **🔍 Instant Search**: Real-time client-side search filtering conversations by email, user ID, or message text.
- **🟢 Unread Counters & Badges**: Unread message counts and emerald badge indicators on conversation cards.
- **🔒 Secure Authentication**: Email and password authentication with salted `bcrypt` password hashing and UUID user tokens.
- **💾 PostgreSQL Persistence**: Stores all users, messages, and conversation threads in relational PostgreSQL tables with foreign key constraints.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, React Router v7, Material UI Icons, Socket.IO Client, Vanilla CSS |
| **Backend** | Node.js (ES Modules), Express 5, Socket.IO, `pg` (node-postgres), Bcrypt, Dotenv |
| **Database** | PostgreSQL (Neon Cloud / Local) with UUID support & Upstash Redis buffer |

---

## 📁 Repository Structure

```
whatsap-clone/
├── chat-app/                 # Frontend React Application
│   ├── public/               # Static assets & index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.jsx       # Route manager & global state
│   │   │   ├── LoginPage.jsx # Sleek dark authentication screen
│   │   │   ├── SignUp.jsx    # User registration screen
│   │   │   ├── ChatBox.jsx   # Core chat window & messaging engine
│   │   │   ├── Sidebar.jsx   # Contact list, search & ID management
│   │   │   ├── SentMsg.jsx   # Sent message bubble component
│   │   │   ├── ReceiveMsg.jsx# Received message bubble component
│   │   │   ├── chatbox.css   # Chat window & responsive styling
│   │   │   ├── Sidebar.css   # Sidebar & modal styling
│   │   │   └── styles.css    # Global CSS design tokens & reset
│   │   └── index.js          # React entry point
│   ├── querry.db             # PostgreSQL database creation queries
│   └── package.json
│
├── server/                   # Backend Node.js / Express Server
│   ├── server.js             # REST API routes & Socket.IO events
│   ├── db.js                 # PostgreSQL client (Neon Cloud & Local toggle)
│   ├── redis.js              # Upstash Redis client
│   ├── redisBuffer.js        # Message buffering & batch persistence logic
│   ├── .env                  # Database and server environment configuration
│   ├── .env.example          # Environment variables template
│   └── package.json
│
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- **PostgreSQL** (v14 or higher running locally or in cloud)

---

### Step 1: Database Setup
 
You can use either **Neon Cloud PostgreSQL** or a **Local PostgreSQL** instance:
 
- **Neon Cloud PostgreSQL (Recommended)**:
  - Create a database project on [Neon Console](https://neon.tech).
  - Obtain your pooled connection string.
  - Run the schema from [`chat-app/querry.db`](file:///d:/codding/App/whatsap-clone/chat-app/querry.db) in the Neon SQL Editor.

- **Local PostgreSQL**:
  1. Open your PostgreSQL terminal (`psql`) or pgAdmin and create a database:
     ```sql
     CREATE DATABASE whatsapp;
     ```
  2. Execute the schema:
     ```sql
     \c whatsapp
     \i 'd:/codding/App/whatsap-clone/chat-app/querry.db'
     ```

#### Tables Created:
- `authenticate`: Stores registered user accounts with email and bcrypt password hashes.
- `user_conversations`: Tracks conversation summaries, timestamps, and unread counts per user pair.
- `messages`: Records individual message content, sender/receiver UUIDs, and timestamps.
- `user_connected`: Maps established user-to-user chat relationships.

---

### Step 2: Backend Configuration & Startup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Configure `.env` (switch between Neon and Local by commenting/uncommenting):
   ```env
   PORT=5000

   # Neon Cloud Database (Active)
   DATABASE_URL=postgresql://<neon_user>:<neon_password>@<neon_host>.neon.tech/neondb?sslmode=require&channel_binding=require

   # Local PostgreSQL Database (Switch when running locally)
   # DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/whatsapp

   # Upstash Redis
   UPSTASH_REDIS_REST_URL="https://<your-redis-instance>.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="<your_upstash_redis_rest_token>"
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the backend server:
   ```bash
   # Development mode with hot-reloading:
   npm run dev

   # Or standard production start:
   npm start
   ```
   *The server will run on `http://localhost:5000`.*

---

### Step 3: Frontend Setup & Startup

1. Open a new terminal and navigate to the `chat-app` directory:
   ```bash
   cd chat-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```
   *The application will open automatically at `http://localhost:3000`.*

---

## 🔌 API & Socket Events Reference

### REST Endpoints

| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/signup` | Register a new user | `{ email, password }` |
| `POST` | `/login` | Authenticate an existing user | `{ email, password }` |
| `POST` | `/checkExistance` | Verify if a user UUID exists | `{ input: "user_uuid" }` |

### Socket.IO Real-Time Events

| Event Name | Direction | Description | Payload |
| :--- | :--- | :--- | :--- |
| `register` | Client ➔ Server | Binds active socket ID to current user ID | `userId` |
| `start_chat_session` | Client ➔ Server | Informs server of active conversation view | `{ userId, otherUserId }` |
| `send_message` | Client ➔ Server | Sends a message to a recipient | `{ from, to, message }` |
| `receive_message` | Server ➔ Client | Delivers new message to active chat | `{ from, email, message, sent_at }` |
| `receive_on_Sidebar`| Server ➔ Client | Notifies recipient to update/add contact in sidebar | `{ from, email, message, sent_at }` |
| `message_sent` | Server ➔ Client | Confirms message delivery to sender | `{ to, email, message, sent_at }` |
| `get_user_conversations` | Client ➔ Server | Requests conversation list for user | `{ userId }` |
| `user_conversations` | Server ➔ Client | Returns conversation list array | `[ { connected_id, connected_email, last_message, ... } ]` |
| `get_message_history` | Client ➔ Server | Requests chronological chat history | `{ userId, otherUserId }` |
| `message_history` | Server ➔ Client | Returns array of message objects | `[ { msg_id, sender_id, receiver_id, message_text, sent_at } ]` |

---

## 📜 License

This project is licensed under the ISC License.