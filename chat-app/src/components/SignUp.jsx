import React, { useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ChatIcon from "@mui/icons-material/Chat";
import { Link, useNavigate } from "react-router-dom";
import "./chatbox.css";

function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const response = await fetch("/signup", {
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

      if (response.ok && data.message === "Signup successful!") {
        setSuccessMessage("Account created successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else if (data.message === "User already exists") {
        setErrorMessage("An account with this email already exists.");
      } else {
        setErrorMessage(data.message || "Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup failed:", error);
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
          <h2>Create an Account</h2>
          <p className="authSubtext">Get started with free and instant messaging</p>
        </div>

        {errorMessage && (
          <div className="authAlert authAlertError">
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="authAlert authAlertSuccess">
            <span>{successMessage}</span>
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
                placeholder="Choose a secure password"
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          <div className="authFooter">
            <span>Already have an account?</span>
            <Link className="authLink" to="/login">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUpPage;
