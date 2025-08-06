import React, { useState } from "react";
import "./styles.css";
import LoginPage from "./LoginPage";
import ChatBox from "./ChatBox";
import SignUpPage from "./SignUp"; // <-- Make sure to import this!
import { Routes, Route } from "react-router-dom";

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem("userId"));
  function handleId(id){
    setUserId(id);
    localStorage.setItem("userId", id);
    console.log("User ID set to:", id);
  }
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LoginPage sendBack={handleId} />} />
        <Route path="/login" element={<LoginPage sendBack={handleId} />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/chatbox" element={<ChatBox userId={userId} />} />
      </Routes>
    </div>
  );
}
