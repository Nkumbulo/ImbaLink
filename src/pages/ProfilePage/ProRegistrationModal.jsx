import { useEffect, useRef, useState } from "react";
import { Camera, Check, Crown, X } from "lucide-react";
import { T } from "../../styles/tokens";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { GOLD, resolveIdentity } from "./constants";

const PRO_PLAN = { id: "monthly", label: "Pro", price: "$10/month" };

const PRO_ROLE_CONTENT = {
  tenant: {
    title: "Tenant Pro",
    subtitle: "Build trust before you contact landlords.",
    badge: "Verified Renter",
    benefits: [
      "A verified renter badge appears on your profile and enquiries.",
      "Landlords can see that your identity has been verified before responding.",
      "Stand out from unverified enquiries and make your profile more trustworthy.",
    ],
    idLabel: "Government-issued picture ID",
    idHelp: "Upload a clear photo of your national ID, passport or driver's licence.",
    details: "We'll use your ID to verify that you are a real person and match your account details.",
  },
  landlord: {
    title: "Landlord Pro",
    subtitle: "Show tenants that your property account is genuine.",
    badge: "Verified Landlord",
    benefits: [
      "A verified landlord badge gives tenants more confidence when viewing your listings.",
      "Help genuine property owners stand out from unverified accounts.",
      "Build trust when tenants enquire, request viewings or contact you.",
    ],
    idLabel: "Government-issued picture ID",
    idHelp: "Upload a clear photo of your national ID, passport or driver's licence.",
    details: "Your identity is checked against your landlord account details before the badge is issued.",
  },
  agent: {
    title: "Agent Pro",
    subtitle: "Give clients confidence that they are dealing with a verified property professional.",
    badge: "Verified Agent",
    benefits: [
      "A verified agent badge helps clients identify trusted property professionals.",
      "Make your profile and property enquiries more credible.",
      "Build confidence before clients share information or arrange viewings.",
    ],
    idLabel: "Government-issued picture ID",
    idHelp: "Upload a clear photo of your national ID, passport or driver's licence.",
    details: "Your identity is verified against your agent account before your verified badge is activated.",
  },
  company: {
    title: "Company Pro",
    subtitle: "Verify the person behind the company account and strengthen business trust.",
    badge: "Verified Company",
    benefits: [
      "A verified company badge helps customers recognise a genuine business account.",
      "Increase trust when managing listings, enquiries and client relationships.",
      "Show that the company account has completed Imbalink's verification process.",
    ],
    idLabel: "Authorised representative's picture ID",
    idHelp: "Upload a clear photo of the ID of the person authorised to represent this company.",
    details: "The authorised representative's identity is checked before the company verified badge is issued.",
  },
  contractor: {
    title: "Contractor Pro",
    subtitle: "Show property owners that your service account is genuine.",
    badge: "Verified Contractor",
    benefits: [
      "A verified contractor badge helps property owners identify trusted service providers.",
      "Stand out when responding to maintenance and property-service requests.",
      "Build confidence before customers arrange work with you.",
    ],
    idLabel: "Government-issued picture ID",
    idHelp: "Upload a clear photo of your national ID, passport or driver's licence.",
    details: "Your identity is verified against your contractor account before the badge is activated.",
  },
};

function getProRole(profile, accountLabel) {
  const label = typeof accountLabel === "string" ? accountLabel : "";
  if (label.startsWith("Company")) return "company";
  if (label.startsWith("Agent")) return "agent";
  if (label.startsWith("Landlord")) return "landlord";
  if (label.startsWith("Contractor")) return "contractor";
  return "tenant";
}

function ProRegistrationModal({ profile, user, accountLabel, onClose, onSubmit }) {
  useBodyScrollLock(true);
  const { name: resolvedName } = resolveIdentity(profile, user);
  const role = getProRole(profile, accountLabel);
  const content = PRO_ROLE_CONTENT[role] || PRO_ROLE_CONTENT.tenant;

  const [fullName, setFullName] = useState(resolvedName || "");
  const [email, setEmail] = useState(profile?.email || user?.email || "");
  const [phone, setPhone] = useState(profile?.phone || user?.phone || "");
  const [idFile, setIdFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(raf);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!fullName && resolvedName) setFullName(resolvedName);
    if (!email && (profile?.email || user?.email)) setEmail(profile?.email || user?.email || "");
    if (!phone && (profile?.phone || user?.phone)) setPhone(profile?.phone || user?.phone || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  const handleClose = () => {
    setVisible(false);
    closeTimerRef.current = setTimeout(onClose, 280);
  };

  const canSubmit = fullName.trim() && email.trim() && idFile && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        accountType: role,
        verificationDocument: idFile,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || "Could not submit your registration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] sm:z-50 flex items-end sm:items-center justify-center form-modal-backdrop"
      style={{
        background: "rgba(0,0,0,.5)",
        opacity: visible ? 1 : 0,
        transition: "opacity .28s ease",
      }}
    >
      <div
        className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 form-modal-panel"
        style={{
          background: T.paper,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform .32s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {done ? (
          <div className="py-6 flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: `${GOLD}1F` }}>
              <Check size={26} style={{ color: GOLD }} />
            </span>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>
              Verification submitted
            </div>
            <div className="f-body mt-1.5" style={{ color: T.ink60, fontSize: 12.5 }}>
              Your {content.badge} request is being reviewed. Your badge will appear once verification is approved.
            </div>
            <button
              onClick={handleClose}
              className="w-full mt-6 f-body font-semibold px-4 py-3 rounded-xl"
              style={{ background: T.ink, color: T.paper, fontSize: 13 }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}1F` }}>
                  <Crown size={16} style={{ color: GOLD }} />
                </span>
                <div>
                  <div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>
                    {content.title}
                  </div>
                  <div className="f-mono" style={{ color: GOLD, fontSize: 9, letterSpacing: ".06em" }}>
                    {content.badge.toUpperCase()}
                  </div>
                </div>
              </div>
              <button onClick={handleClose} style={{ color: T.ink60 }}>
                <X size={18} />
              </button>
            </div>

            <div className="f-body mt-3 mb-4" style={{ color: T.ink60, fontSize: 12.5 }}>
              {content.subtitle}
            </div>

            <div
              className="rounded-2xl p-3.5 mb-4"
              style={{ background: T.paperDim }}
            >
              <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 13 }}>
                Why get verified?
              </div>
              <ul className="mt-2 space-y-2">
                {content.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 f-body" style={{ color: T.ink, fontSize: 11.5 }}>
                    <Check size={13} style={{ color: GOLD, marginTop: 1, flexShrink: 0 }} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-2xl p-3.5 mb-4 flex items-start gap-3"
              style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}30` }}
            >
              <Camera size={18} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 12.5 }}>
                  Identity verification required
                </div>
                <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 11.5 }}>
                  {content.details}
                </div>
              </div>
            </div>

            <div
              className="rounded-xl p-3 mb-4"
              style={{ background: T.paperDim }}
            >
              <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12 }}>
                Pro membership
              </div>
              <div className="f-body mt-0.5" style={{ color: T.ink60, fontSize: 11 }}>
                {PRO_PLAN.price} · Includes your {content.badge} verification process.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full f-body px-3.5 py-3 rounded-xl outline-none"
                style={{ background: T.paperDim, color: T.ink, fontSize: 13 }}
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email address"
                required
                className="w-full f-body px-3.5 py-3 rounded-xl outline-none"
                style={{ background: T.paperDim, color: T.ink, fontSize: 13 }}
              />

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="Phone number (optional)"
                className="w-full f-body px-3.5 py-3 rounded-xl outline-none"
                style={{ background: T.paperDim, color: T.ink, fontSize: 13 }}
              />

              <label
                className="block rounded-xl p-3.5 cursor-pointer"
                style={{ background: T.paperDim, border: `1px dashed ${T.ink60}55` }}
              >
                <div className="flex items-center gap-2">
                  <Camera size={17} style={{ color: GOLD }} />
                  <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12.5 }}>
                    {content.idLabel}
                  </div>
                </div>
                <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 10.5 }}>
                  {content.idHelp}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  className="w-full mt-3 f-body"
                  required
                  style={{ color: T.ink60, fontSize: 11 }}
                />
                {idFile && (
                  <div className="f-body mt-2 font-semibold" style={{ color: T.ink, fontSize: 10.5 }}>
                    Selected: {idFile.name}
                  </div>
                )}
              </label>

              {error && (
                <div
                  className="rounded-xl p-3 f-body"
                  style={{ background: "rgba(184,61,49,.1)", color: T.brick, fontSize: 10.5 }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full f-body font-semibold px-4 py-3.5 rounded-xl mt-1"
                style={{ background: T.ink, color: T.paper, fontSize: 13, opacity: canSubmit ? 1 : 0.5 }}
              >
                {submitting ? "Submitting…" : `Start ${content.badge} verification`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ProRegistrationModal;
