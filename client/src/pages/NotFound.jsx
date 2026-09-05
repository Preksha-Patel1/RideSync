import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import Button from "../components/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
