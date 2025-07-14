import React from "react";
import "./chatbox.css";

function Received(props) {
  return (
    <div className="them">
      <p>
        {props.message}
      </p>
    </div>
  );
}

export default Received;
