import React, { useState, useEffect, useRef } from "react";
import SendIcon from "@mui/icons-material/Send";
import SentMessage from "./SentMsg";
import Received from "./ReceiveMsg";
import Sidebar from "./Sidebar";
import "./chatbox.css";
import { io } from "socket.io-client";

function ChatBox(props) {
  // const [inputValue, setInputValue] = useState("");
  const [receiver, setReceiver] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const [sidebarHighlight, setSidebarHighlight] = useState({ from: null, message: null });

  useEffect(() => {
    // Connect to socket.io server
    socketRef.current = io("http://localhost:5000");

    // Register current user
    if (props.userId) {
      socketRef.current.emit("register", props.userId);
    }

    // Listen for incoming messages
    socketRef.current.on("receive_message", (data) => {
      setMessages(prev => [...prev, {
        sender_id: data.from,
        message_text: data.message,
        sent_at: data.sent_at,
        isReceived: true
      }]);
    });

    socketRef.current.on("receive_on_Sidebar", (data) => {
      console.log("New message received from:", data.from, "\nMessage:", data.message);
      if (setSidebarHighlight) {
        setSidebarHighlight({
          from: data.from,
          message: data.message
        });
      }
    });

    // Listen for sent message confirmations
    socketRef.current.on("message_sent", (data) => {
      setMessages(prev => [...prev, {
        receiver_id: data.to,
        message_text: data.message,
        sent_at: data.sent_at,
        isReceived: false
      }]);
    });

    // Clean up on unmount
    return () => {
      socketRef.current.disconnect();
    };
  }, [props.userId]);

  useEffect(() => {
    if (receiver && props.userId) {
      // Fetch message history when receiver changes
      socketRef.current.emit("open_chat", {
        userId: props.userId,
        withUserId: receiver
      });
      // Request message history from server
      socketRef.current.emit("get_message_history", {
        userId: props.userId,
        otherUserId: receiver
      });

      socketRef.current.on("message_history", (history) => {
        const formattedMessages = history.map(msg => ({
          ...msg,
          isReceived: msg.receiver_id === props.userId
        }));
        setMessages(formattedMessages);
      });
    }
  }, [receiver, props.userId]);

  useEffect(() => {
    // Scroll to bottom when messages change
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
      if (data.message === "User exists") {
        alert("User exists, you can start chatting!");
        setReceiver(input);
      } else {
        alert("User does not exist. Please try again.");
      }
    } catch (error) {
      console.error("Error checking user existence:", error);
      alert("An error occurred while checking user existence.");
    }
  }


  const sendMessage = () => {
    if (!messageInput.trim() || !receiver || !props.userId) return;

    socketRef.current.emit("send_message", {
      from: props.userId,
      to: receiver,
      message: messageInput
    });

    setMessageInput("");
  };


  return (
    <div className="chatboxContainer">
      <div className="sidebarContainer">
        <Sidebar checkExistance={checkExistance} userId={props.userId} sidebarHighlight={sidebarHighlight} />
      </div>
      <div className="chatboxWrapper">
        <div className="chatbox">
          <div className="msgBox">
            {messages.map((msg, index) => (
              msg.isReceived ? (
                <Received key={index} message={msg.message_text} />
              ) : (
                <SentMessage key={index} message={msg.message_text} />
              )
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="msgInputBox">
            <textarea
              className="msgInput"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type your message here..."
              rows="1"
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <SendIcon
              sx={{
                alignSelf: "center",
                fontSize: "40px",
                color: "black",
                marginRight: "5px",
                cursor: "pointer"
              }}
              onClick={sendMessage}
            />
          </div>
        </div>
      </div>

    </div>

  );
}

export default ChatBox;