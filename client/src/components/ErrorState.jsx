import { AlertTriangle } from "lucide-react";
import Button from "./Button";

// The one place API/network failures get rendered — used instead of ever
// showing a raw error code or a blank screen (see getErrorMessage in
// services/api.js, which every page already normalizes its caught error
// through before passing `message` here).
export default function ErrorState({ message = "Something went wrong. Please try again.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-card">
        <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm font-medium text-rose-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
