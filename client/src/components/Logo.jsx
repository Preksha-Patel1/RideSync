import { Zap } from "lucide-react";

export default function Logo({ dark = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      <span className={dark ? "text-white" : "text-slate-900"}>RideSync</span>
    </div>
  );
}
