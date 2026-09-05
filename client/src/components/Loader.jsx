import { Loader2 } from "lucide-react";

export default function Loader({ label = "Loading...", fullScreen = false, size = "md" }) {
  const sizeClass = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-6 w-6";

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className={`${sizeClass} animate-spin text-brand-500`} aria-hidden="true" />
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="flex min-h-[60vh] w-full items-center justify-center">{content}</div>;
  }

  return content;
}
