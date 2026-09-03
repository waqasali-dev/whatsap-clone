import React from "react";
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

  return (
    <div className="msgRow meRow">
      <div className="me">
        <p className="msgText">{props.message}</p>
        {timeStr && <span className="msgTime">{timeStr}</span>}
      </div>
    </div>
  );
}

export default SentMessage;
