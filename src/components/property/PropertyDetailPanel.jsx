import { Suspense, lazy } from "react";
import { Bed, MapPin, Zap, Droplets, Car, ShieldCheck, HomeIcon, Check, Users, MessageCircle } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../common/Avatar";
import VerifiedBadge from "../common/VerifiedBadge";
import SegmentedTabs from "../common/SegmentedTabs";
import Receipt from "../common/Receipt";
import GridTile from "./GridTile";
import ContactRow from "./PropertyDetail/ContactRow";
import { formatDaysAgo } from "../../utils/formatters";
import { isShareableProperty } from "../../utils/studentHelpers";

const PropertyMap = lazy(() => import("./PropertyMap"));

const DETAIL_BG = "#FFFBF3";
const DETAIL_BORDER = "#E9DDD0";
const DETAIL_INK = "#1A1A1A";
const DETAIL_INK_SOFT = "#6B5B50";
const DETAIL_ACCENT = "#B85C38";
const DETAIL_ACCENT_DEEP = "#A05A32";
const DETAIL_ACCENT_ICON = "#4A3F8A";
const DETAIL_SUCCESS = "#12B76A";
const DETAIL_PILL_BG = "#EFE7D6";

function AmenityPill({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5" style={{ background: DETAIL_PILL_BG, borderRadius: 999, border: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <Icon size={14} color={DETAIL_ACCENT_ICON} strokeWidth={2} />
      </div>
      <span className="f-body text-[12.5px] font-medium truncate" style={{ color: DETAIL_INK }}>{text}</span>
    </div>
  );
}

function RuleRow({ text }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: DETAIL_SUCCESS }}>
        <Check size={12} color="white" strokeWidth={3} />
      </div>
      <span className="f-body text-[13.5px]" style={{ color: DETAIL_INK }}>{text}</span>
    </div>
  );
}

export default function PropertyDetailPanel({
  p, tab, setShowMap, showMap, scrollableRef, handleTabChange,
  similarProperties, contactMethods, studentMode, roommateCount, onFindRoommate,
  onOpenLister, onOpenMessage: _onOpenMessage, onOpenProperty, viewingRequested,
  handleBottomAction, requestingViewing, sentFlash, sendFailed,
}) {
  return (
    <>
      <div className="px-4 pt-2 shrink-0">
        {(() => {
          const rawTitle = String(p.title || "Property");
          const [titlePart, ...locationParts] = rawTitle.split(",");
          const displayTitle = titlePart.trim();
          const displayLocation = locationParts.join(",").trim() || p.location || p.area || p.suburb || "";
          return (
            <div className="relative overflow-hidden rounded-[24px] px-4 py-3.5" style={{ background: DETAIL_BG, border: `1px solid ${DETAIL_BORDER}`, boxShadow: "0 4px 18px rgba(20,32,26,0.05)" }}>
              <div className="flex items-center gap-3">
                <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 46, height: 46, background: DETAIL_PILL_BG, border: `1px solid ${DETAIL_BORDER}` }}>
                  <Bed size={22} color={T.ink} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="f-display font-bold" style={{ color: T.ink, fontSize: 17, lineHeight: 1.25, letterSpacing: "-0.01em", whiteSpace: "normal", overflowWrap: "break-word" }}>{displayTitle}</div>
                  {displayLocation && <div className="f-body flex items-center gap-1.5 mt-1" style={{ color: T.ink60, fontSize: 12.5, lineHeight: 1.2 }}><MapPin size={13} color={T.brick} strokeWidth={2} /><span className="truncate">{displayLocation}</span></div>}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center gap-2.5 mt-4 px-3 py-2.5 cursor-pointer" style={{ background: DETAIL_BG, border: `1px solid ${DETAIL_BORDER}`, borderRadius: 20 }} onClick={() => onOpenLister?.({ id: p.ownerUserId ?? p.landlordRegistrationId ?? p.id, name: p.landlord, grad: p.grad, verified: p.landlordVerified })}>
          <Avatar src={p.landlordAvatarUrl} grad={p.grad} letter={(p.landlord || "?")[0]} size={32} alt={p.landlord ? `${p.landlord} profile picture` : ""} />
          <div className="flex-1 min-w-0"><div className="f-body font-semibold truncate" style={{ color: "#2D1B0F", fontSize: 14 }}>{p.landlord || "Landlord"}</div><div className="f-body" style={{ color: DETAIL_ACCENT_DEEP, fontSize: 11, fontWeight: 500 }}>View listings</div></div>
          <VerifiedBadge status={p.landlordVerified ? "verified" : "pending"} compact size={32} />
        </div>

        <div className="mt-4"><SegmentedTabs tabs={[{ id: "overview", label: "overview" }, { id: "cost", label: "cost" }, { id: "contact", label: "contact" }]} active={tab} onChange={handleTabChange} /></div>
      </div>

      <div ref={scrollableRef} className="flex-1 overflow-y-auto noscroll min-h-0 detail-panel-scroll" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", touchAction: "pan-y" }}>
        {tab === "overview" && <div className="px-4 py-5 space-y-4 fade">
          <p className="f-body" style={{ color: DETAIL_INK, fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>{p.desc}</p>
          <div className="flex items-center gap-1 f-body" style={{ color: DETAIL_INK_SOFT, fontSize: 12 }}><MapPin size={12} className="shrink-0" /><span>{p.distanceKm} km away · listed {formatDaysAgo(p.postedDaysAgo).toLowerCase()} · {(Number(p?.saveCount) || 0)} interested</span></div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: DETAIL_BG, border: `1px solid ${DETAIL_BORDER}`, borderRadius: 24 }}><div className="f-mono" style={{ color: DETAIL_INK_SOFT, fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 600 }}>LOCATION</div><button type="button" onClick={() => setShowMap((visible) => !visible)} aria-expanded={showMap} className="f-body active:scale-95 transition-transform" style={{ background: DETAIL_PILL_BG, color: DETAIL_INK, border: "1px solid #E0D5C3", fontSize: 13, fontWeight: 600, borderRadius: 999, padding: "10px 20px", whiteSpace: "nowrap" }}>{showMap ? "Hide map" : "Show map"}</button></div>
          {showMap && <Suspense fallback={<div className="flex items-center justify-center" style={{ height: 180, background: DETAIL_BG, borderRadius: 24, color: DETAIL_INK_SOFT, fontSize: 11.5 }}>Loading map…</div>}><PropertyMap property={p} /></Suspense>}
          <div className="p-5 space-y-3" style={{ background: DETAIL_BG, border: `1px solid ${DETAIL_BORDER}`, borderRadius: 28 }}><div className="f-mono" style={{ color: DETAIL_INK_SOFT, fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 600 }}>AMENITIES</div><div className="grid grid-cols-2 gap-2.5"><AmenityPill icon={Bed} text={p.bathroom + " bathroom"} /><AmenityPill icon={Zap} text={p.electricity} /><AmenityPill icon={Droplets} text={p.water} /><AmenityPill icon={Car} text={p.parking ? "Parking available" : "No parking"} /><AmenityPill icon={ShieldCheck} text={p.security} /><AmenityPill icon={HomeIcon} text={p.furnished ? "Furnished" : "Unfurnished"} /></div></div>
          <div className="p-5 space-y-1" style={{ background: DETAIL_BG, border: `1px solid ${DETAIL_BORDER}`, borderRadius: 28 }}><div className="f-mono mb-2" style={{ color: DETAIL_INK_SOFT, fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 600 }}>HOUSE RULES</div>{(p.rules || []).map((r, i) => <RuleRow key={i} text={r} />)}</div>
          {similarProperties.length > 0 && <div><div className="f-mono mb-3" style={{ color: T.ink60, fontSize: 10, letterSpacing: "0.2em" }}>SIMILAR PROPERTIES</div><div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>{similarProperties.map((sp) => <GridTile key={sp.id} p={sp} onOpen={onOpenProperty ? () => onOpenProperty(sp) : undefined} />)}</div></div>}
        </div>}
        {tab === "cost" && <div className="px-4 py-5 fade"><Receipt p={p} /><p className="f-body mt-4 leading-relaxed" style={{ color: T.ink60, fontSize: 11.5 }}>This is the full cost shown to you before you commit. The platform fee is fixed — never a percentage of your rent.</p></div>}
        {tab === "contact" && <div className="px-4 py-5 fade">{contactMethods.length > 0 ? <><div className="f-mono mb-3" style={{ color: T.ink60, fontSize: 10, letterSpacing: "0.2em" }}>REACH OUT</div><div className="flex flex-col gap-2">{contactMethods.map((m) => <ContactRow key={m.id} method={m} />)}</div><p className="f-body mt-4 leading-relaxed" style={{ color: T.ink60, fontSize: 11.5 }}>Tapping a button above opens that app directly with them — nothing is sent through ImbaLink.</p></> : <div className="text-center py-10 f-body" style={{ color: T.ink60, fontSize: 12.5 }}>No contact details added yet.</div>}</div>}
      </div>

      {studentMode && isShareableProperty(p) && tab !== "contact" && <div className="px-4 pb-2 shrink-0"><button type="button" onClick={() => onFindRoommate?.(p)} className="w-full flex items-center justify-center gap-1.5 rounded-full f-body font-semibold active:scale-95 transition-transform" style={{ background: "rgba(110,99,184,.1)", color: T.jacarandaDeep, fontSize: 12, padding: "9px 10px", border: "1px solid rgba(110,99,184,.25)" }}><Users size={14} /> {roommateCount > 0 ? `${roommateCount} student${roommateCount === 1 ? "" : "s"} interested in sharing — Find a Roommate` : "Find a Roommate"}</button></div>}

      {tab !== "contact" && <>{p?.isPaused && <div className="px-4 pb-2 f-body" style={{ color: T.ink60, fontSize: 11, textAlign: "center" }}>This listing is temporarily paused by the owner. Viewing requests are unavailable for now and may reopen when the owner is ready.</div>}<div className="p-4 shrink-0" style={{ background: DETAIL_BG }}><button onClick={handleBottomAction} disabled={p?.isPaused || sentFlash || requestingViewing} className="w-full py-4 rounded-full f-display font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform" style={{ background: p?.isPaused ? "rgba(58,74,58,.12)" : (viewingRequested || sentFlash ? "#1A7A4C" : DETAIL_ACCENT), color: p?.isPaused ? DETAIL_BG : "white", opacity: sentFlash || requestingViewing ? 0.9 : 1, fontSize: 14 }}>{sentFlash ? <><Check size={15} /> Message sent</> : requestingViewing ? "Sending…" : sendFailed ? "Couldn't send — retry" : p?.isPaused ? "Viewing paused by owner" : viewingRequested ? <><MessageCircle size={15} /> Open message</> : "Request a viewing"}</button></div></>}
    </>
  );
}

export { DETAIL_BG, DETAIL_BORDER, DETAIL_INK };
