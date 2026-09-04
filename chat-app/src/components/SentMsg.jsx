import React from "react";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import "./chatbox.css";

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

function SentMessage(props) {
  const timeStr = formatTime(props.sentAt || props.time);
  const isRead = !!props.isRead;

  return (
    <div className="msgRow meRow">
      <div className="me">
        <p className="msgText">{props.message}</p>
        <div className="msgMeta">
          {timeStr && <span className="msgTime">{timeStr}</span>}
          <span
            className={`msgStatus ${isRead ? "statusRead" : "statusUnread"}`}
            title={isRead ? "Read" : "Sent"}
          >
            {isRead ? (
              <DoneAllIcon sx={{ fontSize: 16 }} />
            ) : (
              <DoneIcon sx={{ fontSize: 15 }} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SentMessage;
