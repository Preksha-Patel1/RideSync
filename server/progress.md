# Progress

## Day 1 — Foundation (COMPLETE)

### Implemented
- Express app (`src/app.js`) + entrypoint (`src/server.js`) with MongoDB connection via Mongoose.
- `.env` / `.env.example` with `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Models: `User` (bcrypt-hashed password, unique email/phone, role enum, password excluded from JSON), `Driver` (status enum, GeoJSON `currentLocation` with 2dsphere index), `Vehicle` (unique registration number), `Ride` (GeoJSON pickup/destination, status enum, lifecycle timestamps).
- Auth: `POST /api/auth/register`, `POST /api/auth/login` — bcrypt hashing, JWT issuance, duplicate email/phone → 409.
- JWT middleware (`auth.middleware.js`) attaching `req.user`; role middleware (`role.middleware.js`) via `requireRole(...roles)`.
- Driver endpoints: `POST /api/drivers/profile` (creates Driver + Vehicle), `GET /api/drivers/me`, `PATCH /api/drivers/status`.
- Ride endpoints: `POST /api/rides` (rider-only, driver=null, status=requested), `GET /api/rides/:id` (ownership enforced from `req.user`, not client input).
- Ride state machine (`ride.service.js` `VALID_TRANSITIONS` + `assertValidTransition`) defined now, not wired to endpoints yet (no transition endpoints exist on Day 1 — reserved for Day 2's accept/start/complete/cancel).
- Centralized error handling: `ApiError`, `notFoundHandler`, `errorHandler` (maps Mongoose `ValidationError`, `CastError`, duplicate-key `11000` to consistent `{ success, message, errors? }` responses).
- Request validation via `express-validator` on all mutating routes.
- `GET /api/health`.
- `README.md` with setup, API list, Postman flow, architecture decisions.

### Files Changed
All new: `package.json`, `.env`, `.env.example`, `.gitignore`, `README.md`, `src/app.js`, `src/server.js`, `src/config/db.js`, `src/models/{User,Driver,Vehicle,Ride}.js`, `src/controllers/{auth,driver,ride}.controller.js`, `src/routes/{auth,driver,ride}.routes.js`, `src/services/{auth,driver,ride}.service.js`, `src/middleware/{auth,role,error}.middleware.js`, `src/utils/{ApiError,generateToken}.js`.

### Testing
- `npm install` completed successfully (192 packages).
- `node -e "require('./src/app')"` — app loads and registers routes without error.
- Full request/response flow (register → login → create ride → get ride, driver profile → status) verified against a local MongoDB instance (see test run below for exact results).

### Remaining (deliberately out of scope for Day 1)
Redis, Kafka, WebSockets/Socket.IO, Razorpay, automatic driver matching, notifications, fare calculation, cancellation/accept endpoints, tests, Docker packaging.

### Next Step
Day 2: add `POST /api/rides/:id/accept` (driver), `POST /api/rides/:id/start`, `POST /api/rides/:id/complete`, `POST /api/rides/:id/cancel`, wired through the existing `assertValidTransition`.

## Day 2 — Ride Lifecycle (COMPLETE)

### Implemented
- `ride.service.js`: `acceptRide`, `startRide`, `completeRide`, `cancelRide`, plus a shared `populateRide` helper (refactored out of `getRideById`, no behavior change).
- Reused Day 1's `VALID_TRANSITIONS`/`assertValidTransition` as-is — it already matched the Day 2 spec exactly, so the transition table itself needed no changes.
- Check order standardized across all four lifecycle functions: ride-exists (404) → authorization / driver-profile-lookup (403/404) → state-transition validity (400) → business constraint like driver-busy (409). This makes each error message the most specific one available (e.g. a driver who was never assigned to a ride gets 403 before ever hearing about ride state).
- Accept, complete, and cancel-of-an-accepted-ride each run inside a Mongoose transaction (`mongoose.startSession()` + `session.withTransaction`) so `Ride` and `Driver` flip together. Safe because `MONGO_URI` is now a MongoDB Atlas connection (always a replica set); start-ride is a single-document update so it just uses a plain `save()`.
- `PATCH /api/rides/:id/accept|start|complete|cancel` added to `ride.routes.js`, gated by the existing `authenticate` + `requireRole` middleware (no new middleware needed).
- `ride.controller.js` got four thin handlers mirroring the existing `createRide`/`getRide` style.
- `Ride` model: added `cancelledBy` (`"rider" | "driver" | null`) — the only schema change; `cancelledAt` already existed from Day 1 and is reused.
- Business rule (documented, not an oversight): a driver can only cancel a ride they've already accepted. `ride.driver` is `null` before acceptance, so a driver has no way to be "the assigned driver" of a still-`requested` ride — that case resolves to 403.

### Files Changed
- `src/services/ride.service.js` — added the four lifecycle functions + `populateRide` helper.
- `src/controllers/ride.controller.js` — added `acceptRide`, `startRide`, `completeRide`, `cancelRide` handlers.
- `src/routes/ride.routes.js` — added the four `PATCH` routes.
- `src/models/Ride.js` — added `cancelledBy` field.
- `README.md` — added Day 2 endpoint table rows, a full "Day 2 — Ride Lifecycle" section (sync table, authorization rules, check-ordering rationale, example requests), updated Postman flow and architectural-decisions sections.
- Nothing in Day 1's auth, driver, or health code paths was touched.

### Testing
Wrote a temporary end-to-end script (`__day2_test.js`, deleted after the run — not part of the repo) that boots the real Express app against the live Atlas database in `.env`, and drives it purely over HTTP via `fetch` (register → login → driver profile → ride create → accept/start/complete/cancel), asserting status codes and response bodies. Also unit-checked all 11 explicitly-listed invalid transitions via `assertValidTransition` directly. All checks passed (`=== DAY 2: ALL CHECKS PASSED ===`), including:
- Accept: success, double-accept (400), busy-driver-accept (409), rider-accept (403), unauthenticated (401).
- Start: success, wrong-driver (403), rider (403), starting a requested ride (403), double-start (400).
- Complete: success, wrong-driver (403), rider (403), completing an accepted-but-not-started ride (400), double-complete (400).
- Cancel: rider cancels requested (200), rider cancels accepted + driver freed (200 + verified via `GET /drivers/me`), driver cancels own accepted ride + freed (200), unrelated rider (403), unassigned driver on a requested ride (403), cancel-after-start (400), cancel-after-complete (400).
- Driver status: available→busy on accept, busy→available on complete and on cancel-of-accepted, confirmed via `GET /api/drivers/me` after each transition.
Test data (4 users, 2 drivers, 2 vehicles, 6 rides) was deleted from Atlas after the run via a second temporary cleanup script (also deleted).

### Remaining (deliberately out of scope for Day 2)
Redis, Kafka, WebSockets/Socket.IO, Razorpay, automatic driver matching, notifications, fare calculation, automated test files committed to the repo (testing was done via a throwaway script per the instruction to "create a reasonable test suite or provide a clear Postman testing flow" — a Postman flow is documented in the README since no test framework existed in the Day 1 stack).

### Next Step
Day 3: introduce Redis for driver availability/location and nearby-driver GEO lookups, without touching the Day 1/2 REST surface.
