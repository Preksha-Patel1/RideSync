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

### Next Step (superseded — see Day 3 below)
The original plan was Redis-backed driver GEO lookups; Day 3 instead did this with MongoDB geospatial queries directly, since a `2dsphere` index already existed and Redis wasn't yet justified for a single-instance learning project. Redis remains a good Day 4+ candidate once matching needs to reserve a driver with a TTL across concurrent requests.

## Day 3 — Driver Matching & Geospatial Queries (COMPLETE)

### Implemented
- `src/config/constants.js` — `DRIVER_SEARCH_RADIUS_METERS`, read from `.env` (default `5000`), so the radius isn't hardcoded in the matching logic.
- `src/services/matching.service.js` — `findNearestAvailableDriver(coordinates)`, a single `Driver.findOne` using `$near`/`$geometry`/`$maxDistance` against `Driver.currentLocation` (already `2dsphere`-indexed since Day 1). `$near` returns nearest-first, so the first `status: "available"` hit within the radius is already the closest — no extra sort needed.
- `ride.service.js` `createRide` now calls the matching service right after creating the ride and stores the result on a new `Ride.matchedDriver` field (nullable). The ride is always created regardless of whether a driver was found — matching failure/empty-result never blocks ride creation.
- **`matchedDriver` is advisory only** — it is not enforced as the sole driver allowed to accept. Considered gating `acceptRide` on it, but that would strand a ride forever if the matched driver goes busy/offline before responding (no other driver could ever accept it under Day 3's synchronous accept model). Enforcing that safely needs a reservation-with-timeout/fallback-to-next-driver mechanism, which is exactly the kind of thing Redis TTL keys are good for — deliberately deferred to Day 4+.
- `PATCH /api/drivers/location` — new driver-only endpoint to update `Driver.currentLocation`, validated the same way pickup/destination already are (array of 2, lon ∈ [-180,180], lat ∈ [-90,90]).
- `GET /api/rides/my-rides` — authenticated riders see rides where they're the rider, drivers see rides where they're the assigned driver; supports `?page=&limit=` (limit capped at 50).
- **`acceptRide` concurrency hardening**: replaced the Day 2 pattern (`Ride.findById` → mutate → `ride.save()`) with `Ride.findOneAndUpdate({ _id, status: "requested" }, { $set: {...} }, { session, new: true })` inside the existing transaction, and the same conditional-update pattern for the driver's `available → busy` flip. See "Concurrency" below for why this matters.

### Why the read-then-write pattern was unsafe
Two drivers hitting `/accept` for the same ride at nearly the same time could both execute `Ride.findById` and see `status: "requested"` *before either one writes*. Under the old code, both would then proceed to set `status = "accepted"` and `.save()`; whichever write lands second silently overwrites the first driver's acceptance — the ride ends up "accepted" by driver B, but driver A's client already got a 200 believing they had it. `findOneAndUpdate` closes this gap because the `status: "requested"` check and the write happen as one atomic operation at the database level — the second call's filter no longer matches (status is already `"accepted"`), so it gets `null` back and the code returns a clean `409` instead of corrupting state. This is a proper first-level fix, not a full solution: it works because each ride/driver document is a single point of atomicity in MongoDB. It does **not** help across multiple documents or multiple app instances contending on a broader resource (e.g., reserving a driver against many simultaneous ride requests before any of them touch the `Ride` collection) — that class of problem is where a distributed lock (Redis `SET NX PX` or similar) becomes relevant, planned for Day 4+.

### Why `2dsphere` (not `2d`)
`2d` indexes assume flat Euclidean coordinates; `2dsphere` treats coordinates as points on a sphere (real longitude/latitude) and is required for GeoJSON `Point` queries like `$near`/`$geometry` to return geodesically-correct distances. Both `Driver.currentLocation` and `Ride.pickup.location`/`destination.location` already had `2dsphere` indexes from Day 1, so no index changes were needed for Day 3 — only the query logic was new.

### Files Changed
- New: `src/config/constants.js`, `src/services/matching.service.js`.
- Modified: `src/models/Ride.js` (added `matchedDriver`), `src/services/ride.service.js` (matching in `createRide`, atomic `acceptRide`, new `getMyRides`, `populateRide` now also populates `matchedDriver`), `src/services/driver.service.js` (added `updateLocation`), `src/controllers/ride.controller.js` (added `getMyRides`), `src/controllers/driver.controller.js` (added `updateLocation`), `src/routes/ride.routes.js` (added `GET /my-rides`, placed before `GET /:id`), `src/routes/driver.routes.js` (added `PATCH /location`), `.env`/`.env.example` (added `DRIVER_SEARCH_RADIUS_METERS`).
- Nothing in Day 1/2's auth, accept/start/complete/cancel authorization rules, or state machine was removed or renamed.

### Testing
Two temporary end-to-end scripts driven over real HTTP against the app running on `localhost:5050` with the live Atlas database (deleted after the run, not part of the repo):
1. **Day 3 script** (20/20 passed): driver profile creation; ride created with no available driver → `matchedDriver: null`; ride created with one near driver (30m away) and one far driver (Delhi, outside the 5km radius) → `matchedDriver` correctly resolves to the near driver only; a driver who goes `busy` is excluded from matching for a subsequent ride; two drivers concurrently calling `/accept` on the same ride via `Promise.all` → exactly one gets `200`, the other gets a `409`/`400`, and the ride ends up `accepted` exactly once with a valid single driver; `GET /rides/my-rides` pagination (`limit`, `totalCount`, page size) for both a rider and a driver; invalid longitude on `PATCH /drivers/location` → `400`.
2. **Day 2 regression script** (12/12 passed): full requested→accepted→started→completed lifecycle, double-accept → `400`, rider-attempts-start → `403`, cancel-after-complete → `400`, driver flips back to `available` after completion, rider cancels a requested ride, unrelated rider blocked from `GET /rides/:id` → `403`, unauthenticated create → `401`, invalid coordinates → `400` — confirming no Day 1/2 behavior regressed.
All test users/drivers/vehicles/rides were deleted from Atlas after both runs via a throwaway cleanup script.

### Remaining (deliberately out of scope for Day 3)
Redis-based driver reservation/TTL locking, Kafka events, WebSockets/real-time ride-request push to drivers, payments, fallback-to-next-driver on decline/timeout, fare calculation, automated test files committed to the repo (same rationale as Day 2 — no test framework in the stack yet).

### Next Step
Day 4: Kafka events (`RIDE_REQUESTED`, `DRIVER_ASSIGNED`, `RIDE_ACCEPTED`, `RIDE_STARTED`, `RIDE_COMPLETED`, `RIDE_CANCELLED`) and a Redis-backed reservation step so a matched driver can be "held" with a TTL while they're notified, falling back to the next-nearest driver on decline/timeout instead of leaving matching purely advisory.
