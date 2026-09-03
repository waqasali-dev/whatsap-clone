import React, { useState, useEffect, useRef } from "react";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";
import { io } from "socket.io-client";

function formatConversationTime(timestamp) {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}

function getInitials(name) {
  if (!name) return "?";
  const clean = name.split("@")[0].trim();
  return clean.substring(0, 2).toUpperCase();
}

function Sidebar(props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showIdModal, setShowIdModal] = useState(false);
  const [showFindUserModal, setShowFindUserModal] = useState(false);
  const [findInput, setFindInput] = useState("");
  const [findError, setFindError] = useState("");
  const [copied, setCopied] = useState(false);
  const [conversations, setConversations] = useState([]);
  const socketRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    socketRef.current = io("http://localhost:5000");
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Update conversation list if sidebarHighlight triggers
  useEffect(() => {
    if (!props.sidebarHighlight || !props.sidebarHighlight.from) return;
    const highlightId = props.sidebarHighlight.from;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.connected_id === highlightId) {
          return {
            ...c,
            last_message: props.sidebarHighlight.message || c.last_message,
            receivedMsg: true,
            unread_count: (c.unread_count || 0) + 1,
          };
        }
        return c;
      })
    );
  }, [props.sidebarHighlight]);

  // Fetch conversations
  useEffect(() => {
    if (props.userId && socketRef.current) {
      socketRef.current.emit("get_user_conversations", { userId: props.userId });

      socketRef.current.on("user_conversations", (response) => {
        const updated = response.map((c) => ({
          ...c,
          receivedMsg: c.unread_count > 0,
        }));
        setConversations(updated);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("user_conversations");
      }
    };
  }, [props.userId]);

  const handleCopyId = () => {
    if (!props.userId) return;
    navigator.clipboard.writeText(props.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    navigate("/login");
  };

  const handleFindUserSubmit = async (e) => {
    e.preventDefault();
    setFindError("");
    const targetId = findInput.trim();

    if (!targetId) {
      setFindError("Please enter a user ID.");
      return;
    }
    if (targetId === props.userId) {
      setFindError("You cannot chat with yourself.");
      return;
    }

    try {
      const success = await props.checkExistance(targetId);
      if (success !== false) {
        setShowFindUserModal(false);
        setFindInput("");
      } else {
        setFindError("User not found with this ID.");
      }
    } catch (err) {
      setFindError("Error verifying user ID.");
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const email = (c.connected_email || "").toLowerCase();
    const id = (c.connected_id || "").toLowerCase();
    const msg = (c.last_message || "").toLowerCase();
    return email.includes(q) || id.includes(q) || msg.includes(q);
  });

  return (
    <aside className="sidebarRoot">
      {/* Sidebar Header */}
      <div className="sidebarHeader">
        <div className="userProfileSummary">
          <div className="userAvatarBadge">
            <PersonIcon sx={{ fontSize: 22, color: "#fff" }} />
          </div>
          <div className="userHeaderDetails">
            <span className="userHeaderLabel">My Account</span>
          </div>
        </div>

        <div className="sidebarActions">
          <button
            className="iconBtn"
            title="View & Copy My User ID"
            onClick={() => setShowIdModal(true)}
          >
            <PersonIcon sx={{ fontSize: 20 }} />
          </button>
          <button
            className="iconBtn"
            title="Start New Chat"
            onClick={() => {
              setFindError("");
              setFindInput("");
              setShowFindUserModal(true);
            }}
          >
            <PersonAddIcon sx={{ fontSize: 20 }} />
          </button>
          <button
            className="iconBtn logoutBtn"
            title="Log Out"
            onClick={handleLogout}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sidebarSearchWrapper">
        <div className="sidebarSearchBox">
          <SearchIcon sx={{ fontSize: 18, color: "var(--text-dim)", marginRight: "8px" }} />
          <input
            type="text"
            className="sidebarSearchInput"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="conversationList">
        {filteredConversations.length === 0 ? (
          <div className="emptyListNotice">
            <p>No conversations found</p>
            <button
              className="newChatPromptBtn"
              onClick={() => setShowFindUserModal(true)}
            >
              Start a new chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = props.activeChat === conv.connected_id;
            const displayName = conv.connected_email || `User ${conv.connected_id.substring(0, 8)}`;
            const initials = getInitials(conv.connected_email || conv.connected_id);
            const timeStr = formatConversationTime(conv.last_message_timestamp);
            const hasUnread = conv.unread_count > 0 || (conv.receivedMsg && !isActive);

            return (
              <div
                key={conv.conversation_id || conv.connected_id}
                className={`conversationItem ${isActive ? "conversationActive" : ""} ${
                  hasUnread ? "hasUnreadNotice" : ""
                }`}
                onClick={() => {
                  props.onSelectChat(conv.connected_id, conv.connected_email);
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.connected_id === conv.connected_id
                        ? { ...c, receivedMsg: false, unread_count: 0 }
                        : c
                    )
                  );
                }}
              >
                <div className="convAvatar">
                  <span>{initials}</span>
                </div>

                <div className="convDetails">
                  <div className="convTopRow">
                    <span className="convName" title={conv.connected_id}>
                      {displayName}
                    </span>
                    {timeStr && <span className="convTime">{timeStr}</span>}
                  </div>

                  <div className="convBottomRow">
                    <p className="convSnippet">
                      {conv.last_message || "Tap to chat"}
                    </p>
                    {hasUnread && (
                      <span className="unreadBadge">
                        {conv.unread_count > 0 ? conv.unread_count : "1"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: View & Copy ID */}
      {showIdModal && (
        <div className="modalOverlay" onClick={() => setShowIdModal(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Your User ID</h3>
              <button className="modalCloseBtn" onClick={() => setShowIdModal(false)}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <p className="modalDescription">
              Share this ID with others so they can start a conversation with you:
            </p>
            <div className="idDisplayBox">
              <code>{props.userId}</code>
              <button
                className={`copyBtn ${copied ? "copyBtnSuccess" : ""}`}
                onClick={handleCopyId}
              >
                {copied ? (
                  <>
                    <CheckIcon sx={{ fontSize: 16, marginRight: "4px" }} /> Copied!
                  </>
                ) : (
                  <>
                    <ContentCopyIcon sx={{ fontSize: 16, marginRight: "4px" }} /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Start New Chat by User ID */}
      {showFindUserModal && (
        <div className="modalOverlay" onClick={() => setShowFindUserModal(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Start a New Chat</h3>
              <button className="modalCloseBtn" onClick={() => setShowFindUserModal(false)}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <p className="modalDescription">
              Enter the recipient's unique User ID (UUID) to start messaging:
            </p>
            {findError && (
              <div className="modalAlert modalAlertError">
                <span>{findError}</span>
              </div>
            )}
            <form onSubmit={handleFindUserSubmit} className="modalForm">
              <input
                type="text"
                className="modalInput"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={findInput}
                onChange={(e) => setFindInput(e.target.value)}
                autoFocus
              />
              <div className="modalBtnRow">
                <button
                  type="button"
                  className="modalBtnSecondary"
                  onClick={() => setShowFindUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modalBtnPrimary">
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;