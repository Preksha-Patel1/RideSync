import { useCallback, useState } from "react";

// Wraps the browser Geolocation API for the one honest source of "real"
// coordinates this app has, given the project deliberately avoids paid map
// APIs (see MapView.jsx) — used to seed the rider's pickup point and the
// driver's live location. Consumers decide what to do with a denial
// (RideSync falls back to a fixed demo-city center, never fabricates a
// precise location).
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Unable to retrieve your location");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return { coords, error, loading, requestLocation };
}
