import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../services/authApi";
import { getToken, setToken, registerUnauthorizedHandler } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);
const USER_KEY = "ridesync_user";

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The single source of truth for "who is logged in" across the whole app.
// Holds the user + token, persists both to localStorage so a page refresh
// doesn't lose the session, and owns the Socket.IO connection's lifecycle —
// connecting once a token exists, disconnecting on logout — so no page has
// to remember to do either itself.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setTokenState] = useState(getToken);
  const [initializing, setInitializing] = useState(true);

  const persistSession = useCallback((nextUser, nextToken) => {
    setUser(nextUser);
    setTokenState(nextToken);
    setToken(nextToken);
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    persistSession(null, null);
  }, [persistSession]);

  // api.js calls this whenever any request comes back 401 (expired/invalid
  // token) — centralizing the reaction here means every page automatically
  // gets "kicked back to a logged-out state" without individually checking
  // for 401 themselves.
  useEffect(() => {
    registerUnauthorizedHandler(logout);
  }, [logout]);

  // Reconnect the socket once on initial load if a session was already
  // persisted (page refresh) — subsequent logins connect explicitly in
  // login()/register() below.
  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
    setInitializing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (credentials) => {
      const res = await authApi.login(credentials);
      const { user: loggedInUser, token: newToken } = res.data.data;
      persistSession(loggedInUser, newToken);
      connectSocket(newToken);
      return loggedInUser;
    },
    [persistSession]
  );

  const register = useCallback(
    async (fields) => {
      const res = await authApi.register(fields);
      const { user: newUser, token: newToken } = res.data.data;
      persistSession(newUser, newToken);
      connectSocket(newToken);
      return newUser;
    },
    [persistSession]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      initializing,
      login,
      register,
      logout,
    }),
    [user, token, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
