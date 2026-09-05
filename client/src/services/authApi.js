import api from "./api";

// Maps 1:1 to server/src/routes/auth.routes.js. Both endpoints return
// { success, message, data: { user, token } } — see
// server/src/controllers/auth.controller.js.
export function register({ name, email, phone, password, role }) {
  return api.post("/auth/register", { name, email, phone, password, role });
}

export function login({ email, password }) {
  return api.post("/auth/login", { email, password });
}
