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

function Received(props) {
  const timeStr = formatTime(props.sentAt || props.time);

  return (
    <div className="msgRow themRow">
      <div className="them">
        <p className="msgText">{props.message}</p>
        <div className="msgMeta">
          {timeStr && <span className="msgTime">{timeStr}</span>}
        </div>
      </div>
    </div>
  );
}

export default Received;
