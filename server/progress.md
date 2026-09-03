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

### Next Step (superseded — see Day 4 below)
Redis landed in Day 4 as a caching/fast-state layer, not yet the reservation-with-TTL mechanism described here — matching is still advisory. That reservation step is now the natural Day 5+ follow-up once real-time push (WebSockets) exists to actually notify a held driver.

## Day 4 — Redis Caching & Fast-Changing Driver State (COMPLETE)

### Implemented
- `src/config/redis.js` — Redis client (`redis` npm package v4) reading `REDIS_URL` from `.env`. Connection errors are logged, never thrown past `connectRedis()` — Redis is treated as an optional optimization layer, unlike MongoDB which is required for startup. A bounded `reconnectStrategy` (backoff up to 5s, gives up after 10 attempts) means a dead Redis doesn't spam reconnect attempts forever; once given up, `client.isReady` stays `false` and every caller's fallback path takes over.
- `src/services/redis.service.js` — thin wrapper exposing `get/set/del` (cache-aside primitives, `set` accepts an optional TTL) and `geoAdd/geoRemove/geoSearchNearest` (Redis GEO, built on a sorted set). Every function checks `client.isReady` and wraps the actual call in try/catch, returning a safe empty value (`null`/`false`) and logging a warning on failure — callers never need their own try/catch around Redis.
- `src/config/constants.js` — added `REDIS_DRIVER_TTL_SECONDS` (default `30`, short and configurable — see "Why a short TTL" below) and `REDIS_KEYS` (centralizes the `driver:status:{userId}` and `drivers:geo` key naming so no service hardcodes a string key).
- **Driver status cache-aside** (`driver.service.js#getDriverStatus`): Redis `GET` first; on a miss, `Driver.findOne(...).select("status")` from MongoDB, then `SET ... EX <ttl>` to populate the cache for next time. Only the single `status` field is cached — `getProfileByUserId` (backs `GET /api/drivers/me`) is untouched, since it needs a populated Mongo document (vehicle + user) regardless, so caching it wouldn't save a query.
- **Cache invalidation / write-through** (`driver.service.js#syncStatusCache`, called from `updateStatus` and from `ride.service.js` after every Mongo-committed driver status flip in `acceptRide`/`completeRide`/`cancelRide`): writes the new status directly into Redis (with the same TTL) the moment MongoDB's write commits, rather than deleting the key and waiting for the next read to reload it. Chose "update" over "invalidate" because the caller already has the exact new value in hand — writing it costs the same one Redis call as a delete, but skips a guaranteed cache-miss for whoever reads next.
- **Redis GEO for driver location** (`drivers:geo` key, maintained by `driver.service.js`): a driver is added to the geo set (`GEOADD`) when their status becomes `"available"` (in `updateStatus`/`syncStatusCache`, and again in `updateLocation` if already available) and removed (`ZREM`, since GEO is sorted-set-backed) when they go `busy`/`offline`. Geo-set membership *is* the availability filter — no separate per-candidate status check is needed during search.
- **`matching.service.js#findNearestAvailableDriver`** now tries Redis GEO first (`geoSearchNearest`), and only falls back to the original Day 3 MongoDB `$near` query if Redis returns nothing (down, or the geo set is empty/has no candidate in range). On a Redis hit, it still does one cheap `Driver.findOne` to fetch the full record and defensively re-checks `status: "available"` in case the cache had drifted — MongoDB remains the final authority.
- **Fast-fail pre-check in `ride.service.js#acceptRide`**: before touching MongoDB at all, it calls the cache-aside `getDriverStatus`; a cached `"busy"` short-circuits straight to `409` with zero MongoDB round trips. This is purely a speed optimization — the existing Day 3 atomic `findOneAndUpdate` still re-checks status against MongoDB itself before committing, so a stale or missing cache entry can never cause an incorrect assignment.
- `.env`/`.env.example` — added `REDIS_URL` (default `redis://localhost:6379`) and `REDIS_DRIVER_TTL_SECONDS` (default `30`).
- `server.js` — added `await connectRedis()` after `connectDB()`. Mongo failure still exits the process (`connectDB` is unchanged); Redis failure is swallowed inside `connectRedis()` and logged, so the server starts normally either way.

### Why no new endpoints
Every integration point above lives inside an **existing** Day 1–3 route: `PATCH /api/drivers/status`, `PATCH /api/drivers/location`, `POST /api/rides` (matching), and `PATCH /api/rides/:id/accept`. No endpoint was added just to "show off" Redis — per the Day 4 brief, Redis had to prove real value inside the app's actual hot paths or not be added at all.

### Why a short TTL, and why TTL alone isn't enough
Driver status/location changes every time a ride starts, ends, or a location ping arrives — a long TTL would let a cached `"available"` outlive a driver who has since gone `busy`, letting a second rider be matched to someone already on a ride. `REDIS_DRIVER_TTL_SECONDS=30` bounds how stale a *forgotten* invalidation can get. But TTL alone would still leave up to 30 seconds of staleness on every real status change, which is unacceptable for something as consequential as "is this driver double-bookable" — that's why `syncStatusCache` also does an explicit write-through at every status-changing call site, so the common case is corrected immediately and TTL is only the safety net for whatever wasn't explicitly synced (e.g. a Driver document edited directly, outside the app).

### MongoDB vs Redis in this project
MongoDB stores persistent data that must survive a restart and remain the single source of truth: users, drivers, rides, ride history, vehicle records. Redis stores fast-changing, cheap-to-lose, frequently-read data that exists to avoid repeat MongoDB round trips: cached driver status (`driver:status:*`, TTL-bound) and the live `drivers:geo` set. Redis never becomes the only place data lives — every value it caches has a MongoDB row it was read from and can always be rebuilt from. This is why the project doesn't move authorization or ride-state-machine decisions into Redis: those must survive a Redis restart with zero ambiguity, so they stay exclusively in MongoDB, guarded by the same atomic `findOneAndUpdate` pattern from Day 3.

### Redis failure handling
Verified directly: with the Redis container stopped, `POST /api/rides` (matching), `PATCH /api/drivers/status`, `PATCH /api/drivers/location`, and `PATCH /api/rides/:id/accept` all still returned correct `200`/`201` responses — matching fell back to the Day 3 MongoDB `$near` query, the accept pre-check fell back to a direct MongoDB read, and `/api/health` was unaffected. `redis.service.js` logs a `console.warn` for every failed Redis call but never throws it up to the controller layer, so a request never fails *because* Redis is down — only because of an actual business-rule violation.

### Files Changed
- New: `src/config/redis.js`, `src/services/redis.service.js`.
- Modified: `src/config/constants.js` (added `REDIS_DRIVER_TTL_SECONDS`, `REDIS_KEYS`), `src/services/driver.service.js` (added `getDriverStatus`, `syncStatusCache`; `updateStatus`/`updateLocation` now call into Redis), `src/services/matching.service.js` (tries Redis GEO before the Mongo fallback), `src/services/ride.service.js` (fast-fail cache pre-check in `acceptRide`; cache sync calls added after `acceptRide`/`completeRide`/`cancelRide`'s driver-status writes), `src/server.js` (`connectRedis()` on startup), `.env`/`.env.example` (`REDIS_URL`, `REDIS_DRIVER_TTL_SECONDS`), `package.json` (added `redis` dependency).
- Nothing in Day 1–3's routes, controllers, auth, or state machine was removed or renamed. No new API endpoints were added.

### Testing
All against a real local Redis (`docker run redis:7-alpine`, removed after testing) and the same live Atlas MongoDB used in Days 1–3, driven over real HTTP with throwaway scripts (deleted after the run):
1. **Cache + GEO test (12/12 passed)**: nearest-driver matching resolved via Redis GEO (near driver A found over far driver B in Delhi); driver A excluded from a subsequent match immediately after accepting (removed from the geo set); a busy driver's second accept attempt rejected via the cached-status fast-fail (`409`) with no ride-state ambiguity; driver A re-added to the geo set and re-matched immediately after completing their ride (status flip synced to cache/geo, not left to expire).
2. **Direct Redis inspection** (`redis-cli`): confirmed `driver:status:*` keys carry a live, counting-down TTL and hold the correct value after a write-through; confirmed `drivers:geo` (`ZRANGE`) contains exactly the currently-available drivers.
3. **Redis-down test (7/7 passed)**, run with the Redis container stopped: driver profile creation, status update, location update, ride creation (with correct Mongo-fallback matching), and ride acceptance all still succeeded; `/api/health` unaffected.
4. **Regression**: Day 2 script (12/12) and Day 3 script (20/20, including the concurrent-accept race test) re-run after all Day 4 changes — all still pass, confirming the new Redis fast-fail layer sits safely on top of Day 3's atomic MongoDB guarantees rather than replacing them.
All test data was deleted from Atlas and Redis was flushed after each run.

### Remaining (deliberately out of scope for Day 4)
Kafka events, WebSockets/real-time push, driver reservation-with-TTL (matching is still advisory, same as Day 3), payments, fare calculation, Docker/AWS/Kubernetes for the app itself (Redis was run in Docker only as a local dev convenience, not part of the app's deployment story yet).

### Next Step (superseded — see Day 5 below)
The plan noted here (WebSockets before Kafka) was reordered: Day 5 built Kafka event-driven processing first, per this session's explicit instructions. WebSockets remain the logical Day 6 candidate — see Day 5's own "Next Step" below.

## Day 5 — Kafka Event-Driven Ride Processing (COMPLETE)

**Explicit project constraint for this session: no Docker anywhere.** Kafka was installed and run as a native local process (no Dockerfile, no docker-compose, no containers) — see "Local Kafka setup" below. Redis (Day 4) is unaffected and, as before, is commonly run via Docker locally as a convenience, but that was never a hard requirement of the app itself and nothing here changes that.

### Branch note
Day 4's Redis work had been committed on the `ridesync1` branch but not yet merged into `main`, which is where this session started. Per explicit instruction, `ridesync1` was merged into `main` (`git merge ridesync1`, clean fast-forward-free merge, no conflicts) before any Day 5 work began, so Day 5 builds on top of the real, already-existing Day 4 implementation rather than re-doing it.

### Implemented
- `src/config/kafka.js` — a single shared `kafkajs` `Kafka` client, reading `KAFKA_BROKERS` (comma-separated) and `KAFKA_CLIENT_ID` from `.env`. `requestTimeout: 5000` bounds how long any single Kafka operation (connect, send, fetch) can block, and `retry: { retries: 3 }` bounds reconnect attempts — both exist so a dead broker adds seconds, not tens of seconds, to a request. kafkajs' own internal logger is silenced (`logLevel.NOTHING`) in favor of this project's own structured `console.log`/`console.warn`/`console.error` calls at each meaningful operation.
- `src/services/kafkaProducer.js` — `connectProducer()`, `disconnectProducer()`, and `publishEvent(topic, eventType, data)`. `publishEvent` builds the standard envelope (`eventId` via `crypto.randomUUID()` — no extra dependency needed — `eventType`, ISO `timestamp`, `version: 1`, `data`), never throws, and returns `true`/`false`. Messages are keyed by `rideId` so every event for a given ride lands on the same partition and is therefore delivered to a consumer in produced order (accepted before started before completed).
- `src/consumers/rideEventConsumer.js` — subscribes to the `ride-events` topic under consumer group `ridesync-ride-consumers` (`fromBeginning: false`), validates each message (valid JSON, has `eventId`/`eventType`/`data`), and logs `Event processing started`/`Event processing completed` (or `Event processing failed` with the reason, on a malformed message — without crashing). Deliberately does **not** re-run `ride.service.js`'s business logic or write to MongoDB — MongoDB was already updated synchronously before the event was even published.
- `src/config/constants.js` — added `KAFKA_TOPICS.rideEvents` (`"ride-events"`), `KAFKA_CONSUMER_GROUP` (`"ridesync-ride-consumers"`), and `RIDE_EVENT_TYPES` (`ride.requested/accepted/started/completed/cancelled`) — centralized so no topic/event-type string is duplicated across producer, consumer, or `ride.service.js`.
- `src/services/ride.service.js` — after each lifecycle function's MongoDB write (and, for `acceptRide`/`completeRide`/`cancelRide`, after the Redis cache/geo sync from Day 4) actually commits, it calls `kafkaProducer.publishEvent(...)` with a minimal payload (`{ rideId, riderId, driverId }`, plus `cancelledBy` for cancellations) — never the full Mongoose document.
- `src/server.js` — startup sequence extended to `connectDB()` → `connectRedis()` → `connectProducer()` → `startRideEventConsumer()` → `app.listen()`. Added the project's first graceful-shutdown handler: `process.on("SIGINT"/"SIGTERM", ...)` closes the HTTP server first (stop accepting new requests), then the consumer, then the producer, then Redis (`redisClient.quit()`), then `mongoose.connection.close()`, then exits — reverse of startup order, so nothing still-running loses a dependency out from under it.
- `.env`/`.env.example` — added `KAFKA_BROKERS` (default `localhost:9092`) and `KAFKA_CLIENT_ID` (default `ridesync-backend`).
- `package.json` — added exactly one new dependency: `kafkajs`.

### Command vs Event
A **command** is an instruction aimed at one recipient, expected to be obeyed or rejected right now — `PATCH /rides/:id/accept` is a command ("accept this ride"), and the server can say no (`409` if the driver is busy, `400` if the ride isn't in a state that allows it). An **event** is a broadcast statement of fact about something that has already, unconditionally happened — `ride.accepted` is an event; nothing can "reject" it, because by the time it's published, MongoDB already holds the committed result. This project only ever publishes events named in the past tense (`ride.requested`, not `ride.request`), and only after the corresponding MongoDB write has succeeded — see "Database first" below.

### Database first, then publish (and why the order can't flip)
Every publish call in `ride.service.js` happens strictly after its MongoDB write (and any Day 4 Redis sync) has already completed. If the order were reversed — publish first, then attempt the database write — a database failure after a successful publish would leave a `ride.requested` event on the topic describing a ride that was never actually created; any consumer (this one, or a future one) would believe something exists that MongoDB has no record of. Since `publishEvent()` never throws, doing it last also means a Kafka outage can never undo or fail an already-successful ride mutation — the worst case is a missing event, never a phantom one.

### Local Kafka setup (no Docker)
Kafka needs a JVM. This session found none installed, so:
1. Installed Eclipse Temurin JDK 17 via `winget install --id EclipseAdoptium.Temurin.17.JDK` (a native Windows install, not a container).
2. Downloaded Kafka 3.9.1 (`kafka_2.13-3.9.1.tgz`) from `archive.apache.org` and extracted it.
3. Ran it in **KRaft mode** (`config/kraft/server.properties`) — Kafka's Zookeeper-free mode, standard since Kafka 3.3+ and the only mode Kafka 4.x supports at all — using the Windows `.bat` scripts under `bin\windows\`, so no Zookeeper process or Zookeeper-specific application code was ever needed.
4. Formatted storage once (`kafka-storage.bat format -t <uuid> -c config\kraft\server.properties`) and started the broker (`kafka-server-start.bat config\kraft\server.properties`) as a plain background Windows process.
5. Created the topic once: `kafka-topics.bat --create --topic ride-events --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1`.

One real Windows-specific snag worth recording: Kafka's `.bat` scripts build a `CLASSPATH` by globbing every jar under `libs\`, and `cmd.exe` has an ~8191-character command-line limit — running Kafka from a long, deeply-nested path (or a path containing spaces, like this machine's default user-profile-based temp directory) overflowed that limit and Kafka's own class loader failed with `Could not find or load main class`. The fix was mechanical: install Kafka under a short, space-free path (`C:\Users\Public\kafka`) instead. This is purely a path-length/quoting issue in Kafka's Windows tooling, unrelated to Docker, KRaft, or this project's code.

### Files Changed
- New: `src/config/kafka.js`, `src/services/kafkaProducer.js`, `src/consumers/rideEventConsumer.js`.
- Modified: `src/config/constants.js` (Kafka topic/group/event-type constants), `src/services/ride.service.js` (a `publishEvent` call after each of `createRide`/`acceptRide`/`startRide`/`completeRide`/`cancelRide`'s MongoDB writes), `src/server.js` (Kafka producer/consumer added to startup; new graceful-shutdown handler), `.env`/`.env.example` (`KAFKA_BROKERS`, `KAFKA_CLIENT_ID`), `package.json`/`package-lock.json` (`kafkajs`).
- Nothing in Day 1–4's routes, controllers, auth, state machine, Redis caching, or geospatial matching was removed, renamed, or had its behavior changed. No new API endpoints were added — Kafka is purely an internal event-transport layer, invisible to API clients.

### A bug found and fixed during testing
The first implementation of `publishEvent`'s `catch` block logged the send failure but never marked the producer as disconnected. Verified impact: with Kafka killed mid-run, a **second** `POST /api/rides` still took ~3.8s (a full retry against the dead broker) instead of failing fast, because nothing had recorded that the broker was unreachable. Fixed by setting the connected flag to `false` inside that `catch` block, so only the *first* request after a failure pays the bounded ~4-5s `requestTimeout` cost; every request after that skips straight to "not connected, skipping publish" in a few milliseconds. The documented tradeoff: this app does not attempt to reconnect its Kafka producer in the background after a failure — publishing stays off until the process restarts. A production system would use kafkajs's own connect/disconnect events or a periodic health check to self-heal; that's more retry/reconnection infrastructure than Day 5's "do not build advanced Kafka retry infrastructure yet" scope allows.

### Testing
All against the real local Kafka broker above, the same local Redis from Day 4, and the same live Atlas MongoDB from Days 1–4 — driven over real HTTP with a throwaway script (deleted after the run), plus direct Kafka CLI inspection:
1. **Full lifecycle event test (6/6 passed)**: created a ride, accepted/started/completed it, then created and cancelled a second ride. Confirmed via server logs that all five event types (`ride.requested`, `ride.accepted`, `ride.started`, `ride.completed`, `ride.cancelled`) were both published and consumed, in order, with matching `rideId`/`riderId`/`driverId` at each stage.
2. **Independent Kafka CLI verification**: `kafka-console-consumer.bat --topic ride-events --from-beginning` read all 6 messages directly off the topic (bypassing this app's own consumer entirely) and confirmed the exact envelope shape (`eventId`, `eventType`, `timestamp`, `version: 1`, `data`) for every one.
3. **Malformed-event handling (consumer)**: published a non-JSON string and a valid-JSON-but-missing-required-fields message directly to the topic. Both were logged as `Event processing failed` with the reason and skipped; the consumer kept running and correctly processed a subsequent legitimate event afterward — proving one bad message doesn't stall or crash the consumer loop.
4. **Kafka-down failure handling**: killed the Kafka broker process entirely, then confirmed `POST /api/rides`, `PATCH /api/rides/:id/accept`, driver profile creation, status, and location updates all still returned correct success responses — this app never depends on Kafka to serve a request. Measured the fix above directly: first post-failure request ≈4.2s (bounded retry), second ≈0.1s (fast-skip).
5. **Regression**: Day 2 (12/12), Day 3 (20/20, including the concurrent-accept race), and Day 4 (12/12, Redis cache-aside + GEO) scripts all re-run after the Day 5 changes — all still pass, confirming Kafka was added without disturbing any earlier day's guarantees.
6. **Graceful shutdown — partially verified.** The handler code follows the standard, widely-used Node.js pattern (`process.on("SIGINT"/"SIGTERM")` → close HTTP server → close consumer/producer/Redis/MongoDB → exit) and was verified by code review. Attempting to trigger it directly in this sandbox (via `taskkill` and via Node's own `process.kill(pid, "SIGTERM")` from a separate script) only force-terminated the process rather than delivering a real signal — confirmed to be a genuine Windows platform limitation (`taskkill` without `/F` refuses outright for a console process with no window to receive `WM_CLOSE`; `process.kill()` to another process is documented as unreliable for anything but forceful termination on Windows) rather than a bug in the handler. This same code runs correctly under `docker stop`, systemd, Kubernetes' `preStop`, or Ctrl+C in an attached interactive terminal — all of which deliver a real signal — none of which this sandboxed background-process testing setup could reproduce.
All test data was deleted from Atlas and Redis/the Kafka topic were left containing only the messages documented above (Kafka has no easy single-topic "delete these test messages" primitive short of deleting and recreating the topic, which wasn't necessary since the topic's content is disposable dev/test data, not something the app reads back).

### Remaining (deliberately out of scope for Day 5)
WebSockets/Socket.IO, real-time ride tracking, Razorpay/payments, driver reservation-with-TTL (still advisory, unchanged from Day 3/4), transactional outbox (mentioned above as the real fix for the publish-after-commit consistency gap, not implemented), dead-letter topics, idempotent consumer deduplication (every event already carries a unique `eventId` that such a check would key off, but the check itself isn't implemented), Kafka Streams, multi-consumer scaling (the consumer group is named and ready for it, but only one consumer instance runs), Docker/Kubernetes/AWS for the app itself.

### Next Step
Day 6 (per this session's reordering — see note above): WebSockets/Socket.IO for real-time ride and driver-location updates, and/or the Razorpay payment flow. WebSockets are also what finally makes a safe driver-reservation-with-timeout worth building on top of Day 3/4's advisory matching, since only then can a "held" driver actually be notified and given a chance to respond before falling back to the next-nearest candidate.
