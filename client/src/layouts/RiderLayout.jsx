import { Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader";

const LINKS = [
  { to: "/rider", label: "Dashboard", end: true },
  { to: "/rider/history", label: "History" },
];

export default function RiderLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader links={LINKS} basePath="/rider" />
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
