import { useState } from "react";
import { ChevronRight, Flag, HelpCircle, LockKeyhole, MessageCircle, ShieldCheck, X } from "lucide-react";
import { T } from "../../styles/tokens";

const sections = [
  { id: "getting", title: "Getting started", icon: HelpCircle, items: [
    ["Finding a place", "Use Explore or Search to filter by city, price, bedrooms and property type. Open a listing to view photos, details, the map and the lister profile."],
    ["Saving & liking", "Use Save for properties you want to revisit and Like to show interest. Your saved and liked spaces are available from Profile."],
    ["Messaging", "Open a listing or Messages to contact a lister. Keep important arrangements inside ImbaLink so there is a conversation record."],
    ["Viewing requests", "Send a viewing request from a listing when you are interested. Check Messages for responses and keep agreed times clear."],
  ]},
  { id: "safety", title: "Stay safe", icon: ShieldCheck, items: [
    ["Never pay just because you're pressured", "Be cautious of urgent payment requests, deposits before a viewing, or deals that seem unusually cheap. Verify the property and person first."],
    ["Meet safely", "For a first meeting or viewing, tell someone where you are going, prefer a public or known location when practical, and avoid going alone if you feel unsafe."],
    ["Protect your documents", "Do not send passwords, one-time codes or unnecessary identity documents in chat. Share sensitive documents only through a legitimate verification flow."],
    ["Report suspicious behaviour", "Use Report a problem for scams, impersonation, harassment, suspicious listings or other behaviour that could put users at risk."],
  ]},
  { id: "trust", title: "Trust & verification", icon: LockKeyhole, items: [
    ["Verification badges", "A badge can help indicate that an account has completed an ImbaLink verification process. A badge is not a guarantee that every interaction or transaction is safe."],
    ["Check the listing", "Compare photos, location, price and description. Ask questions when important details are unclear and be cautious if someone asks you to move the conversation or payment elsewhere immediately."],
    ["Admin moderation", "ImbaLink can review reports and account or listing issues. Reporting early gives the moderation team more information to act on."],
  ]},
  { id: "privacy", title: "Privacy & account", icon: LockKeyhole, items: [
    ["Keep your account secure", "Use a strong password, protect sign-in codes and sign out on devices you no longer use."],
    ["Notifications", "Control notification and sound preferences from Profile → Notification preferences. ImbaTone is ImbaLink's default notification sound."],
    ["Google sign-in", "If Google sign-in behaves unexpectedly, make sure your browser allows the authentication redirect and try again from a stable connection."],
  ]},
];

export default function HelpSafetyModal({ onClose, onReport }) {
  const [open, setOpen] = useState("getting");
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(10,18,14,.46)" }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-[24px] sm:rounded-[22px] flex flex-col" style={{ background: T.paper, color: T.ink, boxShadow: "0 25px 80px rgba(20,32,26,.28)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div><div className="f-mono" style={{ fontSize: 9, color: T.ink60, letterSpacing: ".12em" }}>IMBALINK HELP CENTRE</div><h2 className="f-display font-bold" style={{ fontSize: 20, marginTop: 3 }}>Help & safety</h2></div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 11, border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink60 }}><X size={17}/></button>
        </div>
        <div className="overflow-auto p-4 sm:p-5 space-y-2">
          <div className="rounded-2xl p-4 mb-3" style={{ background: T.themeGreenSoft || T.paperDim, border: `1px solid ${T.line}` }}>
            <div className="flex items-start gap-3"><ShieldCheck size={19} style={{ color: T.themeGreen || "#2F7A55", flex: "0 0 auto" }}/><div><b style={{ fontSize: 12 }}>Your safety comes first.</b><p style={{ color: T.ink60, fontSize: 10.5, lineHeight: 1.5, marginTop: 4 }}>ImbaLink helps people discover properties and connect with listers. Always use your judgement before sharing information, visiting a property or sending money.</p></div></div>
          </div>
          {sections.map(({ id, title, icon: Icon, items }) => (
            <section key={id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
              <button type="button" onClick={() => setOpen(open === id ? "" : id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{ background: T.paperDim, color: T.ink }}><Icon size={16} style={{ color: T.themeGreen || "#2F7A55" }}/><span className="font-semibold" style={{ fontSize: 12, flex: 1 }}>{title}</span><ChevronRight size={15} style={{ color: T.ink60, transform: open === id ? "rotate(90deg)" : "none", transition: "transform .18s" }}/></button>
              {open === id && <div className="px-4 pb-3">{items.map(([heading, body]) => <div key={heading} className="py-3" style={{ borderTop: `1px solid ${T.line}` }}><div style={{ fontSize: 11.5, fontWeight: 700 }}>{heading}</div><p style={{ fontSize: 10.5, color: T.ink60, lineHeight: 1.55, marginTop: 4 }}>{body}</p></div>)}</div>}
            </section>
          ))}
          <div className="pt-2 grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={onReport} className="rounded-xl px-4 py-3 flex items-center gap-2 text-left" style={{ background: T.paperDim, border: `1px solid ${T.line}`, color: T.ink }}><Flag size={16}/><span><b style={{ display: "block", fontSize: 11.5 }}>Report a problem</b><small style={{ color: T.ink60 }}>Tell us about a bug, scam or issue.</small></span></button>
            <button type="button" onClick={onReport} className="rounded-xl px-4 py-3 flex items-center gap-2 text-left" style={{ background: T.paperDim, border: `1px solid ${T.line}`, color: T.ink }}><MessageCircle size={16}/><span><b style={{ display: "block", fontSize: 11.5 }}>Contact support</b><small style={{ color: T.ink60 }}>Send a support request directly from ImbaLink.</small></span></button>
          </div>
        </div>
      </div>
    </div>
  );
}
