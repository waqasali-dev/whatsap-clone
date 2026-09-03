import React, { useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ChatIcon from "@mui/icons-material/Chat";
import { Link, useNavigate } from "react-router-dom";
import "./chatbox.css";

function LoginPage(props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.message === "Login successful!") {
        if (props.sendBack) {
          props.sendBack(data.id);
        }
        localStorage.setItem("userId", data.id);
        navigate("/chatbox");
      } else {
        setErrorMessage(data.message || "Invalid email or password");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage("Network error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPageWrapper">
      <div className="authCard">
        <div className="authHeader">
          <div className="authLogo">
            <ChatIcon sx={{ fontSize: 36, color: "var(--accent-emerald)" }} />
          </div>
          <h2>Welcome Back</h2>
          <p className="authSubtext">Sign in to continue to your messages</p>
        </div>

        {errorMessage && (
          <div className="authAlert authAlertError">
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="authForm">
          <div className="inputGroup">
            <label className="inputLabel">Email address</label>
            <input
              className="authInput"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="inputGroup">
            <label className="inputLabel">Password</label>
            <div className="passwordFieldWrapper">
              <input
                className="authInput passwordInput"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="passwordToggleBtn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <VisibilityOffIcon sx={{ fontSize: 20, color: "var(--text-muted)" }} />
                ) : (
                  <VisibilityIcon sx={{ fontSize: 20, color: "var(--text-muted)" }} />
                )}
              </button>
            </div>
          </div>

          <button className="authSubmitBtn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="authFooter">
            <span>Don't have an account?</span>
            <Link className="authLink" to="/signup">
              Create one
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
