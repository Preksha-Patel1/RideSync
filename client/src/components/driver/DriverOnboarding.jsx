import { useState } from "react";
import { Car, ArrowRight } from "lucide-react";
import Input from "../Input";
import Button from "../Button";
import * as driverApi from "../../services/driverApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "auto", label: "Auto" },
  { value: "car", label: "Car" },
];

// Shown when GET /api/drivers/me returns 404 — this driver hasn't created a
// Driver+Vehicle profile yet (server/src/services/driver.service.js
// requires exactly this before any status/location/accept action works).
export default function DriverOnboarding({ onComplete }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ vehicleType: "car", brand: "", model: "", registrationNumber: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.brand.trim()) next.brand = "Brand is required";
    if (!form.model.trim()) next.model = "Model is required";
    if (!form.registrationNumber.trim()) next.registrationNumber = "Registration number is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await driverApi.createDriverProfile(form);
      onComplete(res.data.data.driver);
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't create your driver profile."), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Car className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Set up your driver profile</h1>
        <p className="mt-1 text-sm text-slate-500">Add your vehicle details to start receiving ride requests.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Vehicle type</span>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => update("vehicleType", type.value)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                    form.vehicleType === type.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Brand" value={form.brand} onChange={(e) => update("brand", e.target.value)} error={errors.brand} placeholder="Toyota" />
          <Input label="Model" value={form.model} onChange={(e) => update("model", e.target.value)} error={errors.model} placeholder="Etios" />
          <Input
            label="Registration number"
            value={form.registrationNumber}
            onChange={(e) => update("registrationNumber", e.target.value.toUpperCase())}
            error={errors.registrationNumber}
            placeholder="GJ01AB1234"
          />

          <Button type="submit" fullWidth loading={submitting} icon={ArrowRight}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
