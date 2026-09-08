# RideSync — Ride-Hailing Backend

A learning-oriented, Uber/Ola-inspired ride-hailing backend. Day 1 established a clean **modular monolith** foundation: authentication, roles, driver profiles, and basic ride creation/retrieval. Day 2 completes the basic ride lifecycle (accept → start → complete, plus cancellation) on top of that foundation — built to be extended with Redis, Kafka, WebSockets, and Razorpay on later days without a rewrite.

## Architecture

```text
                              ┌──────────────┐
                              │    Client    │
                              └──────┬───────┘
                                     │
                        ┌────────────┴────────────┐
                        ↓                         ↓
                   REST API                  Socket.IO
                        ↓                         ↓
                  Controllers            Socket auth + ride rooms
                        ↓                         ↑
                 ┌──────┴───────┐                 │
                 ↓              ↓                 │
           Ride Service   Payment Service          │
                 │              │                  │
                 │              ↓                  │
                 │      Simulated Provider          │
                 │              │                  │
                 └──────┬───────┴───publishEvent───→│ (via Kafka)
                        │                           │
                ┌───────┼────────┐                  │
                ↓       ↓        ↓                  │
            MongoDB   Redis    Kafka                │
           (source   (cache,  (ride.*/payment.*     │
            of truth) geo,     events)              │
                      live loc)    ↓                │
                          Ride/Payment Event Consumers
                                    └────broadcastRideStatus()/
                                         broadcastPaymentStatus()──┘
```

Cross-cutting concerns (JWT authentication, role authorization, centralized error handling) live in `middleware/`. Since Day 4, services read/write Redis through `services/redis.service.js` — Redis always sits *in front of* MongoDB as an optional fast path, never as a replacement for it. Since Day 5, `ride.service.js` also publishes an event to Kafka *after* every successful MongoDB write, via `services/kafkaProducer.js` — Kafka is a transport for "this already happened," never where ride state actually lives. Since Day 6, `consumers/rideEventConsumer.js` bridges those Kafka events into `ride:<rideId>` Socket.IO rooms so connected clients see ride-status changes live, and drivers push GPS updates straight over their socket connection (validated, throttled, and written to Redis — never MongoDB) for the same rooms to receive in real time. Since Day 7, `payment.service.js` (a service independent of `ride.service.js`, talking to its own `Payment` model) calculates fares from the ride's own data, runs payments through a swappable `PaymentProvider` abstraction, and publishes its own `payment.*` events on a separate Kafka topic, bridged to the same `ride:<rideId>` Socket.IO room by a second, independent consumer (see "Day 7" below).

## Technology Stack

- Node.js + Express.js
- MongoDB + Mongoose
- Redis (`redis` npm client) — cache + fast-changing driver state
- Apache Kafka (`kafkajs` npm client) — asynchronous ride and payment event streaming
- Socket.IO (`socket.io` npm package) — real-time client communication
- JWT (`jsonwebtoken`) for authentication
- `bcrypt` for password hashing
- `express-validator` for request validation
- `dotenv`, `cors`, `nodemon`

## Folder Structure

```text
server/
├── src/
│   ├── config/
│   │   ├── db.js
│   │   ├── redis.js
│   │   ├── kafka.js
│   │   ├── socket.js
│   │   └── constants.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── driver.controller.js
│   │   ├── ride.controller.js
│   │   └── payment.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── socketAuth.middleware.js
│   │   ├── role.middleware.js
│   │   └── error.middleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Driver.js
│   │   ├── Vehicle.js
│   │   ├── Ride.js
│   │   └── Payment.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── driver.routes.js
│   │   ├── ride.routes.js
│   │   └── payment.routes.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── driver.service.js
│   │   ├── ride.service.js
│   │   ├── matching.service.js
│   │   ├── redis.service.js
│   │   ├── kafkaProducer.js
│   │   ├── fare.service.js
│   │   ├── payment.service.js
│   │   └── paymentProviders/
│   │       └── simulatedPaymentProvider.js
│   ├── consumers/
│   │   ├── rideEventConsumer.js
│   │   └── paymentEventConsumer.js
│   ├── sockets/
│   │   └── rideSocket.js
│   ├── utils/
│   │   ├── generateToken.js
│   │   └── ApiError.js
│   ├── app.js
│   └── server.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup Instructions

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` (already provided for local dev) and adjust as needed:

```env
PORT=5050
MONGO_URI=mongodb://127.0.0.1:27017/ride-hailing
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d
DRIVER_SEARCH_RADIUS_METERS=5000
REDIS_URL=redis://localhost:6379
REDIS_DRIVER_TTL_SECONDS=30
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=ridesync-backend
REDIS_RIDE_LOCATION_TTL_SECONDS=120
FARE_BASE=50
FARE_PER_KM=15
FARE_PER_MINUTE=2
PAYMENT_CURRENCY=INR
```

> **This project runs entirely without Docker, by design — MongoDB, Redis, and Kafka are all set up as native local processes below.** Port 5050 is used instead of the more common 5000 because on this machine 5000 happened to be held by something else; feel free to pick any open port.

### 3. MongoDB Setup

This project was built and tested against a MongoDB Atlas connection string (`mongodb+srv://...`) — free tier is enough. If you'd rather run MongoDB locally instead, install it natively for your OS (e.g. the official [MongoDB Community Server installer](https://www.mongodb.com/try/download/community) on Windows/macOS, or your Linux distro's package manager) and point `MONGO_URI` at `mongodb://127.0.0.1:27017/ride-hailing`.

### 3b. Redis Setup (Day 4+)

Redis has no official native Windows build. This project runs it as a portable, installer-free binary — no Docker, no Windows service registration:

```powershell
# Download & extract once (Windows; adjust for your OS)
# https://github.com/tporadowski/redis/releases — grab the latest Redis-x64-*.zip
# Then, from the extracted folder:
redis-server.exe redis.windows.conf
```

On macOS/Linux, Redis has an official native build — install via your package manager (`brew install redis`, `apt install redis-server`, etc.) and run `redis-server`.

Check it's reachable (from the same folder as `redis-server.exe`, or with `redis-cli` on your `PATH`):

```bash
redis-cli -p 6379 ping   # → PONG
```

Redis is **optional at runtime** — see "Day 4 — Redis failure handling" below. If it's not running, the server still starts and every API still works; it just always falls back to MongoDB instead of using the cache/geo fast path.

### 3c. Kafka Setup (Day 5+)

See "Day 5 — Local Kafka setup (no Docker)" further down for the full walkthrough (install a JDK, download Kafka, run it in KRaft mode, create the `ride-events` topic) — Kafka is likewise optional at runtime; the server starts and every API works without it, just without event publishing/consumption.

### 4. Run locally

```bash
npm run dev     # nodemon, auto-restart
npm start        # plain node
```

The server starts on `http://localhost:5050` (or whatever `PORT` you set). Verify with:

```http
GET /api/health
```

## API Endpoints

| Method | Endpoint               | Auth              | Description                     |
|--------|-------------------------|-------------------|----------------------------------|
| GET    | `/api/health`           | none              | Health check                    |
| POST   | `/api/auth/register`    | none              | Register a rider or driver      |
| POST   | `/api/auth/login`       | none              | Login, receive JWT              |
| GET    | `/api/drivers/me`       | driver            | Get own driver profile          |
| POST   | `/api/drivers/profile`  | driver            | Create driver profile + vehicle |
| PATCH  | `/api/drivers/status`   | driver            | Update availability status      |
| POST   | `/api/rides`             | rider             | Request a ride                  |
| GET    | `/api/rides/:id`         | rider/driver (ride owner) | Get a ride by id         |
| PATCH  | `/api/rides/:id/accept` | driver            | Accept a `requested` ride (Day 2) |
| PATCH  | `/api/rides/:id/start`  | assigned driver   | Start an `accepted` ride (Day 2)  |
| PATCH  | `/api/rides/:id/complete` | assigned driver | Complete a `started` ride (Day 2) |
| PATCH  | `/api/rides/:id/cancel` | rider (owner) or assigned driver | Cancel a `requested`/`accepted` ride (Day 2) |
| GET    | `/api/rides/my-rides`   | rider or driver   | Paginated list of the caller's own rides (Day 3) |
| PATCH  | `/api/drivers/location` | driver            | Update current GeoJSON location, used for matching (Day 3) |

## Authentication Flow

1. `POST /api/auth/register` — validates input, checks duplicate email/phone, hashes password with bcrypt, creates the user, issues a JWT, and returns `{ user, token }` (password never included).
2. `POST /api/auth/login` — looks up the user by email, compares the bcrypt hash, and issues a JWT on success.
3. Protected routes require `Authorization: Bearer <token>`. The `authenticate` middleware verifies the token, loads the user, and attaches it to `req.user`.
4. `requireRole("rider" | "driver")` middleware gates role-specific routes and is reused across route files instead of duplicating checks in controllers.

## Ride Data Model

```text
rider, driver, matchedDriver, pickup { address, location: GeoJSON Point },
destination { address, location: GeoJSON Point },
status, fare, requestedAt, acceptedAt, startedAt, completedAt, cancelledAt, cancelledBy
```

On creation: `driver = null`, `status = "requested"`. Starting Day 3, `matchedDriver` is populated by the geospatial matching lookup if a nearby available driver exists (see "Day 3" below) — it's informational and doesn't restrict who may accept.

## Ride State Machine

```text
requested
   ├──→ accepted
   └──→ cancelled

accepted
   ├──→ started
   └──→ cancelled

started
   └──→ completed

completed   (terminal)
cancelled   (terminal)
```

All other transitions (e.g. `completed → accepted`, `started → cancelled`) are rejected with `400`. The transition map lives in `ride.service.js` (`VALID_TRANSITIONS`) and is enforced by `assertValidTransition`, which every Day 2 lifecycle function (`acceptRide`, `startRide`, `completeRide`, `cancelRide`) calls — the rules are defined once and reused, never duplicated in a controller.

## Day 2 — Ride Lifecycle

Day 2 adds the accept/start/complete/cancel endpoints on top of the Day 1 foundation. No Day 1 files were removed or rewritten — `ride.service.js` gained four new functions, `ride.controller.js` gained four thin handlers, `ride.routes.js` gained four routes, and `Ride.js` gained one new field (`cancelledBy`).

### Driver ↔ ride synchronization

| Action | Ride status | Driver status |
|---|---|---|
| Accept | `requested → accepted` | `available → busy` |
| Start | `accepted → started` | stays `busy` |
| Complete | `started → completed` | `busy → available` |
| Cancel (was `requested`) | `requested → cancelled` | unaffected (no driver assigned yet) |
| Cancel (was `accepted`) | `accepted → cancelled` | `busy → available` (only the assigned driver) |

Accept, complete, and cancel-of-an-accepted-ride each touch **two** documents (`Ride` + `Driver`) that must change together — a ride stuck at `accepted` with its driver still `available` would let that driver double-book. These three operations run inside a Mongoose transaction (`mongoose.startSession()` + `session.withTransaction`). This is safe here because the project's `MONGO_URI` points at MongoDB Atlas, which is always backed by a replica set; transactions require that (a single standalone `mongod` cannot run them). Start/complete-only-ride-field updates (`startRide`) touch a single document, so they don't need a session — a plain `save()` is already atomic.

### Authorization rules

- **Accept**: any authenticated user with the `driver` role and an existing driver profile. There is no "assigned driver" yet at this stage, so no ownership check applies — only role + profile existence + driver availability.
- **Start / Complete**: only the driver stored in `ride.driver` (compared against `req.user._id`, never a client-supplied id) may act. A rider, or a driver who isn't assigned to that specific ride, gets `403`.
- **Cancel**: either the ride's `rider` or its assigned `driver` (`ride.driver`) may cancel; anyone else gets `403`. Because `ride.driver` is `null` until a ride is accepted, a driver can never cancel a still-`requested` ride they were never assigned to — that request also resolves to `403` (this is a deliberate business rule, not an oversight: a driver has no relationship to a ride until they accept it).

### Check ordering (why a given failure returns the status code it does)

Each lifecycle function checks things in this order, so the error returned is always the most specific one available:

1. **Ride exists** (`404 Ride not found`)
2. **Authorization** — is this driver the assigned driver / is this user the rider or assigned driver (`403`) — for `accept`, the equivalent check is "does this driver have a profile at all" (`404 Driver profile not found`), since there's no assignment yet to check against
3. **State transition validity** via `assertValidTransition` (`400`)
4. **Business constraint** — driver must be `available` to accept (`409 Driver is already busy` / `409 Driver must be available to accept rides`)

This means, for example, a driver trying to `start` a ride that was never assigned to them fails at step 2 (`403`) even if the ride's current status would otherwise allow the transition — you must own the ride before its state even matters to you.

### Example requests

**Accept** (driver, ride currently `requested`):
```http
PATCH /api/rides/64f.../accept
Authorization: Bearer <driver token>
```
```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "data": { "ride": { "status": "accepted", "driver": { "_id": "...", "name": "..." }, "acceptedAt": "..." } }
}
```

**Start** (assigned driver, ride currently `accepted`):
```http
PATCH /api/rides/64f.../start
Authorization: Bearer <driver token>
```

**Complete** (assigned driver, ride currently `started`):
```http
PATCH /api/rides/64f.../complete
Authorization: Bearer <driver token>
```

**Cancel** (rider or assigned driver, ride currently `requested` or `accepted`):
```http
PATCH /api/rides/64f.../cancel
Authorization: Bearer <rider or driver token>
```
```json
{
  "success": true,
  "message": "Ride cancelled successfully",
  "data": { "ride": { "status": "cancelled", "cancelledAt": "...", "cancelledBy": "rider" } }
}
```

**Error shape** (unchanged from Day 1's centralized error handler):
```json
{ "success": false, "message": "Cannot transition ride from 'started' to 'cancelled'" }
```

## Postman Testing Sequence

**Full lifecycle (start to finish):**
1. Start the backend (`npm run dev`), confirm `GET /api/health`.
2. Register + login a rider → copy `riderToken`.
3. Register + login a driver → copy `driverToken`.
4. `POST /api/drivers/profile` with `driverToken` (vehicle details).
5. `PATCH /api/drivers/status` `{ "status": "available" }` with `driverToken`.
6. `POST /api/rides` with `riderToken` → copy the returned ride `_id`.
7. `PATCH /api/rides/:id/accept` with `driverToken` → ride becomes `accepted`, driver becomes `busy`.
8. `PATCH /api/rides/:id/start` with `driverToken` → ride becomes `started`.
9. `PATCH /api/rides/:id/complete` with `driverToken` → ride becomes `completed`, driver becomes `available` again.
10. `GET /api/rides/:id` at any point (as the rider or the assigned driver) to see the current state.

**Cancellation:**
- Create a new ride, then `PATCH /api/rides/:id/cancel` with `riderToken` while it's still `requested` → `200`, `status: "cancelled"`.
- Create another ride, accept it, then cancel with either `riderToken` or `driverToken` while it's `accepted` → `200`, and `GET /api/drivers/me` confirms the driver is back to `available`.
- Try to cancel after `start` (or after `complete`) → `400` (invalid transition).

**Invalid-transition / authorization cases to verify:**
- No token on any `/accept`, `/start`, `/complete`, `/cancel` route → `401`
- Rider hitting `/accept`, `/start`, or `/complete` → `403`
- A driver who isn't assigned to the ride hitting `/start` or `/complete` → `403`
- An unrelated rider hitting `/cancel` → `403`
- A driver who was never assigned trying to `/cancel` a still-`requested` ride → `403`
- Accepting an already-`accepted`/`started`/`completed`/`cancelled` ride → `400`
- Starting a ride that's still `requested`, or starting one twice → `400`/`403`
- Completing a ride that's only `accepted` (not yet `started`), or completing one twice → `400`
- A `busy` driver trying to accept a second ride → `409`
- Rider hitting `/api/drivers/me` (Day 1 case, still enforced) → `403`
- Rider A fetching Rider B's ride (Day 1 case, still enforced) → `403`
- Duplicate email/phone on register (Day 1 case, still enforced) → `409`
- Malformed body, e.g. bad email or bad coordinates (Day 1 case, still enforced) → `400`

## Day 3 — Driver Matching & Geospatial Queries

Day 3 adds automatic nearby-driver matching to ride creation, using MongoDB's built-in geospatial indexing rather than introducing Redis. No Day 1/2 file was rewritten — matching is additive: a new `matchedDriver` field on `Ride`, a new `matching.service.js`, and a hardened `acceptRide`.

> **Day 4 update:** `matching.service.js#findNearestAvailableDriver` now tries a Redis GEO lookup first and only runs the MongoDB `$near` query below as a fallback. The query itself, the `matchedDriver` semantics, and everything else in this section are otherwise unchanged from Day 3 — see "Day 4" further down for what changed and why.

### Ride state diagram

```text
                    requested
                   /          \
              accepted      cancelled  (terminal)
              /      \
          started   cancelled  (terminal)
             |
         completed   (terminal)
```

`completed` and `cancelled` are terminal — no further transition is allowed from either. The transition table (`VALID_TRANSITIONS` in `ride.service.js`) is unchanged from Day 1/2.

### GeoJSON & the `2dsphere` index

Both `Ride.pickup.location`/`destination.location` and `Driver.currentLocation` store a GeoJSON `Point`:

```json
{ "type": "Point", "coordinates": [longitude, latitude] }
```

All three fields already had a `2dsphere` index from Day 1. `2dsphere` (as opposed to the older, flat `2d` index) treats coordinates as real longitude/latitude on a sphere, which is what MongoDB's `$near`/`$geometry` geospatial queries require to compute geodesically-correct distances and to return results sorted nearest-first.

### How matching works

1. Rider calls `POST /api/rides` with `pickup`/`destination`.
2. The ride is created immediately with `status: "requested"`.
3. `matching.service.js#findNearestAvailableDriver(pickupCoordinates)` runs a single query:
   ```js
   Driver.findOne({
     status: "available",
     currentLocation: {
       $near: {
         $geometry: { type: "Point", coordinates: pickupCoordinates },
         $maxDistance: DRIVER_SEARCH_RADIUS_METERS, // from .env, default 5000m
       },
     },
   });
   ```
   `$near` returns matches nearest-first, so the first hit is already the closest available driver within the radius — no manual distance sort needed.
4. If a driver is found, their user id is stored on `ride.matchedDriver` (purely informational — see below). If not, `matchedDriver` stays `null` and ride creation still succeeds.
5. Any available driver can still call `PATCH /api/rides/:id/accept` to actually claim the ride — `matchedDriver` does not gate acceptance.

**Why `matchedDriver` doesn't gate `/accept`:** if it did, and the matched driver went `busy`/offline before responding, the ride would be permanently stranded — no other driver could ever accept it in this synchronous, no-timeout model. A safe version of "reserve the matched driver, fall back to the next-nearest on decline/timeout" needs a TTL-based reservation (a good fit for Redis, e.g. `SET driver:<id>:hold <rideId> PX 15000 NX`), which is intentionally deferred — see Future Roadmap. For Day 3, matching is a fast, useful "who's nearby" signal, not a hard assignment.

**How this evolves toward real Uber-like matching:** broadcast-to-nearest-N-drivers-with-a-response-window, geohash/H3-cell bucketing so the query touches far fewer documents at scale, driver-side push instead of poll (WebSockets, Day 5), and demand-based radius/surge — none of which change today's core `$near` primitive, they just wrap more policy around it.

### Driver availability & location

- `PATCH /api/drivers/status` (Day 1) — `offline | available | busy`.
- `PATCH /api/drivers/location` (Day 3, new) — body `{ "coordinates": [longitude, latitude] }`, validated the same way ride pickup/destination coordinates are (array of exactly 2 numbers, longitude ∈ [-180, 180], latitude ∈ [-90, 90]).
- A driver is only matchable when `status: "available"` **and** has a real `currentLocation` within the search radius. The Day 1/2 `available ↔ busy` sync on accept/complete/cancel already keeps a driver mid-ride out of the matching pool — no changes were needed there.

### Concurrency: the accept race

**The problem:** two drivers can both call `PATCH /api/rides/:id/accept` for the same ride within milliseconds. Day 2's implementation read the ride (`status: "requested"`), then separately wrote `status = "accepted"`. Between that read and write there's a window where a second request can also read `"requested"` — both requests believe they're allowed to proceed, and whichever `save()` lands second silently overwrites the first driver's acceptance.

**The fix:** `acceptRide` now uses `Ride.findOneAndUpdate({ _id: rideId, status: "requested" }, { $set: { driver, status: "accepted", acceptedAt } }, { new: true, session })`. The status check and the write happen as a single atomic database operation — the second caller's filter no longer matches (the document's status already flipped), so it gets `null` back and the code returns `409 Ride was already accepted by another driver`. The same conditional-update pattern guards the driver's `available → busy` flip, in case the same driver is racing to accept two different rides at once. Both updates still run inside the existing Day 2 transaction, so `Ride` and `Driver` move together.

**Why this isn't the final word on concurrency:** this fix works because a single MongoDB document is always the unit of atomicity. It does not help with races that span *before* any document is touched — e.g., reserving a driver against several simultaneous incoming ride requests, or coordinating across multiple app server instances contending for the same limited pool of nearby drivers. That class of problem is what a distributed lock (Redis `SET NX PX`, or a proper distributed-lock library) is for, and is intentionally out of scope for Day 3.

### Configuration

`DRIVER_SEARCH_RADIUS_METERS` (`.env`, default `5000`) controls the matching radius. It's read once in `src/config/constants.js` and imported wherever needed — never hardcoded inline.

### Testing the full flow (Postman/curl)

1. Register + login a rider and two drivers; create driver profiles for both.
2. `PATCH /api/drivers/status` `{ "status": "available" }` for both drivers.
3. `PATCH /api/drivers/location` with coordinates close to your intended pickup for one driver, and far away for the other.
4. `POST /api/rides` as the rider with that pickup — inspect the response's `data.ride.matchedDriver`; it should be the near driver, not the far one.
5. `PATCH /api/rides/:id/accept` as the near driver → `200`, ride `accepted`.
6. `GET /api/rides/my-rides?page=1&limit=10` as the rider or either driver to see paginated results scoped to that user.
7. To see the race protection: create a ride, then fire two `PATCH /api/rides/:id/accept` requests concurrently (e.g. two terminal tabs, or `Promise.all` in a script) as two different available drivers — exactly one returns `200`, the other `409`.

## Day 4 — Redis Caching & Fast-Changing Driver State

Day 4 introduces Redis as a **speed optimization layer in front of MongoDB** — never a replacement for it. No Day 1–3 endpoint, controller, or route was added or removed; Redis was wired into the *existing* driver-status, driver-location, matching, and accept flows.

### Why Redis, and what it actually buys you

MongoDB is durable — data survives a restart — but every read is a disk-backed query with a query planner in the way. Redis keeps everything in memory, so a `GET`/`SET` is a single fast round trip with none of that overhead. That speed is exactly why Redis fits data that's **read far more often than it changes**, or that's **cheap to lose** — a `driver.status` read on every ride-accept attempt, or a driver's live coordinates, both fit that description. Redis is not used here for anything that must survive a restart with zero ambiguity (users, rides, ride history) — that stays in MongoDB, which remains the single source of truth for the whole project.

### Cache-aside pattern (driver status)

`driver.service.js#getDriverStatus(userId)`:

```text
Request → check Redis (driver:status:{userId})
  cache HIT  → return cached value; MongoDB is not queried
  cache MISS → Driver.findOne(...).select("status")  [MongoDB]
             → Redis SET ... EX <REDIS_DRIVER_TTL_SECONDS>
             → return the value
```

This is only applied to the single `status` field, not the whole driver profile — `GET /api/drivers/me` (`getProfileByUserId`) still always hits MongoDB, because it needs a populated document (vehicle + user) regardless, so caching it wouldn't save a query. Status alone is small, read on every accept attempt, and is exactly what a cache-aside is for.

### TTL

`REDIS_DRIVER_TTL_SECONDS` (`.env`, default `30`) bounds cached driver status. Kept deliberately short: driver status changes every time a ride starts, ends, or a status/location update comes in, so a long TTL would let a stale `"available"` outlive a driver who's actually gone `busy` — risking two riders being matched to the same driver. When the TTL elapses, Redis silently drops the key; the next read is just a cache miss that reloads from MongoDB and re-populates the cache — no explicit cleanup needed. **TTL alone isn't sufficient on its own**, though: it still allows up to `REDIS_DRIVER_TTL_SECONDS` of staleness on every real change, which is why cache invalidation (next section) does the actual heavy lifting, and TTL is just the safety net underneath it.

### Cache invalidation

Whenever a driver's status changes — via `PATCH /api/drivers/status`, or implicitly via `acceptRide`/`completeRide`/`cancelRide` in `ride.service.js` — `driver.service.js#syncStatusCache` runs immediately after MongoDB's write commits. Two options exist here:

- **(A) Invalidate** — delete the Redis key, let the next read reload it from MongoDB.
- **(B) Update** — write the new value into Redis directly.

This project uses **(B)**, because every call site already has the exact new value in hand (it just wrote it to MongoDB) — writing it is one Redis call, the same cost as a delete, but it avoids a guaranteed cache-miss for whichever request reads it next. (A) would have been the safer default if the new value *weren't* already known — that's a real tradeoff worth remembering for other caches later.

### Redis GEO for driver location

A Redis GEO key (`drivers:geo`) is actually a sorted set: each member (a driver's user id) is stored with a score derived from a geohash of their longitude/latitude. `GEOADD`/`GEOSEARCH` answer "who is near this point" without a database round trip — ideal for data that changes every few seconds and is queried on every ride request.

- `driver.service.js#updateStatus`/`syncStatusCache` — `GEOADD`s the driver into `drivers:geo` when they go `"available"`, `ZREM`s them out when they go `"busy"`/`"offline"`. (Sorted-set members can't carry their own TTL — only the whole key can expire — so freshness here is explicit add/remove, not TTL-based.)
- `driver.service.js#updateLocation` — re-`GEOADD`s the driver's new coordinates if they're currently `"available"`.
- Geo-set **membership is the availability filter** — no separate per-candidate status check is needed at search time, since only available drivers are ever members.

### Basic nearby-driver search using Redis

`matching.service.js#findNearestAvailableDriver` (called on every `POST /api/rides`) now:

1. `GEOSEARCH drivers:geo FROMLONLAT <lon> <lat> BYRADIUS <r> m ASC COUNT 1` — nearest match, if any.
2. On a hit: one cheap `Driver.findOne({ user: id, status: "available" })` to fetch the full record — MongoDB is still consulted for the actual driver data and to defensively re-confirm status, since Redis is a cache, not the final authority.
3. If Redis returns nothing (down, or no candidate in range — including right after a fresh Redis start, before any driver has re-reported their location, a known limitation), it falls straight through to the original Day 3 MongoDB `$near` query — unchanged, so this always still works even with Redis absent entirely.

### MongoDB vs Redis — responsibilities

| | MongoDB | Redis |
|---|---|---|
| Used for | Users, drivers, rides, ride history, vehicles | Cached driver status, live driver geo-location |
| Durability | Source of truth, survives restarts | Cache only — safe to lose, always rebuildable from MongoDB |
| Access pattern here | Occasional writes, needs full documents | Very frequent reads/writes of small values |

Redis is never the only place a value lives — everything it holds has a MongoDB row it was read from (or a `driver.currentLocation` it mirrors). That's why ride-state-machine transitions and authorization decisions stay exclusively in MongoDB (guarded by Day 3's atomic `findOneAndUpdate`), never in Redis.

### Redis failure handling

`config/redis.js`'s client uses a bounded `reconnectStrategy` (backoff up to 5s, gives up after 10 attempts) and every `redis.service.js` function checks `client.isReady` before touching the connection, wrapping the actual call in try/catch — a failure logs a `console.warn` and returns a safe empty value (`null`/`false`) rather than throwing. Verified directly by stopping the Redis container entirely and confirming `POST /api/rides`, `PATCH /api/drivers/status`, `PATCH /api/drivers/location`, and `PATCH /api/rides/:id/accept` all still return correct responses (falling back to MongoDB throughout) and `/api/health` is unaffected. `server.js` treats MongoDB as required (`connectDB()` failure exits the process) but Redis as optional (`connectRedis()` swallows its own errors and always resolves) — Redis here is an optimization, never a required source of truth.

### Configuration

`REDIS_URL` (default `redis://localhost:6379`) and `REDIS_DRIVER_TTL_SECONDS` (default `30`) live in `.env`/`.env.example`, read once via `src/config/constants.js`/`src/config/redis.js` — never hardcoded inline.

### Testing the full flow (Postman/curl)

1. Start Redis locally (see "Redis Setup" above) and the server.
2. Register + login a rider and a driver; create the driver's profile.
3. `PATCH /api/drivers/status` `{ "status": "available" }`, then `PATCH /api/drivers/location` with coordinates near your intended pickup.
4. Inspect Redis directly: `redis-cli -p 6379 GET driver:status:<userId>` should show `"available"` with a live `TTL`; `redis-cli -p 6379 ZRANGE drivers:geo 0 -1` should include that driver's user id.
5. `POST /api/rides` with a nearby pickup — `data.ride.matchedDriver` should resolve to that driver, via the Redis GEO path *if* your local Redis supports `GEOSEARCH` (Redis 6.2+ — see the Day 6 note on the portable Windows build this project uses, which doesn't); either way it resolves correctly, just via a different code path underneath.
6. `PATCH /api/rides/:id/accept` as that driver — then re-check `redis-cli -p 6379 GET driver:status:<userId>` (now `"busy"`, updated immediately, not just expired) and `redis-cli -p 6379 ZRANGE drivers:geo 0 -1` (driver removed).
7. To see the fast-fail path: with that driver still `busy`, try `PATCH /api/rides/:id/accept` on a *different* ride as the same driver — `409`, resolved via the cache without a MongoDB round trip for the status check.
8. To see failure handling: stop the `redis-server.exe` process (Task Manager, or `Ctrl+C` if run in a foreground terminal), then repeat steps 3–6 — every request still succeeds (falling back to MongoDB), just without the Redis fast path. Start `redis-server.exe redis.windows.conf` again to bring it back.

## Day 5 — Kafka Event-Driven Ride Processing

**This project runs with no Docker anywhere, by explicit requirement.** Kafka is installed and run as a plain local process — see "Local Kafka setup (no Docker)" below.

### Command vs Event

A **command** targets one recipient and can be refused right now — `PATCH /rides/:id/accept` is a command, and the server can reply `409`/`400`. An **event** is a broadcast statement that something has already, unconditionally happened — `ride.accepted` is an event; nothing "rejects" it, because MongoDB already holds the committed result by the time it's published. Every event name here is past tense (`ride.requested`, not `ride.request`) for exactly this reason.

### Database first, then publish

```text
Validate request → perform business operation → persist in MongoDB → publish event
```

Never the reverse. If a command published its event *before* the database write, a failed write would leave an event on the topic describing something that never actually happened — any consumer reading it would believe MongoDB has a record it doesn't. Every `kafkaProducer.publishEvent(...)` call in `ride.service.js` happens strictly after its MongoDB write (and any Day 4 Redis sync) has already committed, and `publishEvent()` itself never throws — so a Kafka outage can produce a *missing* event, but never a *phantom* one.

### Event schema

```json
{
  "eventId": "3d578875-797a-4432-afb3-51332a2b4ef7",
  "eventType": "ride.cancelled",
  "timestamp": "2026-09-03T16:24:44.963Z",
  "version": 1,
  "data": { "rideId": "...", "riderId": "...", "driverId": null, "cancelledBy": "rider" }
}
```

`data` intentionally carries only what a consumer needs (`rideId`/`riderId`/`driverId`, plus `cancelledBy` for cancellations) — never the full Mongoose ride document. A small, stable payload is easier to keep backward-compatible as the schema evolves; `version` exists so a future breaking change to `data`'s shape can be introduced as `version: 2` without consumers guessing which shape they received. `eventId` (a UUID from Node's built-in `crypto.randomUUID()`) is what a future idempotent consumer would key deduplication off, and what you'd grep logs for to trace one event end to end — Day 5 doesn't implement that dedup check yet, but every event already carries the id it would need.

### Kafka architecture in this app

```text
ride.service.js (after MongoDB commit)
        ↓  publishEvent()
kafkaProducer.js  →  ride-events topic (1 partition, keyed by rideId)
                              ↓
                  consumer group: ridesync-ride-consumers
                              ↓
                  rideEventConsumer.js → validates → logs (async, off the request path)
```

Keying by `rideId` means every event for the same ride lands on the same partition, so a consumer always sees that ride's events in produced order (`accepted` before `started` before `completed`). The **consumer group** (`ridesync-ride-consumers`) is how Kafka tracks this consumer's committed offsets and would split the topic's partitions across multiple consumer processes if more than one ever joined the same group — Day 5 runs exactly one consumer, but naming the group now means scaling out later needs no code change.

### Redis vs Kafka vs MongoDB

| Technology | Main Responsibility |
|---|---|
| MongoDB | Persistent business data — users, drivers, rides, ride history. Survives restarts; the only source of truth. |
| Redis | Fast temporary/cache data — driver status (TTL-bound cache-aside) and live driver location (GEO set). Always rebuildable from MongoDB. |
| Kafka | Asynchronous event transport — "this already happened." Never holds the only copy of anything; MongoDB already committed before an event is published. |

Kafka is not "a faster Redis": Redis answers *current state* queries (is this driver available right now, who's nearby right now) with low-latency reads/writes to values that get overwritten. Kafka carries a *stream of facts about the past* to any number of independent readers, each tracking their own position in that stream — a fundamentally different job, which is why RideSync uses both for different problems rather than picking one.

### Synchronous vs asynchronous, before/after Day 5

```text
Before:  Client → API → Business Logic → MongoDB → Response
After:   Client → API → Business Logic → MongoDB → Publish Event → Response
                                                          ↓
                                                       Kafka → Consumer → Background processing (off the request path)
```

The event publish still happens *within* the request (bounded by `requestTimeout: 5000` — see "Kafka failure scenarios"), but everything downstream of Kafka (the consumer's processing) happens asynchronously, decoupled from the request/response cycle entirely. This is **eventual consistency** in miniature: MongoDB reflects `ride.status = "completed"` the instant the request returns, while the consumer's log line for `ride.completed` lands a moment later. That gap is expected and harmless here, because the consumer doesn't feed back into anything the API depends on — it's purely downstream/observational for Day 5.

### Local Kafka setup (no Docker)

Kafka needs a JVM.

1. Install a JDK (this session used [Eclipse Temurin 17](https://adoptium.net/), e.g. `winget install --id EclipseAdoptium.Temurin.17.JDK` on Windows, or your OS's package manager / the Adoptium installer directly).
2. Download Kafka from `https://downloads.apache.org/kafka/` (or `https://archive.apache.org/dist/kafka/` for older versions) — this project was built and tested against **Kafka 3.9.1** (`kafka_2.13-3.9.1.tgz`). Extract it somewhere with a **short path with no spaces** (Windows' `.bat` scripts build a classpath from every jar under `libs/`, and a long/space-containing path can overflow `cmd.exe`'s command-line length limit).
3. Format storage once, in **KRaft mode** (no Zookeeper — this is Kafka's standard mode since 3.3+, and the only mode Kafka 4.x supports):
   ```bash
   # macOS/Linux
   bin/kafka-storage.sh random-uuid   # copy the printed UUID
   bin/kafka-storage.sh format -t <uuid> -c config/kraft/server.properties

   # Windows
   bin\windows\kafka-storage.bat random-uuid
   bin\windows\kafka-storage.bat format -t <uuid> -c config\kraft\server.properties
   ```
   (Edit `log.dirs` in `config/kraft/server.properties` first if you want logs somewhere other than the default.)
4. Start the broker:
   ```bash
   bin/kafka-server-start.sh config/kraft/server.properties        # macOS/Linux
   bin\windows\kafka-server-start.bat config\kraft\server.properties  # Windows
   ```
   It listens on `localhost:9092` by default — matching this project's `.env` default `KAFKA_BROKERS=localhost:9092`.
5. Create the topics once (`ride-events` from Day 5, `payment-events` from Day 7 — see "Day 7" below for why payments use a separate topic):
   ```bash
   bin/kafka-topics.sh --create --topic ride-events --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
   bin/kafka-topics.sh --create --topic payment-events --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
   ```

### Inspecting Kafka from the CLI

```bash
# List topics
bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Read every message ever published to ride-events (Ctrl+C to stop)
bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic ride-events --from-beginning

# Publish a message by hand (useful for testing the consumer's malformed-event handling)
bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic ride-events
```
(Windows: same commands, `.bat` instead of `.sh`, under `bin\windows\`.)

### Kafka failure scenarios

- **Kafka unavailable at startup** — `connectProducer()`/`startRideEventConsumer()` each catch their own errors and log a warning; `server.js` starts the HTTP server regardless (mirrors Day 4's Redis handling exactly). The API is fully usable with zero events published or consumed.
- **Kafka dies mid-run** — the next `publishEvent()` call's `producer.send()` fails, is caught, logged, and marks the producer disconnected; that request still returns its normal success response (~4s slower, bounded by `requestTimeout`). Every request after that fast-skips publishing (a few ms) instead of retrying against a dead broker — see "a bug found and fixed" in `progress.md` for how this was verified and why the first implementation didn't do this correctly.
- **The app does not reconnect its Kafka producer in the background.** Once disconnected mid-run, publishing stays off until the process restarts. A production system would use kafkajs's own connect/disconnect events or a periodic health check; that's more retry/reconnection infrastructure than Day 5 builds by design.
- **Consumer receives a malformed message** — invalid JSON, or valid JSON missing `eventId`/`eventType`/`data` — is logged as `Event processing failed` and skipped; the consumer keeps running and processes the next message normally. Verified directly by publishing garbage messages by hand (see "Inspecting Kafka from the CLI" above) and confirming a subsequent real event still processed correctly afterward.
- **MongoDB operation fails** — no event is ever published for it, by construction (publish only happens after a successful write) — there is nothing to compensate for.
- **Redis unavailable** — unrelated to Kafka; unchanged from Day 4 (falls back to MongoDB, see "Day 4" above).

### Known limitation: the publish-after-commit consistency gap

Because publish happens after the MongoDB write (a deliberate choice — see "Database first" above), there is a small window between "MongoDB committed" and "event published" where a Kafka outage could mean an event is silently never sent for an action that definitely happened. Day 5 accepts this and just logs it loudly (`Event publish failed for ...`). The standard production fix is the **transactional outbox pattern** — write the event to an outbox table/collection in the *same* transaction as the business write, then have a separate dispatcher process reliably drain the outbox into Kafka with retries — which guarantees the event eventually gets published if the write succeeded. That's real infrastructure (a dispatcher process, retry/backoff, at-least-once delivery semantics for the dispatcher itself) and is deliberately out of scope for Day 5; it's a strong candidate whenever this gap becomes something the project actually needs to close.

### Testing the full flow end to end

1. Start MongoDB (Atlas, as in earlier days), Redis (Day 4 setup), and Kafka (above, in that order or any order — all three are optional at startup except MongoDB).
2. `npm run dev` — confirm the log shows `MongoDB connected` → `Redis connected and ready` → `Socket.IO initialized` (Day 6) → `Kafka producer connected` → `Ride event consumer started (group: ridesync-ride-consumers, topic: ride-events)` → `Payment event consumer started (group: ridesync-payment-consumers, topic: payment-events)` (Day 7) → `Server running on port 5050`.
3. Register + login a rider and a driver; create the driver's profile; `PATCH /api/drivers/status` `{ "status": "available" }`; `PATCH /api/drivers/location` near your intended pickup.
4. `POST /api/rides` — watch the server log for `Event published: ride.requested (...)` immediately followed by `Event processing started`/`Event processing completed` for the same `eventId`.
5. `PATCH /api/rides/:id/accept`, `/start`, `/complete` as the driver — same publish→consume pair should appear for each.
6. Create a second ride and `PATCH /api/rides/:id/cancel` as the rider — confirm `ride.cancelled` publishes/consumes too.
7. Independently confirm with the Kafka CLI: `kafka-console-consumer --topic ride-events --from-beginning` should show all of the above as raw JSON, matching the schema above.
8. To see failure handling: kill the Kafka broker process, then repeat steps 4–6 — every request still returns its normal success response; the log shows `Kafka producer not connected — skipping publish` instead of `Event published`. Restart Kafka and restart `npm run dev` to resume publishing (see "Known limitation" above for why an app restart, not just a broker restart, is needed).

## Day 6 — WebSockets & Real-Time Ride Updates

**No Docker anywhere — extended this session to Redis, which had been running in a Docker container purely as a Day 4 dev convenience.** See "Redis moved off Docker" below for what changed and why.

### Why REST alone isn't enough for live tracking

A REST client only learns something changed when it asks — polling `GET /api/rides/:id` every few seconds to see if a driver accepted, or where they currently are, wastes requests on "nothing changed yet" almost all the time, and the delay between polls is exactly how stale the client's view gets. A ride-hailing app's whole value during an active ride is *immediacy* — the rider watching the driver's dot move, finding out the instant a status changes. That's a fundamentally different shape of problem than "fetch a resource," which is what REST is built for.

### What a WebSocket is, and how Socket.IO builds on it

A WebSocket starts as a normal HTTP request (`GET` with an `Upgrade: websocket` header) and, once the server agrees, that same TCP connection stops speaking HTTP and becomes a full-duplex channel — either side can send a message at any time, with no new request/response round trip per message. **Socket.IO** is a library built on top of that: it adds automatic reconnection, an event-based API (`socket.emit('name', payload)` / `socket.on('name', handler)` instead of raw frames), fallback to HTTP long-polling for networks that block WebSocket upgrades, and **rooms** (below) — all things you'd otherwise have to build yourself on raw WebSockets.

### Socket authentication vs REST authentication

REST re-sends `Authorization: Bearer <token>` and re-verifies it on *every single request*, because each request is a brand-new, otherwise-anonymous connection. A socket authenticates **once**, during the initial handshake (`socket.handshake.auth.token`, checked by `socketAuth.middleware.js` using the exact same `JWT_SECRET`/`User` lookup as REST's `authenticate()`), and stays authenticated for the connection's entire lifetime — there's no per-message token to check because there's no per-message request. A rejected handshake never becomes a connected socket at all (the client gets a `connect_error`), so there is no such thing as an "unauthenticated but connected" socket in this app.

### Rooms, and why not every event goes to every client

A Socket.IO **room** is just a named group of sockets — `socket.join('ride:<rideId>')` adds this connection to that group, and `io.to('ride:<rideId>').emit(...)` sends only to sockets currently in it. Without rooms, the only alternative is a global broadcast to every connected client, which would mean every rider and driver in the system receives every other ride's status changes and GPS updates — a privacy problem as much as a waste of bandwidth. `join_ride` (see below) is the gate: only after `rideSocket.js` confirms the caller is that ride's rider or its assigned driver does the socket actually join the room, so a `ride_status_updated`/`driver_location_updated` broadcast to `ride:<rideId>` only ever reaches the two people who are supposed to see it.

### `join_ride` — room-join authorization

```json
// client emits:
"join_ride" { "rideId": "..." }

// server, on success:
"ride_joined" { "rideId": "..." }

// server, on failure:
"ride_error" { "message": "..." }
```

Before allowing the join, the server loads the ride and checks the authenticated socket's user id against `ride.rider` and `ride.driver` — the exact same ownership rule REST's `getRideById`/`cancelRide` already use. A driver who's only `matchedDriver` (advisory, Day 3) or not assigned at all cannot join; only after they actually accept (`ride.driver` gets set) can they join the room. A completely unrelated authenticated user gets `ride_error`, never a joined room, no matter how they craft the request.

### Driver location: Socket.IO → validate → Redis → Socket.IO room → rider

```json
// driver emits:
"driver_location_update" { "rideId": "...", "latitude": 23.0225, "longitude": 72.5714 }

// server broadcasts to ride:<rideId>:
"driver_location_updated" {
  "event": "driver_location_updated",
  "rideId": "...",
  "driverId": "...",
  "location": { "latitude": 23.0225, "longitude": 72.5714 },
  "timestamp": "2026-09-03T12:00:00.000Z"
}
```

Validated, in order: authenticated + `role === "driver"` → coordinate shape/range → ride exists → caller is *this* ride's assigned driver (not just any driver) → ride status is `accepted`/`started` (not `requested`, not `completed`/`cancelled`) → not arriving faster than the 2-second per-driver throttle. Only then: written to Redis (`driverService.updateLiveLocation`, **not** MongoDB — see below) and broadcast to the room.

**Why Redis, not MongoDB, for this write:** a driver's GPS can tick every second or more during an active ride. Writing every one of those to MongoDB — a durable, disk-backed, (with Atlas) replicated write — for data that's obsolete within seconds would mean most of a busy system's MongoDB write volume is churn nobody will ever query historically. Redis already exists in this project for exactly this kind of fast-changing, cheap-to-lose state (Day 4's driver status/geo cache). `Driver.currentLocation` in MongoDB is untouched by this path — it still gets updated, just separately and far less often, by the existing REST `PATCH /api/drivers/location` (Day 3/4).

**Why a separate Redis key from Day 4's `drivers:geo`:** that set's whole invariant is "only currently-*available*, matchable drivers." A driver on an active ride is `busy` — correctly excluded from matching, but their position is still exactly what the rider needs to see. Reusing `drivers:geo` for this would mean either breaking that invariant or bolting on special-case logic to route around it. A new key, `ride:<rideId>:driver-location` (sliding TTL, `REDIS_RIDE_LOCATION_TTL_SECONDS`, default 120s), keeps both jobs simple and independently correct.

### Basic flood protection

A per-driver, in-process `Map` tracks the last *accepted* update's timestamp; anything arriving less than 2 seconds later is silently dropped — not an error, since the driver's client sampling GPS quickly isn't wrong, this just decides how much of that stream gets processed and re-broadcast. This is exactly the kind of ephemeral, single-process runtime state that belongs in memory rather than Redis or MongoDB — see "What changes with multiple server instances" for the one real limit of that choice.

### Kafka + Socket.IO — how they fit together, and why one can't replace the other

```
PATCH /rides/:id/accept (REST)
        ↓
MongoDB updated
        ↓
ride.accepted published (Kafka, Day 5 — unchanged)
        ↓
rideEventConsumer processes it
        ↓
broadcastRideStatus(): io.to("ride:<rideId>").emit("ride_status_updated", {...})
        ↓
rider's connected socket (already in that room) receives it live
```

Kafka is backend-to-backend event transport: durable-ish (as durable as the topic's retention), replayable in principle, consumed by processes that don't need to be running the instant an event is produced. Socket.IO is backend-to-*browser/app* delivery: ephemeral, best-effort, and only meaningful to whoever is connected *right now* — there's nothing to replay if nobody was listening. Kafka **cannot** directly replace Socket.IO because a browser can't be a Kafka consumer (no persistent broker connection, no consumer-group semantics make sense for one browser tab); Socket.IO **cannot** replace Kafka because it has no concept of "process this later," no consumer groups, no replay — it either delivers to a connected socket right now or the message is gone. `rideEventConsumer.js` is the one place they meet: it's a real Kafka consumer (durable, replayable, decoupled from the REST request) whose job, upon successfully processing an event, is to also make one best-effort Socket.IO broadcast.

The driver-location path deliberately **does not** go through Kafka at all — it's driven by an inbound socket event, not a REST command with a MongoDB write behind it, so there's no ride-lifecycle event to publish. Kafka carries facts about ride *state transitions*; a GPS tick isn't one.

### REST vs Redis vs Kafka vs WebSocket

| | Best for | Example in this app |
|---|---|---|
| REST | Request/response operations with a clear success/failure | Create, accept, start, complete, cancel a ride |
| Redis | Fast, temporary, frequently-changing state | Driver status cache, driver geo, live ride location |
| Kafka | Asynchronous backend-to-backend events | `ride.accepted`, `ride.started`, `ride.completed` |
| WebSocket (Socket.IO) | Continuous real-time delivery to a connected client | Live ride status, live driver location |

### Connection lifecycle

- **Connect** — handshake authenticated, `socket.user` attached, logged (`Socket connected: user <id> (<role>)`).
- **Authentication failure** — connection rejected before `"connection"` ever fires; the client sees `connect_error`, never gets a usable socket.
- **Disconnect** — logged (`Socket disconnected: user <id> (<reason>)`); this project's per-driver location throttle map entry is cleaned up. Nothing about ride/business state changes as a result of a disconnect by itself — a dropped connection is not a cancelled ride.
- **Reconnect** — mobile networks drop and resume constantly; this is routine, not exceptional. Socket.IO's client reconnects automatically, but **room membership is not remembered across a reconnect** in this implementation — the client is expected to re-`join_ride` after reconnecting. Building server-side reconnection state sync (rejoining rooms automatically, replaying missed events) is real complexity deliberately left out of Day 6's scope.

### Security summary

- A rider can join and receive updates for their own rides only.
- An assigned driver can join and receive updates for, and send location updates for, only the ride they're currently assigned to (`ride.driver`, not `matchedDriver`).
- A random authenticated user can do neither for someone else's ride — verified directly (see Testing below): an outsider gets `ride_error` on `join_ride`, and a second, unassigned driver gets `ride_error` on `driver_location_update` for a ride that isn't theirs.
- No socket operation ever bypasses REST's authorization rules — it reuses the exact same ownership checks (`ride.rider`/`ride.driver` compared against the authenticated user's id), never a client-supplied id.

### Socket connections are runtime-only, never persisted

Nothing about an open socket connection is written to MongoDB — no "active connections" collection, no persisted session record. A `socket` object and this project's throttle `Map` live only in the Node process's memory for as long as that process runs; on restart or crash, they're simply gone and rebuilt as clients reconnect. This is the correct call for a single-server learning implementation: there is nothing about a live TCP connection that MongoDB (durable, queryable, meant to survive restarts) is the right tool for.

### What changes with multiple server instances

If RideSync ever ran as multiple server processes behind a load balancer (Server A, B, C), a real problem appears: a rider connected to Server A's socket, and a `ride.accepted` event consumed by Server B (each Kafka consumer instance connects independently), Server B has no way to reach a socket it doesn't hold — `io.to(room).emit()` only broadcasts within its own process's in-memory room registry. The standard fix is the **Socket.IO Redis adapter**: each server instance publishes outgoing broadcasts to a shared Redis pub/sub channel instead of (or in addition to) its local rooms, and every instance subscribes, so a broadcast issued on Server B still reaches a socket connected to Server A. This also usually needs the load balancer configured for **sticky sessions** (a given client's HTTP-polling-fallback requests must keep landing on the same server instance) if you're not exclusively using WebSocket transport. None of this is implemented — Day 6 is explicitly a single-server design — but it's worth understanding as the direct next step this architecture would need to actually scale horizontally.

### Testing the full flow end to end

1. Start MongoDB, Redis (native — see "Redis Setup" above), and Kafka (native — see "Local Kafka setup" above).
2. `npm run dev` — confirm the log shows the full startup sequence through `Server running on port 5050`.
3. Register + login a rider and a driver; create the driver's profile; set them `available` with a location near your test pickup.
4. Connect two Socket.IO clients (e.g. with `socket.io-client` in a small script, or any Socket.IO-compatible test tool) — one authenticated as the rider, one as the driver, each passing `{ auth: { token: "<JWT>" } }`.
5. `POST /api/rides` via REST as the rider; have the rider's socket `emit("join_ride", { rideId })` and confirm it receives `ride_joined`.
6. `PATCH /api/rides/:id/accept` via REST as the driver — confirm the rider's socket receives `ride_status_updated` with `status: "accepted"`. Have the driver's socket `join_ride` now too (it will succeed, since they're assigned).
7. Driver's socket `emit("driver_location_update", { rideId, latitude, longitude })` — confirm the rider's socket receives `driver_location_updated` with matching coordinates. Send a second update immediately after and confirm no second broadcast arrives (throttle). Send several updates a couple of seconds apart and check `redis-cli -p 6379 GET ride:<rideId>:driver-location` shows the latest one each time.
8. `PATCH /api/rides/:id/start` then `/complete` via REST — confirm `ride_status_updated` for each (`"started"`, `"completed"`).
9. After completion, have the driver try `driver_location_update` again for the same ride — confirm `ride_error` (ride no longer active).
10. For failure cases: connect a socket with an invalid/missing token and confirm `connect_error` instead of a connection; have an unrelated authenticated user try `join_ride` on someone else's ride and confirm `ride_error`; stop Redis and repeat step 7 (location still broadcasts live, just isn't cached); stop Kafka and repeat step 6 (REST still returns `200`, but no `ride_status_updated` arrives, since the consumer never received an event to relay).

## Day 7 — Simulated Payments, Idempotency & Reliability Polish

**No Docker anywhere — unchanged from every earlier day.** No real payment gateway either: this is a *simulated* provider (see below), so nothing here moves real money. **No Razorpay** — that's an explicitly future extension, not built today.

### Why Payment is its own model

Ride lifecycle (`requested → accepted → started → completed`) and payment lifecycle (`pending → success` / `pending → failed`) are separate concerns that happen to reference each other, not one bigger state machine. A `Ride` document with payment fields bolted on would force every payment-status change to also touch the ride, and vice versa, for no real benefit — and it would make "a completed ride with a still-pending payment" (a completely normal, expected state) look like two contradictory fields fighting each other on the same document instead of two independent facts. `Payment` references `Ride` (`payment.ride`), never the other way around; `ride.service.js` was not touched at all for Day 7.

### Fare calculation — backend-only, by construction

```text
distanceKm = Haversine(ride.pickup.location.coordinates, ride.destination.location.coordinates)
durationMinutes = (ride.completedAt - ride.startedAt) / 60000
fare = FARE_BASE + distanceKm × FARE_PER_KM + durationMinutes × FARE_PER_MINUTE
```

`fare.service.js#calculateFare(ride)` takes a `Ride` document and reads only fields already persisted on it — there is no code path anywhere in `payment.service.js`/`payment.controller.js` that lets a request body's `amount`, `distance`, or `duration` field influence the number that gets charged. The Haversine formula computes straight-line (great-circle) distance, not road/routing distance — a real system would call a routing API (Google/Mapbox/OSRM) for actual road distance; that's explicitly out of scope for a learning project's fare simulation. `Ride.fare` (a field that has existed, unused, since Day 1) gets populated the first time a payment is created for that ride, purely as a convenient snapshot for display — `Payment.amount` is the actual, immutable charge record regardless of what a re-run of the fare formula might produce later.

### Payment lifecycle

```text
Ride completed
      ↓
POST /api/payments/:rideId          (rider-initiated, not automatic)
      ↓
Fare calculated (backend only) → Payment created, status: pending
      ↓
POST /api/payments/:paymentId/pay   (simulates the provider's response)
      ↓
   pending → success                    pending → failed
      ↓                                     ↓
 paidAt set                          failedAt + failureReason set
      ↓                                     ↓
 payment.success published            payment.failed published
      ↓                                     ↓
      └──────────── Kafka ─────────────────┘
                      ↓
          paymentEventConsumer.js
                      ↓
     io.to("ride:<rideId>").emit("payment_status_updated")
                      ↓
                  Rider's client
```

Payment creation is **rider-initiated** (a REST call), not something `completeRide` triggers automatically — this keeps `ride.service.js` completely unaware that payments exist, and matches how a real app would work (the rider's client calls "pay now" after seeing the ride is done, rather than the ride-completion request silently kicking off a charge).

### Payment APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/:rideId` | rider (ride owner) | Calculate the fare and create a `pending` payment for a `completed` ride. Idempotent: a repeat call returns the existing payment (`200`) instead of erroring or creating a second one (`201` only the first time). |
| GET | `/api/payments/:paymentId` | rider (payment owner) | Retrieve a payment's current status. |
| POST | `/api/payments/:paymentId/pay` | rider (payment owner) | Simulates the provider's response and transitions the payment. Requires an `Idempotency-Key` header (`400` if missing). Body: `{ "result": "success" }` or `{ "result": "failure" }` (optional, defaults to success). |

### The simulated provider — an abstraction, not a shortcut

```text
PaymentController → PaymentService → PaymentProvider → SimulatedPaymentProvider
```

`simulatedPaymentProvider.js` implements one function, `charge({ requestedResult }) -> { status, providerReference, failureReason }` — the exact contract a future `razorpayPaymentProvider.js` would also implement, calling Razorpay's real API instead of returning a canned result. Swapping providers later means writing that one new file and changing one `require(...)` line in `payment.service.js`; the `Payment` model, the state machine, the controller, the routes, the Kafka events, and the Socket.IO notifications would all stay exactly as they are. This is the practical payoff of *programming against an abstraction* instead of coupling the whole payment flow directly to one vendor's SDK.

`requestedResult` in the request body is not the client dictating financial truth — it exists only because this is a simulator with no real external system to ask, and it mirrors how real payment gateways offer test-mode cards/tokens for exercising both the success and failure paths without moving real money. The value still only reaches the provider after passing `payment.service.js`'s ownership check, idempotency check, and state-machine check — a client can request a payment *attempt*, never assign `paymentStatus = SUCCESS` directly.

### Idempotency — how "double-click PAY" is made safe

`POST /api/payments/:paymentId/pay` requires an `Idempotency-Key` header. The mechanism, in `payment.service.js#simulatePayment`:

1. If the payment's stored `idempotencyKey` already equals the incoming one, **this exact request was already processed** — return the settled result as-is. No second provider call, no second Kafka event, no second financial effect, no matter how many times the identical request arrives.
2. If the payment isn't `pending` anymore (and the key doesn't match), this is a genuinely different attempt to pay an already-settled payment — rejected with `409`.
3. Otherwise, call the simulated provider, then apply the result with `Payment.findOneAndUpdate({ _id, status: "pending" }, { $set: {...} })` — **the same atomic-conditional-update pattern Day 3 used for `acceptRide`**. Two concurrent `pay` requests can both pass steps 1–2 before either writes; this filter re-checks `status: "pending"` atomically at write time, so only the first one actually applies. The loser reloads the payment: if the winner happened to use the *same* idempotency key (two copies of one logical retry racing each other), that's still a valid replay; otherwise it's correctly rejected.

The idempotency key is stored **on the `Payment` document in MongoDB**, not in Redis — this project's Redis (Day 4) is a cache for cheap-to-lose, fast-changing state, and financial idempotency needs to survive exactly as reliably as the payment record itself. Verified directly: replaying the identical request returns the identical `paidAt`, proving no re-processing occurred.

### Concurrency: two more races, same fix as Day 3

- **Two simultaneous `POST /api/payments/:rideId` for the same ride** — `paymentSchema.index({ ride: 1 }, { unique: true })` means MongoDB itself allows only one `Payment.create()` to succeed; the loser's driver-level duplicate-key error is caught and turned into "fetch and return the existing payment" rather than an error. Verified: both concurrent requests return the same payment id (one `201`, one `200`).
- **Two simultaneous `POST /:paymentId/pay` for the same payment** — the atomic conditional update above. Verified: exactly one of two concurrent attempts (requesting opposite outcomes) succeeds; the payment settles exactly once.

### Kafka events

`payment.created`, `payment.success`, `payment.failed` — on their own topic, `payment-events`, with their own consumer group, `ridesync-payment-consumers` (structurally identical to Day 5's `ride-events`/`rideEventConsumer.js`, but kept separate: payments are a distinct domain that happens to reference a ride, the same way an order-service's events stay on their own topic even though every order references a customer — splitting now means a future payment-only consumer, e.g. a reconciliation job, can subscribe without also receiving every `ride.*` event). Schema matches Day 5's exactly:

```json
{
  "eventId": "...",
  "eventType": "payment.success",
  "timestamp": "...",
  "version": 1,
  "data": { "paymentId": "...", "rideId": "...", "riderId": "...", "amount": 118.05, "currency": "INR" }
}
```

Published only *after* the corresponding MongoDB write commits — the same "database first" rule from Day 5, for the same reason: a payment can never be reported as successful in an event before it's actually recorded as successful, and a Kafka outage can produce a *missing* event but never a *phantom* one.

### Socket.IO payment notifications

`payment_status_updated`, broadcast to the ride's existing `ride:<rideId>` room by `paymentEventConsumer.js` — no new room type needed, since a payment's only audience (the rider) is already a member of that room from Day 6.

```json
{
  "event": "payment_status_updated",
  "paymentId": "...",
  "rideId": "...",
  "status": "success",
  "amount": 118.05,
  "currency": "INR",
  "timestamp": "..."
}
```

(`status` is lowercase here, matching this project's existing `ride_status_updated` convention from Day 6, rather than the uppercase `SUCCESS`/`FAILED` sometimes used in payment-gateway examples elsewhere.)

### No duplicated business logic

The controller only handles HTTP concerns (parse the request, call the service, shape the response). `payment.service.js` owns every business rule: ownership, ride-status gating, fare calculation, the payment state machine, idempotency, and the atomic concurrency-safe write. `paymentEventConsumer.js` never re-decides a payment's outcome — MongoDB already settled that before the event was even published; the consumer's only job is logging and relaying to Socket.IO. Nothing about payments lives in a route file or a socket handler.

### Failure handling

| Scenario | Behavior |
|---|---|
| Payment creation for a non-completed ride | `400`, no payment created |
| Payment creation by a non-owning rider | `403` |
| Simulated provider returns "failure" | Payment → `failed`, `failureReason` set; **ride status is untouched** (still `completed`) |
| Duplicate payment creation (same ride) | Returns the existing payment (`200`), never a second `Payment` document |
| `pay` on an already-`success`/`failed` payment | `409`, unless it's an idempotent replay of the exact same request |
| `pay` without an `Idempotency-Key` header | `400` |
| Kafka unavailable when publishing `payment.*` | Payment's MongoDB status is already committed and correct; the event is simply not published (logged, not thrown) — same documented tradeoff as Day 5's ride events, not a new one |
| Redis unavailable | Unrelated to payments entirely — Day 7 never reads or writes Redis |

### Testing the full flow end to end (Postman-style)

1. Login as a rider and a driver (Day 2); create the driver's profile, set `available` with a location (Day 3/4).
2. Create a ride, accept/start/complete it (Day 2/3) — the ride must reach `completed` before payment creation is allowed.
3. `POST /api/payments/:rideId` as the rider → `201`, inspect the returned `amount` (backend-calculated) and `status: "pending"`.
4. `GET /api/payments/:paymentId` → confirms the same `pending` payment.
5. `POST /api/payments/:paymentId/pay` with header `Idempotency-Key: test-key-1` and body `{ "result": "success" }` → `200`, `status: "success"`, `paidAt` populated.
6. `GET /api/payments/:paymentId` again → confirms `success` persisted.
7. Check the server log for `Event published: payment.success (...)`, or independently confirm with `kafka-console-consumer --topic payment-events --from-beginning`.
8. If a rider's socket had already `join_ride`'d this ride's room (Day 6), confirm it received `payment_status_updated` with `status: "success"`.
9. Repeat step 5 exactly (same `Idempotency-Key: test-key-1`, same body) → `200` again, with the **identical** `paidAt` — confirming idempotency, not a second charge.
10. Also test: `POST /api/payments/:paymentId/pay` with a *different* `Idempotency-Key` on this now-`success` payment → `409`; `POST /api/payments/:rideId` again for the same ride → `200` with the same payment id, not a new one; payment creation for a ride that isn't `completed` → `400`; payment creation/GET/pay as a rider who doesn't own the ride/payment → `403`; `pay` with no `Idempotency-Key` header → `400`.
11. For the failure branch, repeat steps 2–3 for a second ride, then `POST /:paymentId/pay` with body `{ "result": "failure" }` → `200`, `status: "failed"`, `failureReason` populated — and confirm `GET /api/rides/:rideId` still shows `status: "completed"` (payment failure never rolls back ride state).

## Scope

**Day 1** — Express server, MongoDB connection, env config, registration/login, bcrypt hashing, JWT auth, role-based authorization, driver profile + vehicle, driver availability, ride creation, ride retrieval with ownership checks, centralized validation and error handling.

**Day 2** — Full ride lifecycle: accept (driver + role/profile/availability checks), start and complete (assigned-driver-only), cancellation (rider or assigned driver, only while `requested`/`accepted`), the ride/driver-status synchronization table above, and the strict state machine enforced via `assertValidTransition`.

**Day 3** — Automatic nearby-driver matching on ride creation via MongoDB `$near`/`2dsphere` (advisory `matchedDriver`, not a hard assignment), driver location updates, `GET /api/rides/my-rides` with pagination, and an atomic `findOneAndUpdate`-based fix for the accept-race condition.

**Day 4** — Redis as a cache-aside layer for driver status (TTL + write-through invalidation) and a Redis GEO set for driver location, both sitting in front of Day 3's MongoDB queries as an optional fast path with automatic fallback on Redis failure. No new endpoints; matching remains advisory (same as Day 3) — Redis is not yet used for reservation/locking.

**Day 5** — Kafka event publishing (`ride.requested/accepted/started/completed/cancelled`) after every ride-lifecycle MongoDB write, a `ride-events` consumer that validates and logs each event asynchronously, and the project's first graceful-shutdown handler. Runs entirely without Docker. No new endpoints; events are purely an internal, API-invisible side effect.

**Day 6** — Socket.IO attached to the same HTTP server as Express; JWT-authenticated sockets; `join_ride`/`driver_location_update` client events with full ownership authorization; `ride_status_updated` broadcasts bridged from the Day 5 Kafka consumer; real-time driver location written to a new, ride-scoped Redis key (never MongoDB) and broadcast live; basic per-driver flood protection. Redis moved off Docker onto a native local process this session (see "Day 6 — Redis moved off Docker"). No new REST endpoints; sockets never duplicate ride-lifecycle business logic, only read state to authorize and write ephemeral location data.

**Day 7** — A dedicated `Payment` model (1:1 with `Ride` via a unique index), backend-only fare calculation (Haversine distance + duration from the ride's own timestamps), a `SimulatedPaymentProvider` behind a swappable `PaymentProvider` abstraction, a payment state machine (`pending → success|failed`, both terminal), header-based idempotency enforced in MongoDB (not Redis), the same atomic-conditional-update concurrency pattern as Day 3 applied to both payment creation and payment settlement, `payment.created/success/failed` Kafka events on their own topic/consumer, and `payment_status_updated` Socket.IO notifications bridged from that consumer into the existing ride room. No Razorpay; no real money; no changes to any Day 1–6 file's business logic.

**Intentionally not implemented yet** (see roadmap): Razorpay, retrying a failed payment, refunds/wallets/coupons/surge pricing, driver reservation/timeout/fallback-to-next-driver, transactional outbox, dead-letter topics, idempotent consumer/socket-event deduplication, Redis Socket.IO adapter / multi-server scaling, a real automated test framework, rate limiting, structured logging/observability, microservices.

## Architectural Decisions

- **`driver`/`rider` on `Ride` reference `User`, not `Driver`.** A ride is between two people; the `Driver` document only exists to hold driver-specific state (vehicle, availability, location) and isn't needed to identify who accepted the ride.
- **2dsphere indexes on `Driver.currentLocation` and `Ride` pickup/destination were added from Day 1**, before Redis GEO existed — this kept MongoDB queryable by location from the start and meant Day 4's Redis GEO set could be added purely as a fast-path optimization in front of an already-working MongoDB query, with the same fallback available on any Redis outage.
- **Ownership on `GET /api/rides/:id` is derived from `req.user` (JWT), never from a client-supplied ID** — this is the only way to make the 403 guarantee for "Rider A can't read Rider B's ride" actually hold. The same principle extends to Day 2: `accept`/`start`/`complete`/`cancel` all derive the actor's identity from `req.user`, never from a body field.
- **Day 2 uses Mongoose transactions for accept/complete/cancel-of-accepted**, since those operations must flip both `Ride` and `Driver` together. This relies on `MONGO_URI` pointing at a replica set (true for MongoDB Atlas); a lone standalone `mongod` would reject `startSession()`-based transactions.
- **A driver can only cancel a ride they've already accepted.** `ride.driver` is `null` before acceptance, so there's no way to distinguish "any driver" from "the right driver" for a still-`requested` ride — cancellation by a driver is scoped to rides they own, by design, not as an oversight.
- **Kafka events publish after, never before, the MongoDB write they describe** (Day 5) — see "Database first, then publish" above; the same principle Day 2–4 already applied to keeping MongoDB authoritative extends naturally to an event log.
- **Driver location during an active ride writes to Redis only, never MongoDB** (Day 6) — the write volume of a live GPS stream doesn't belong on a durable, disk-backed store; `Driver.currentLocation` in MongoDB stays a coarser, REST-driven snapshot instead. See "Why driver location bypasses MongoDB" above.
- **A ride's live-location Redis key is separate from Day 4's driver-matching geo set** (Day 6), so a busy driver's position (needed by their current rider) never has to fight with that set's "only available, matchable drivers" invariant.
- **`Payment` is a separate model from `Ride`, referenced one-way** (Day 7) — ride and payment lifecycles are independent state machines; a completed ride with a pending or failed payment is valid, expected state, not a contradiction to reconcile.
- **Payment idempotency keys live in MongoDB, on the `Payment` document itself, never in Redis** (Day 7) — financial correctness needs to survive exactly as reliably as the payment record it protects; Redis in this project is a cache for state that's safe to lose.
- **Payments go through a `PaymentProvider` abstraction from day one**, even with only one (simulated) implementation (Day 7) — so integrating a real gateway later is a new provider file plus a one-line `require` change, not a rewrite of the payment model, state machine, controller, routes, or event/notification wiring.

## Future Roadmap

- **Beyond Day 7** — A real Razorpay integration behind the existing `PaymentProvider` abstraction; retrying a failed payment (needs a considered redesign of the current permanent 1:1 `Ride`↔`Payment` relationship); a Redis-backed driver reservation (TTL hold + fallback to next-nearest on decline/timeout) to finally make matching a real assignment instead of advisory, now that Day 6's real-time layer can notify a held driver; a real automated test framework (Jest/Mocha) replacing the throwaway scripts used through every day of this build; structured logging, rate limiting, retry strategy, and observability; Docker packaging, if a concrete deployment target ever calls for it — every day of this build deliberately ran without it for local dev.
