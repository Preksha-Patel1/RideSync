# RideSync — Frontend (Day 8)

A React + Vite + Tailwind frontend for the RideSync backend (Days 1–7). Talks to the existing REST API and Socket.IO
server directly — no mock data, no fake API responses.

## Stack

- React 18 + Vite
- Tailwind CSS
- React Router v6
- Axios (with a JWT-attaching interceptor)
- socket.io-client
- lucide-react icons

## Setup

```bash
cd client
npm install
cp .env.example .env   # already provided for local dev — adjust if your backend runs elsewhere
npm run dev
```

The backend (`../server`) must be running first — see its own README for MongoDB/Redis/Kafka setup. This app talks
to `VITE_API_URL` (REST) and `VITE_SOCKET_URL` (Socket.IO) — both default to `http://localhost:5050` in `.env.example`.

## Structure

```text
src/
├── components/       # Reusable UI primitives + shared pieces (Button, Input, MapView, RideCard, ...)
│   ├── rider/        # Rider-only composite components (BookingPanel, ActiveRidePanel, PaymentPanel)
│   └── driver/       # Driver-only composite components (Onboarding, AvailabilityToggle, ...)
├── pages/            # Route-level screens
│   ├── rider/
│   └── driver/
├── layouts/          # RiderLayout / DriverLayout (shared header + outlet)
├── context/          # AuthContext (session + socket lifecycle), ToastContext
├── hooks/            # useSocketEvent, useJoinRideRoom, useLiveRide, useGeolocation, useIncomingRideRequest
├── services/         # api.js (axios), socket.js, and one file per backend domain (authApi, rideApi, ...)
└── utils/            # formatting + status-badge metadata
```

## Known Limitations (backend gaps, not frontend shortcuts)

- **Only the single nearest-matched driver gets a real-time request popup.** `POST /api/rides` picks one nearest
  candidate (`matching.service.js`, Day 3); `rideEventConsumer.js#notifyMatchedDriver` pushes `new_ride_request` to
  that one driver's personal room (`driver:<userId>`, auto-joined on connect — `config/socket.js`). It's still
  advisory, not a reservation (Day 3's design) — any available driver can accept. If nobody was in range at all,
  the rider's screen now says so explicitly ("No drivers available right now") instead of spinning forever — see
  `ride.matchedDriver` in `ActiveRidePanel`/`BookingPanel`. The driver dashboard's "Accept by Ride ID" card remains
  as a fallback: paste the ride's id (shown on the rider's screen) to accept it directly via the real, unmodified
  `PATCH /api/rides/:id/accept` endpoint.
- **The matched driver is usually simulated, not a real second session.** `scripts/seedDrivers.js` creates a handful
  of `Driver` documents flagged `isSimulated: true`; when one of those is the nearest match,
  `driverSimulationService.js` auto-accepts on their behalf 2-5 seconds later via the same `acceptRide` used by a
  real driver tapping Accept — a demo convenience so the rider flow is fully explorable solo. A real (non-simulated)
  matched driver is never auto-accepted; they keep the normal manual flow.
- **Driver rating and vehicle info are real, but only for drivers who have them.** `ride.driver` is enriched
  (`ride.service.js#populateRide`) with `rating`/`vehicle` from the separate `Driver`/`Vehicle` documents — seeded
  demo drivers always have both; a driver who completed onboarding without every field might not.
- **No "cancelled payment" state.** The backend's payment state machine is only `pending -> success | failed`
  (both terminal) — there is no cancelled status, so the UI doesn't build one either.
- **A failed payment cannot be retried.** `Payment` has a permanent 1:1 relationship with `Ride` (unique index), so
  a second `createPayment` call for the same ride just returns the already-failed payment. The failure screen
  reflects this honestly instead of offering a retry button that would 409.
- **Profile is read-only.** No update-profile endpoint exists on the backend for `User` or `Driver`.
- **No real map/geocoding provider.** `MapView` is a stylized placeholder (CSS/SVG, no external tiles) — pickup/
  destination coordinates come from the browser's Geolocation API or a tap on the placeholder, never fabricated.
  It's built behind a small, geography-shaped prop contract so a real provider (Mapbox, Google Maps,
  react-leaflet) could replace only that one file later.
