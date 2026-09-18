import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import { backend } from "../../application/backend";
import { T } from "../../styles/tokens";

const CATEGORIES = [
  ["bug", "Something is broken"],
  ["listing", "Problem with a listing"],
  ["account", "Account or sign-in issue"],
  ["messages", "Messages or notifications"],
  ["payment", "Payment / Pro issue"],
  ["abuse", "Harassment, scam or abuse"],
  ["other", "Something else"],
];

export default function ReportProblemModal({ onClose }) {
  const [category, setCategory] = useState("bug");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (details.trim().length < 10) {
      setError("Please describe the problem in a little more detail.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await backend.supportRepository.submitSupportRequest({
        kind: "problem",
        category,
        message: details.trim(),
        contact: contact.trim(),
        pageContext: window.location?.pathname || null,
      });
      setSent(true);
    } catch {
      setError("We couldn't send your report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(10,18,14,.46)" }}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-auto rounded-t-[24px] sm:rounded-[22px]" style={{ background: T.paper, color: T.ink, boxShadow: "0 25px 80px rgba(20,32,26,.28)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div><div className="f-mono" style={{ fontSize: 9, color: T.ink60, letterSpacing: ".12em" }}>IMBALINK SUPPORT</div><h2 className="f-display font-bold" style={{ fontSize: 20, marginTop: 3 }}>Report a problem</h2></div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 11, border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink60 }}><X size={17}/></button>
        </div>
        {sent ? (
          <div className="p-7 text-center">
            <CheckCircle2 size={42} style={{ color: T.themeGreen || "#2F7A55", margin: "0 auto 12px" }}/>
            <h3 className="f-display font-bold" style={{ fontSize: 19 }}>Thanks — we received it.</h3>
            <p className="f-body" style={{ color: T.ink60, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>Our team can use your report to investigate bugs, listing problems and safety issues.</p>
            <button onClick={onClose} className="mt-5 w-full py-3 rounded-xl font-semibold" style={{ background: T.ink, color: T.paper }}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div><label className="f-body font-semibold" style={{ fontSize: 12 }}>What happened?</label><div className="relative mt-2"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full appearance-none rounded-xl px-3.5 py-3 pr-10" style={{ border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, fontSize: 12 }}>{CATEGORIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronDown size={15} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: T.ink60 }}/></div></div>
            <div><label className="f-body font-semibold" style={{ fontSize: 12 }}>Tell us what went wrong</label><textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={2000} rows={6} placeholder="Include what you were doing, what you expected, and what happened instead." className="mt-2 w-full rounded-xl px-3.5 py-3 resize-none" style={{ border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, fontSize: 12, outline: "none" }}/></div>
            <div><label className="f-body font-semibold" style={{ fontSize: 12 }}>Contact details <span style={{ color: T.ink60, fontWeight: 400 }}>(optional)</span></label><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Email or phone" className="mt-2 w-full rounded-xl px-3.5 py-3" style={{ border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, fontSize: 12 }}/></div>
            <div className="flex gap-2 items-start rounded-xl p-3" style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5, lineHeight: 1.5 }}><AlertTriangle size={15} style={{ flex: "0 0 auto", color: T.brick }}/><span>For an immediate safety threat, do not wait for an app response. Move to a safe place and contact local emergency services.</span></div>
            {error && <div role="alert" style={{ color: T.brick, fontSize: 11 }}>{error}</div>}
            <button disabled={busy} type="submit" className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: T.ink, color: T.paper, opacity: busy ? .7 : 1 }}>{busy ? <><Loader2 size={15} className="animate-spin"/> Sending…</> : "Send report"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
