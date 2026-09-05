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

- **No real-time push of new ride requests to drivers.** The Day 1–7 backend never emits an event telling an
  available driver a ride exists — Kafka's `ride.requested` event only reaches a Socket.IO room
  (`ride:<rideId>`) that a driver can't join before learning the ID exists. The driver dashboard has a clearly
  labeled "Accept by Ride ID" fallback for this — it calls the real `PATCH /api/rides/:id/accept` endpoint,
  nothing is faked, only *how the driver learns the ID* is a manual stand-in. `useIncomingRideRequest` +
  `IncomingRideRequestModal` are fully built and would work immediately if the backend ever added a
  `new_ride_request` socket event.
- **No driver rating or per-ride vehicle info shown to riders.** `ride.driver`/`ride.rider` are populated from the
  `User` model only (name, email, phone) — there's no rating field anywhere in the backend, and vehicle details
  live on a separate `Driver`/`Vehicle` document not joined onto a ride. `PersonInfoCard` shows only what's real.
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
