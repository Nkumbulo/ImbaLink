import { useState, useCallback } from "react";
import { X, CheckCircle2, ChevronRight } from "lucide-react";
import { T } from "../../styles/tokens";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const CATEGORIES = ["Plumbing & Water","Electrical","Building & Renovation","Security","Cleaning & Maintenance","Painting & Decorating","Carpentry & Joinery","Roofing","Solar & Backup Power","Landscaping & Gardening","Appliance Repair","Other"];
const YEARS = ["Less than 1 year","1–2 years","3–5 years","6–10 years","10+ years"];
const AREAS = ["Harare CBD","Avondale","Borrowdale","Chisipite","Eastlea","Greendale","Hatfield","Highlands","Mbare","Mount Pleasant","Newlands","Westgate","Westlea","Other Harare areas"];
const SERVICES = ["Repairs","Installations","Maintenance","Renovations","Inspections","Emergency call-outs","Consultation","Supply of materials"];

// ⬇️ Move Field outside the component
const Field = ({ label, children }) => (
  <label className="block">
    <span className="f-body font-semibold block mb-1.5" style={{ color: T.ink60, fontSize: 10 }}>
      {label}
    </span>
    {children}
  </label>
);

export default function ContractorRegistration({ onClose, onSubmit, profile }) {
  useBodyScrollLock(true);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: `${profile?.firstName || ""} ${profile?.surname || ""}`.trim(),
    businessName: "",
    phone: profile?.phone || "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    category: "",
    services: [],
    city: "Harare",
    areas: [],
    yearsExperience: "",
    businessAddress: "",
    registrationNumber: "",
    licenseNumber: "",
    taxNumber: "",
    idType: "National ID",
    idNumber: "",
    description: "",
    emergencyService: false,
    acceptsQuotes: true,
    agreesTerms: false,
  });

  const update = useCallback((k, v) => setForm((prev) => ({ ...prev, [k]: v })), []);
  const toggle = useCallback((k, v) => {
    setForm((prev) => ({
      ...prev,
      [k]: prev[k].includes(v)
        ? prev[k].filter((x) => x !== v)
        : [...prev[k], v],
    }));
  }, []);

  const next = () => {
    setError("");
    if (step === 1 && (!form.fullName.trim() || !form.businessName.trim() || !form.phone.trim() || !form.email.trim()))
      return setError("Complete your personal and business contact details.");
    if (step === 1 && !form.username.trim()) return setError("Choose a username for your pro login.");
    if (step === 1 && (!form.password || form.password.length < 6)) return setError("Password must be at least 6 characters.");
    if (step === 1 && form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (step === 2 && (!form.category || !form.services.length || !form.yearsExperience || !form.areas.length))
      return setError("Select your trade, services, experience and service areas.");
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.agreesTerms) return setError("You must confirm the registration declaration.");
    const { confirmPassword: _confirmPassword, ...payload } = form;
    try {
      await onSubmit({
        ...payload,
        fullName: form.fullName.trim(),
        businessName: form.businessName.trim(),
        description: form.description.trim(),
        username: form.username.trim(),
      });
    } catch (err) {
      setError(err?.message || "Could not complete contractor registration.");
    }
  };

  const inputClass = "w-full rounded-xl px-3 py-2.5 f-body outline-none";
  const inputStyle = { background: T.paperDim, color: T.ink, border: `1px solid ${T.line}`, fontSize: 12 };

  return (
    <div className="fixed inset-0 z-[1000] sm:z-50 flex items-end sm:items-center justify-center form-modal-backdrop" style={{ background: "rgba(20,32,26,.68)" }}>
      <form onSubmit={submit} className="w-full sm:max-w-xl rounded-t-[28px] sm:rounded-[28px] p-5 form-modal-panel" style={{ background: T.paper, maxHeight: "92%", overflowY: "auto" }}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: 18 }}>Register as a contractor</div>
            <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 10.5 }}>Your profile is reviewed before the verified badge is issued.</div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: T.paperDim }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-1.5 rounded-full flex-1" style={{ background: n <= step ? T.brick : T.line }} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <Field label="FULL NAME *">
              <input className={inputClass} style={inputStyle} name="fullName" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your legal/full name" />
            </Field>
            <Field label="BUSINESS / TRADING NAME *">
              <input className={inputClass} style={inputStyle} name="businessName" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="e.g. Moyo Plumbing & Solar" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PHONE *">
                <input className={inputClass} style={inputStyle} name="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+263..." />
              </Field>
              <Field label="EMAIL *">
                <input type="email" className={inputClass} style={inputStyle} name="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
              </Field>
            </div>
            <Field label="BUSINESS ADDRESS">
              <input className={inputClass} style={inputStyle} name="businessAddress" value={form.businessAddress} onChange={(e) => update("businessAddress", e.target.value)} placeholder="Business / operating address" />
            </Field>
            <div className="f-mono" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".08em" }}>ACCOUNT LOGIN</div>
            <Field label="USERNAME *">
              <input className={inputClass} style={inputStyle} name="username" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="Choose a username" autoComplete="username" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PASSWORD *">
                <input type="password" className={inputClass} style={inputStyle} name="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              </Field>
              <Field label="CONFIRM PASSWORD *">
                <input type="password" className={inputClass} style={inputStyle} name="confirmPassword" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Field label="PRIMARY TRADE *">
              <select className={inputClass} style={inputStyle} name="category" value={form.category} onChange={(e) => update("category", e.target.value)}>
                <option value="">Select trade</option>
                {CATEGORIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="SERVICES YOU PROVIDE *">
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((x) => (
                  <label key={x} className="flex gap-2 items-center p-2.5 rounded-xl" style={{ background: T.paperDim, fontSize: 10.5, color: T.ink }}>
                    <input type="checkbox" name={`service-${x}`} checked={form.services.includes(x)} onChange={() => toggle("services", x)} />
                    {x}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="EXPERIENCE *">
              <select className={inputClass} style={inputStyle} name="yearsExperience" value={form.yearsExperience} onChange={(e) => update("yearsExperience", e.target.value)}>
                <option value="">Select experience</option>
                {YEARS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="SERVICE AREAS *">
              <div className="flex flex-wrap gap-1.5">
                {AREAS.map((x) => (
                  <button type="button" key={x} onClick={() => toggle("areas", x)} className="px-2.5 py-1.5 rounded-full f-body" style={{ background: form.areas.includes(x) ? T.jacaranda : T.paperDim, color: form.areas.includes(x) ? T.paper : T.ink, fontSize: 9.5 }}>
                    {x}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl p-3" style={{ background: T.paperDim }}>
              <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 11 }}>Verification information</div>
              <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 10 }}>Supply identifiers you have. Missing numbers can be left blank and will be reviewed manually.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID TYPE">
                <select className={inputClass} style={inputStyle} name="idType" value={form.idType} onChange={(e) => update("idType", e.target.value)}>
                  <option>National ID</option>
                  <option>Passport</option>
                  <option>Driver's Licence</option>
                </select>
              </Field>
              <Field label="ID NUMBER">
                <input className={inputClass} style={inputStyle} name="idNumber" value={form.idNumber} onChange={(e) => update("idNumber", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BUSINESS REG. NO.">
                <input className={inputClass} style={inputStyle} name="registrationNumber" value={form.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} />
              </Field>
              <Field label="LICENCE NO.">
                <input className={inputClass} style={inputStyle} name="licenseNumber" value={form.licenseNumber} onChange={(e) => update("licenseNumber", e.target.value)} />
              </Field>
            </div>
            <Field label="TAX / ZIMRA NUMBER">
              <input className={inputClass} style={inputStyle} name="taxNumber" value={form.taxNumber} onChange={(e) => update("taxNumber", e.target.value)} />
            </Field>
            <Field label="PROFILE DESCRIPTION">
              <textarea rows="4" className={inputClass} style={inputStyle} name="description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Tell customers what makes your service reliable." />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-2xl p-4" style={{ background: T.paperDim }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={17} style={{ color: T.msasa }} />
                <span className="f-display font-semibold" style={{ color: T.ink, fontSize: 13 }}>Final registration checks</span>
              </div>
              <div className="f-body mt-3 space-y-2" style={{ color: T.ink60, fontSize: 10.5 }}>
                <div>✓ Accurate contact and business information</div>
                <div>✓ Correct trade and services selected</div>
                <div>✓ Service areas and experience supplied</div>
                <div>✓ Verification identifiers supplied where available</div>
                <div>✓ Profile is verified and ready to appear in the app</div>
              </div>
            </div>
            <label className="flex gap-2.5 p-3 rounded-xl" style={{ background: T.paperDim }}>
              <input type="checkbox" name="emergencyService" checked={form.emergencyService} onChange={(e) => update("emergencyService", e.target.checked)} />
              <span className="f-body" style={{ fontSize: 11, color: T.ink }}>I accept emergency/service call-out requests.</span>
            </label>
            <label className="flex gap-2.5 p-3 rounded-xl" style={{ background: T.paperDim }}>
              <input type="checkbox" name="acceptsQuotes" checked={form.acceptsQuotes} onChange={(e) => update("acceptsQuotes", e.target.checked)} />
              <span className="f-body" style={{ fontSize: 11, color: T.ink }}>I am available to receive quote requests.</span>
            </label>
            <label className="flex gap-2.5 p-3 rounded-xl" style={{ background: T.paperDim }}>
              <input type="checkbox" name="agreesTerms" checked={form.agreesTerms} onChange={(e) => update("agreesTerms", e.target.checked)} />
              <span className="f-body" style={{ fontSize: 11, color: T.ink }}>I confirm that the information supplied is accurate and I agree to ImbaLink's contractor rules.</span>
            </label>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl p-3 f-body" style={{ background: "rgba(184,61,49,.1)", color: T.brick, fontSize: 10.5 }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="px-5 py-3 rounded-full f-body font-semibold" style={{ background: T.paperDim, color: T.ink, fontSize: 11 }}>
              Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={next} className="flex-1 py-3 rounded-full f-display font-semibold flex justify-center items-center gap-2" style={{ background: T.brick, color: T.paper, fontSize: 12 }}>
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button type="submit" className="flex-1 py-3 rounded-full f-display font-semibold" style={{ background: T.brick, color: T.paper, fontSize: 12 }}>
              Submit contractor registration
            </button>
          )}
        </div>
      </form>
    </div>
  );
}