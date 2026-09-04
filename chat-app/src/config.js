/**
 * Central configuration referencing environment variables
 * Configured via REACT_APP_BACKEND_URL in .env
 */
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL || "http://localhost:5000"
).replace(/\/+$/, "");
