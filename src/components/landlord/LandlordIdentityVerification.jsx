import { getLandlordVerification, submitLandlordVerification } from '../../core/data/domains/registrations.js';
import { useEffect, useRef, useState } from "react";
import { X, ShieldCheck, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { T } from "../../styles/tokens";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
const MAX_ID_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function statusLabel(status) {
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

export default function LandlordIdentityVerification({ onClose, userId }) {
  useBodyScrollLock(true);
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await getLandlordVerification(userId);
        if (!active) return;
        setVerification(row);
        if (row?.phone) setPhone(row.phone);
      } catch (err) {
        if (active) setError(err?.message || "Could not load verification status.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const validate = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) return "Enter a valid phone number.";
    if (!file && verification?.verificationStatus !== "pending" && verification?.verificationStatus !== "verified") {
      return "Please upload a clear JPG, PNG or WebP image of your ID.";
    }
    if (!file && !verification) return "Please upload a clear JPG, PNG or WebP image of your ID.";
    if (file && !ALLOWED_TYPES.has(file.type)) return "ID image must be JPG, PNG or WebP.";
    if (file && file.size > MAX_ID_SIZE) return "ID image must be 5MB or smaller.";
    return "";
  };

  const handleFile = (next) => {
    setError("");
    setSuccess("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(next.type)) {
      setFile(null);
      setError("ID image must be JPG, PNG or WebP.");
      return;
    }
    if (next.size > MAX_ID_SIZE) {
      setFile(null);
      setError("ID image must be 5MB or smaller.");
      return;
    }
    setFile(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validate();
    if (validationError) return setError(validationError);
    if (!file) return setError("Please select an ID image before submitting.");

    setSubmitting(true);
    try {
      const row = await submitLandlordVerification({ phone, file });
      setVerification(row);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setSuccess("Identity submitted successfully. Your verification is now pending review.");
    } catch (err) {
      setError(err?.message || "Could not submit identity verification.");
    } finally {
      setSubmitting(false);
    }
  };

  const status = verification?.verificationStatus || "pending";
  const statusBg = status === "verified" ? "color-mix(in srgb, var(--theme-green) 12%, transparent)" : status === "rejected" ? "rgba(184,61,49,.10)" : "rgba(184,132,46,.12)";
  const statusColor = status === "verified" ? T.msasa : status === "rejected" ? T.brick : T.ochre;

  return (
    <div className="fixed inset-0 z-[1000] sm:z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 form-modal-backdrop" style={{ background: "rgba(20,32,26,.68)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-xl rounded-t-[28px] sm:rounded-[28px] p-5 form-modal-panel"
        style={{ background: T.paper, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: 19 }}>Verify Identity</div>
            <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 10.5 }}>
              Submit your phone number and ID image for landlord identity review.
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: T.paperDim }}>
            <X size={17} />
          </button>
        </div>

        <div className="rounded-2xl p-3.5 mb-4" style={{ background: statusBg }}>
          <div className="flex items-center gap-2">
            {status === "verified" ? <CheckCircle2 size={17} style={{ color: statusColor }} /> : status === "rejected" ? <AlertCircle size={17} style={{ color: statusColor }} /> : <ShieldCheck size={17} style={{ color: statusColor }} />}
            <span className="f-display font-semibold" style={{ color: statusColor, fontSize: 12 }}>
              Status: {statusLabel(status)}
            </span>
          </div>
          {verification?.reviewNote && (
            <div className="f-body mt-1.5" style={{ color: T.ink60, fontSize: 10.5 }}>{verification.reviewNote}</div>
          )}
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 f-body" style={{ color: T.ink60, fontSize: 11 }}>
            <Loader2 size={16} className="animate-spin" /> Loading verification status…
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="f-body font-semibold block mb-1.5" style={{ color: T.ink60, fontSize: 10 }}>PHONE NUMBER *</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+263 77 123 4567"
                className="w-full rounded-xl px-3 py-2.5 f-body outline-none"
                style={{ background: T.paperDim, color: T.ink, border: `1px solid ${T.line}`, fontSize: 12 }}
              />
            </label>

            <label className="block">
              <span className="f-body font-semibold block mb-1.5" style={{ color: T.ink60, fontSize: 10 }}>ID IMAGE * — JPG, PNG OR WEBP, MAX 5MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
                style={{ background: T.paperDim, border: `1px dashed ${T.line}` }}
              >
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(164,64,53,.10)", color: T.brick }}>
                  <Upload size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block f-body font-semibold truncate" style={{ color: T.ink, fontSize: 11.5 }}>
                    {file?.name || "Choose ID image"}
                  </span>
                  <span className="block f-body mt-0.5" style={{ color: T.ink60, fontSize: 10 }}>
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Use a clear photo or scan of your ID."}
                  </span>
                </span>
              </button>
            </label>

            {error && <div className="rounded-xl p-3 f-body" style={{ background: "rgba(184,61,49,.10)", color: T.brick, fontSize: 10.5 }}>{error}</div>}
            {success && <div className="rounded-xl p-3 f-body" style={{ background: "color-mix(in srgb, var(--theme-green) 10%, transparent)", color: T.msasa, fontSize: 10.5 }}>{success}</div>}

            {status === "verified" ? (
              <div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>
                Your identity is verified. No further submission is required.
              </div>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full f-display font-semibold flex items-center justify-center gap-2"
                style={{ background: T.brick, color: T.paper, fontSize: 13, opacity: submitting ? .65 : 1 }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><ShieldCheck size={16} /> Submit for verification</>}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
