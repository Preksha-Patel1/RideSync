import { Link } from "react-router-dom";
import { Zap, MapPin, ShieldCheck, Radio, ArrowRight, Car, UserCheck, Navigation } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Button from "../components/Button";

const FEATURES = [
  {
    icon: Radio,
    title: "Fast Driver Matching",
    description: "Real-time geospatial matching finds the nearest available driver the moment you request a ride.",
  },
  {
    icon: MapPin,
    title: "Real-Time Ride Tracking",
    description: "Watch your driver's location update live from pickup to drop-off, powered by Socket.IO.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description: "A dedicated payment pipeline with idempotency protection so you're never charged twice.",
  },
  {
    icon: Zap,
    title: "Reliable Ride Management",
    description: "Every ride follows a strict, backend-enforced lifecycle — no invalid or duplicate state changes.",
  },
];

const STEPS = [
  { icon: Navigation, title: "Request a ride", description: "Drop a pin for your pickup and destination in seconds." },
  { icon: UserCheck, title: "Get matched with a driver", description: "We find the closest available driver near you." },
  { icon: Car, title: "Reach your destination", description: "Track your ride live and pay securely when you arrive." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px circle at 15% 20%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(500px circle at 85% 60%, rgba(79,70,229,0.25), transparent 55%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center lg:py-32">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-brand-300">
              <Zap className="h-3.5 w-3.5" /> Real-time ride matching
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your ride.
              <br />
              Your time.
              <br />
              <span className="text-brand-400">Your way.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              RideSync connects you with nearby drivers in seconds — live tracking, transparent pricing, and secure
              payments, all in one clean experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" fullWidth icon={ArrowRight} className="sm:w-auto">
                  Book a Ride
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="secondary" fullWidth className="border-white/15 bg-white/5 text-white hover:bg-white/10 sm:w-auto">
                  Drive with RideSync
                </Button>
              </Link>
            </div>
          </div>

          {/* Abstract mobility visual — CSS/SVG only, no external images */}
          <div className="relative hidden aspect-square items-center justify-center lg:flex">
            <div className="absolute h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative flex h-96 w-96 items-center justify-center rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="absolute inset-6 rounded-[2rem] border border-dashed border-white/10" />
              <div className="flex h-20 w-20 animate-pulse-soft items-center justify-center rounded-2xl bg-brand-600 shadow-soft">
                <Car className="h-10 w-10 text-white" />
              </div>
              <span className="absolute left-10 top-12 flex h-3 w-3 rounded-full bg-emerald-400" />
              <span className="absolute bottom-14 right-12 flex h-3 w-3 rounded-full bg-brand-300" />
              <span className="absolute bottom-24 left-16 h-2 w-2 rounded-full bg-white/40" />
              <span className="absolute right-16 top-24 h-2 w-2 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Built for a smoother ride</h2>
          <p className="mt-3 text-slate-500">Everything you need for a dependable ride-hailing experience.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">How it works</h2>
            <p className="mt-3 text-slate-500">Three simple steps from request to destination.</p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-soft">
                  <step.icon className="h-7 w-7" />
                </div>
                <span className="mt-4 block text-xs font-bold text-brand-500">STEP {index + 1}</span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-8 py-14 text-center sm:px-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: "radial-gradient(500px circle at 50% 0%, rgba(99,102,241,0.3), transparent 60%)" }}
          />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to ride with RideSync?</h2>
            <p className="mx-auto mt-3 max-w-md text-slate-300">Create your account and request your first ride in minutes.</p>
            <Link to="/register" className="mt-8 inline-block">
              <Button size="lg" icon={ArrowRight}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
