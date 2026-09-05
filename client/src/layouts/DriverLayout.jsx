import { Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader";

const LINKS = [
  { to: "/driver", label: "Dashboard", end: true },
  { to: "/driver/history", label: "History" },
];

export default function DriverLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader links={LINKS} basePath="/driver" />
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
