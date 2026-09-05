import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo dark />
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              RideSync is a learning-oriented ride-hailing platform built to demonstrate real backend and
              system-design fundamentals — matching, geospatial queries, caching, event streaming, real-time
              communication, and simulated payments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-white">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Account</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="/login" className="hover:text-white">Log in</a></li>
                <li><a href="/register" className="hover:text-white">Create account</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Built with</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>Node.js &amp; Express</li>
                <li>MongoDB &amp; Redis</li>
                <li>Kafka &amp; Socket.IO</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} RideSync. A portfolio/learning project — not a real ride-hailing service.
        </div>
      </div>
    </footer>
  );
}
