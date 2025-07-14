import React from "react";
import "./chatbox.css";

function SentMessage(props) {
  return (
    <div className="me">
      <p>
        {props.message}
      </p>
    </div>
  );
}

export default SentMessage;
