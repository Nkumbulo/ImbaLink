import { useState, useCallback } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { X, CheckCircle2 } from "lucide-react";
import { T } from "../../styles/tokens";

// Move F outside to prevent recreation on each render
const Field = ({ label, children }) => (
  <label className="block">
    <span className="f-body font-semibold block mb-1.5" style={{ color: T.ink60, fontSize: 10 }}>
      {label}
    </span>
    {children}
  </label>
);

export default function LandlordRegistration({ onClose, onSubmit, profile }) {
  useBodyScrollLock(true);
  const [form, setForm] = useState({
    fullName: `${profile?.firstName || ""} ${profile?.surname || ""}`.trim(),
    phone: profile?.phone || "",
    email: "",
    idType: "National ID",
    idNumber: "",
    address: "",
    landlordType: "Property owner",
    companyName: "",
    companyRegistration: "",
    username: "",
    password: "",
    confirmPassword: "",
    agreesTerms: false,
  });
  const [error, setError] = useState("");

  // Stabilize the updater with useCallback (optional but good practice)
  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const inputClass = "w-full rounded-xl px-3 py-2.5 f-body outline-none";
  const inputStyle = {
    background: T.paperDim,
    color: T.ink,
    border: `1px solid ${T.line}`,
    fontSize: 12,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validation remains the same
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim() || !form.idNumber.trim())
      return setError("Complete the required identity and contact fields.");
    if (!form.username.trim()) return setError("Choose a username for your landlord login.");
    if (!form.password || form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!form.agreesTerms) return setError("Confirm that you have the legal right to list the properties you submit.");

    const { confirmPassword: _confirmPassword, ...payload } = form;
    try {
      await onSubmit({
        ...payload,
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        verificationStatus: "verified",
      });
    } catch (err) {
      setError(err?.message || "Could not complete landlord registration.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] sm:z-50 flex items-end sm:items-center justify-center form-modal-backdrop"
      style={{ background: "rgba(20,32,26,.68)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-xl rounded-t-[28px] sm:rounded-[28px] p-5 form-modal-panel"
        style={{ background: T.paper, maxHeight: "90%", overflowY: "auto" }}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: 18 }}>
              Register as a landlord
            </div>
            <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 10.5 }}>
              Complete this once before publishing rental listings.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: T.paperDim }}
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-3.5">
          <Field label="FULL NAME *">
            <input
              className={inputClass}
              style={inputStyle}
              name="fullName"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="Legal name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="PHONE *">
              <input
                className={inputClass}
                style={inputStyle}
                name="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+263..."
              />
            </Field>
            <Field label="EMAIL *">
              <input
                type="email"
                className={inputClass}
                style={inputStyle}
                name="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          </div>

          <Field label="LANDLORD TYPE">
            <select
              className={inputClass}
              style={inputStyle}
              name="landlordType"
              value={form.landlordType}
              onChange={(e) => updateField("landlordType", e.target.value)}
            >
              <option>Property owner</option>
              <option>Property management company</option>
              <option>Authorized agent</option>
              <option>Family representative</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ID TYPE">
              <select
                className={inputClass}
                style={inputStyle}
                name="idType"
                value={form.idType}
                onChange={(e) => updateField("idType", e.target.value)}
              >
                <option>National ID</option>
                <option>Passport</option>
                <option>Driver's Licence</option>
              </select>
            </Field>
            <Field label="ID NUMBER *">
              <input
                className={inputClass}
                style={inputStyle}
                name="idNumber"
                value={form.idNumber}
                onChange={(e) => updateField("idNumber", e.target.value)}
              />
            </Field>
          </div>

          <Field label="CONTACT / RESIDENTIAL ADDRESS">
            <input
              className={inputClass}
              style={inputStyle}
              name="address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Address"
            />
          </Field>

          {form.landlordType !== "Property owner" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="COMPANY / AGENCY NAME">
                <input
                  className={inputClass}
                  style={inputStyle}
                  name="companyName"
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                />
              </Field>
              <Field label="REGISTRATION NO.">
                <input
                  className={inputClass}
                  style={inputStyle}
                  name="companyRegistration"
                  value={form.companyRegistration}
                  onChange={(e) => updateField("companyRegistration", e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="f-mono" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".08em" }}>
            ACCOUNT LOGIN
          </div>

          <Field label="USERNAME *">
            <input
              className={inputClass}
              style={inputStyle}
              name="username"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="PASSWORD *">
              <input
                type="password"
                className={inputClass}
                style={inputStyle}
                name="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Field>
            <Field label="CONFIRM PASSWORD *">
              <input
                type="password"
                className={inputClass}
                style={inputStyle}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div className="rounded-xl p-3" style={{ background: T.paperDim }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: T.msasa }} />
              <span className="f-body font-semibold" style={{ color: T.ink, fontSize: 11 }}>
                Listing rights check
              </span>
            </div>
            <div className="f-body mt-1.5" style={{ color: T.ink60, fontSize: 10 }}>
              Every property will still be reviewed separately for ownership/authority and listing accuracy.
            </div>
          </div>

          <label className="flex gap-2.5 p-3 rounded-xl" style={{ background: T.paperDim }}>
            <input
              type="checkbox"
              name="agreesTerms"
              checked={form.agreesTerms}
              onChange={(e) => updateField("agreesTerms", e.target.checked)}
            />
            <span className="f-body" style={{ fontSize: 11, color: T.ink }}>
              I confirm I own or am authorized to advertise properties I submit.
            </span>
          </label>
        </div>

        {error && (
          <div
            className="mt-3 rounded-xl p-3 f-body"
            style={{ background: "rgba(184,61,49,.1)", color: T.brick, fontSize: 10.5 }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-5 py-3.5 rounded-full f-display font-semibold"
          style={{ background: T.brick, color: T.paper, fontSize: 12.5 }}
        >
          Submit landlord registration
        </button>
      </form>
    </div>
  );
}