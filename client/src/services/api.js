import axios from "axios";

// Every backend response (see server/src/middleware/error.middleware.js and
// every controller in server/src/controllers/) follows the same envelope:
// { success, message?, data?, errors? }. Centralizing the axios instance and
// its interceptors here means every call site gets consistent auth-header
// attachment and 401 handling for free, instead of repeating it per request.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const TOKEN_KEY = "ridesync_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A single place to react to "the token is no longer valid" (expired,
// tampered, or the user was deleted server-side — see
// server/src/middleware/auth.middleware.js). Rather than every page
// checking for 401 itself, this clears the stored session and lets
// AuthContext's own listener redirect to /login.
let onUnauthorized = null;
export function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Backend error responses are { success: false, message, errors? }. Network
// failures (backend unreachable, CORS, DNS) never reach that shape at all —
// this normalizes both into one message a UI can always safely display,
// instead of every screen needing its own defensive error.response?.data
// checks.
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message === "Network Error") {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}

export default api;
