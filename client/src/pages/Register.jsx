import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Phone, Lock, ArrowRight, Car, UserRound, Check } from "lucide-react";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../services/api";

const ROLES = [
  { value: "rider", label: "Rider", description: "Book rides and get around", icon: UserRound },
  { value: "driver", label: "Driver", description: "Drive and earn on your schedule", icon: Car },
];

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "rider" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // Mirrors server/src/routes/auth.routes.js's express-validator rules
  // exactly, so a user sees a mistake before the round trip instead of
  // after — the backend still re-validates independently either way.
  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address";
    if (!/^[0-9]{10}$/.test(form.phone)) next.phone = "Phone number must be a valid 10-digit number";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await register(form);
      showToast(`Welcome to RideSync, ${user.name.split(" ")[0]}!`, "success");
      navigate(`/${user.role}`);
    } catch (err) {
      showToast(getErrorMessage(err, "Registration failed. Please try again."), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Join RideSync as a rider or a driver.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">I want to</span>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((role) => {
                  const isSelected = form.role === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => update("role", role.value)}
                      className={`relative rounded-xl border-2 p-3.5 text-left transition-colors ${
                        isSelected ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <role.icon className={`h-5 w-5 ${isSelected ? "text-brand-600" : "text-slate-400"}`} />
                      <p className={`mt-2 text-sm font-bold ${isSelected ? "text-brand-700" : "text-slate-800"}`}>{role.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{role.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Full name"
              icon={User}
              autoComplete="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              error={errors.name}
              placeholder="Jordan Rivera"
            />
            <Input
              label="Email"
              type="email"
              icon={Mail}
              autoComplete="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
            />
            <Input
              label="Phone number"
              icon={Phone}
              autoComplete="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              error={errors.phone}
              placeholder="9876543210"
            />
            <Input
              label="Password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              error={errors.password}
              placeholder="At least 6 characters"
            />

            <Button type="submit" fullWidth loading={loading} icon={ArrowRight}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
