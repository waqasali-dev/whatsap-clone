import React, { useState } from "react";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import { Link, useNavigate } from "react-router-dom";
import "./chatbox.css";

function LoginPage(porps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passType, setType] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      })
      setEmail("");
      setPassword("");
      console.log("Email:", email);
      console.log("Password:", password);
    
      const data = await response.json();
      
      console.log("Response data:", data.message, data.id? data.id : "");

      if(data.message === "Login successful!") {
        alert("Login successful!");
        porps.sendBack(data.id);
        localStorage.setItem("userId", data.id); 
        navigate("/chatbox");
      } else {
        alert("Invalid email or password");
      }

    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    }
    
  };

  return (
    <div className="loginPanel">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="loginForm">
        <input
          className="emailInput"
          type="email"
          name="email"
          placeholder="Email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="pssdiv">
          <input
            className="passInput"
            type={passType ? "password" : "text"}
            name="password"
            placeholder="Password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div
            onClick={() => {
              passType ? setType(false) : setType(true);
            }}
          >
            <RemoveRedEyeIcon sx={{ marginTop: "5px" }} />
          </div>
        </div>
        <button className="loginButton" type="submit">
          Login
        </button>
        <nav>
          <Link className="SignUp" to="/signup">
            Create account
          </Link>
        </nav>
      </form>
    </div>
  );
}

export default LoginPage;
