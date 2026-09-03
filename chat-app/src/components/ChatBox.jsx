import React, { useState, useEffect, useRef, useCallback } from "react";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonIcon from "@mui/icons-material/Person";
import SentMessage from "./SentMsg";
import Received from "./ReceiveMsg";
import Sidebar from "./Sidebar";
import "./chatbox.css";
import { io } from "socket.io-client";

function getInitials(name) {
  if (!name) return "?";
  const clean = name.split("@")[0].trim();
  return clean.substring(0, 2).toUpperCase();
}

function ChatBox(props) {
  const [receiver, setReceiver] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const [sidebarHighlight, setSidebarHighlight] = useState({ from: null, message: null });

  const loadMessageHistory = useCallback((otherUserId) => {
    if (!otherUserId || !props.userId || !socketRef.current) return;

    socketRef.current.emit("get_message_history", {
      userId: props.userId,
      otherUserId: otherUserId,
    });

    socketRef.current.once("message_history", (history) => {
      const formattedMessages = (history || []).map((msg) => ({
        ...msg,
        isReceived: msg.receiver_id === props.userId,
      }));
      setMessages(formattedMessages);
    });
  }, [props.userId]);

  useEffect(() => {
    socketRef.current = io("http://localhost:5000");

    if (props.userId) {
      socketRef.current.emit("register", props.userId);
    }

    socketRef.current.on("chat_session_established", ({ otherUserId, initiatedBy }) => {
      if (props.userId === otherUserId) {
        setReceiver(initiatedBy);
        loadMessageHistory(initiatedBy);
      }
    });

    socketRef.current.on("receive_message", (data) => {
      setReceiver((currentReceiver) => {
        if (!currentReceiver || currentReceiver !== data.from) {
          loadMessageHistory(data.from);
          return data.from;
        } else {
          setMessages((prev) => [
            ...prev,
            {
              sender_id: data.from,
              message_text: data.message,
              sent_at: data.sent_at,
              isReceived: true,
            },
          ]);
          return currentReceiver;
        }
      });
    });

    socketRef.current.on("receive_on_Sidebar", (data) => {
      setSidebarHighlight({
        from: data.from,
        message: data.message,
      });
    });

    socketRef.current.on("message_sent", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          receiver_id: data.to,
          message_text: data.message,
          sent_at: data.sent_at,
          isReceived: false,
        },
      ]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [props.userId, loadMessageHistory]);

  useEffect(() => {
    if (receiver && props.userId) {
      loadMessageHistory(receiver);
    }
  }, [receiver, props.userId, loadMessageHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkExistance = async (input) => {
    try {
      const response = await fetch("/checkExistance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();
      if (response.ok && data.message === "User exists") {
        if (socketRef.current) {
          socketRef.current.emit("start_chat_session", {
            userId: props.userId,
            otherUserId: input,
          });
        }
        setReceiver(input);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false;
    }
  };

  const handleSelectChat = (connectedId, connectedEmail) => {
    setReceiver(connectedId);
    setReceiverEmail(connectedEmail || "");
    if (socketRef.current) {
      socketRef.current.emit("start_chat_session", {
        userId: props.userId,
        otherUserId: connectedId,
      });
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !receiver || !props.userId) return;

    if (socketRef.current) {
      socketRef.current.emit("send_message", {
        from: props.userId,
        to: receiver,
        message: messageInput.trim(),
      });
    }

    setMessageInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isChatOpen = Boolean(receiver);

  return (
    <div className={`chatboxContainer ${isChatOpen ? "mobileChatActive" : "mobileSidebarActive"}`}>
      {/* Sidebar Section */}
      <div className="sidebarSection">
        <Sidebar
          userId={props.userId}
          activeChat={receiver}
          onSelectChat={handleSelectChat}
          checkExistance={checkExistance}
          sidebarHighlight={sidebarHighlight}
        />
      </div>

      {/* Main Chat Area Section */}
      <main className="chatSection">
        {receiver ? (
          <div className="activeChatWrapper">
            {/* Chat Top Header */}
            <header className="chatHeaderBar">
              <button
                className="mobileBackBtn"
                onClick={() => setReceiver("")}
                title="Back to conversation list"
              >
                <ArrowBackIcon sx={{ fontSize: 22 }} />
              </button>

              <div className="chatRecipientAvatar">
                <span>{getInitials(receiverEmail || receiver)}</span>
              </div>

              <div className="chatRecipientMeta">
                <span className="chatRecipientTitle">
                  {receiverEmail || `User ${receiver.substring(0, 8)}...`}
                </span>
                <span className="chatRecipientSubtitle">
                  ID: {receiver.substring(0, 13)}...
                </span>
              </div>
            </header>

            {/* Scrollable Message Box */}
            <div className="msgBox">
              {messages.length === 0 ? (
                <div className="emptyChatPlaceholder">
                  <p>No messages yet. Send a message to start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) =>
                  msg.isReceived ? (
                    <Received
                      key={msg.msg_id || index}
                      message={msg.message_text}
                      sentAt={msg.sent_at}
                    />
                  ) : (
                    <SentMessage
                      key={msg.msg_id || index}
                      message={msg.message_text}
                      sentAt={msg.sent_at}
                    />
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="msgInputBar">
              <textarea
                className="msgInput"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                autoFocus
              />
              <button
                className="sendBtn"
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                title="Send message (Enter)"
              >
                <SendRoundedIcon sx={{ fontSize: 20 }} />
              </button>
            </div>
          </div>
        ) : (
          /* Empty Chat Area / Splash Placeholder */
          <div className="chatEmptySplash">
            <div className="splashContent">
              <div className="splashIconCircle">
                <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: "var(--accent-emerald)" }} />
              </div>
              <h2>WhatsApp Web</h2>
              <p>
                Send and receive messages instantly with end-to-end real-time delivery.
                Select a conversation from the sidebar or start a new chat using a User ID.
              </p>
              <div className="splashTip">
                <PersonIcon sx={{ fontSize: 16, marginRight: "6px" }} />
                <span>Click the profile icon in the sidebar to copy your unique ID</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ChatBox;
