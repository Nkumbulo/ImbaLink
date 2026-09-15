import React from "react";
import { ArrowRight, Check, Flag, MessageCircle, X } from "lucide-react";
import { T } from "../../styles/tokens";
import { propertyPhoto } from "./helpers";
import { VerificationBadge } from "./VerificationBadge";

export default function RoommateCandidateModal({ selected, setSelectedId, openMessage, showToast, onFindRoommate, interested, toggleInterested, setTab }) {
  return selected ? (
        <div className="rf-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedId(null)}>
          <div className="rf-modal" role="dialog" aria-modal="true" aria-label={`${selected.candidate.name}'s profile`}>
            <div className="rf-modal-head">
              <div className="rf-person">
                <Avatar src={selected.candidate.avatarUrl} grad={selected.candidate.grad} letter={selected.candidate.name.charAt(0)} size={52} alt={`${selected.candidate.name} profile picture`} />
                <div>
                  <h3 style={{ fontSize: 17, margin: "0 0 3px" }}>{selected.candidate.name}</h3>
                  <VerificationBadge status={selected.candidate.verificationStatus} />
                </div>
              </div>
              <button type="button" className="rf-close" onClick={() => setSelectedId(null)} aria-label="Close"><X size={15} /></button>
            </div>

            <div className="rf-meta" style={{ marginTop: 16 }}>
              <div className="rf-meta-box"><small>UNIVERSITY</small><b>{selected.candidate.university}</b></div>
              <div className="rf-meta-box"><small>STUDY YEAR</small><b>{selected.candidate.studyYear}</b></div>
              <div className="rf-meta-box"><small>PREFERRED AREA</small><b>{selected.candidate.area}</b></div>
              <div className="rf-meta-box"><small>EST. MONTHLY COST</small><b>${selected.candidate.budget}/month</b></div>
              <div className="rf-meta-box"><small>ACCOMMODATION</small><b>{selected.candidate.accommodationPreference}</b></div>
              <div className="rf-meta-box"><small>ROOMMATES NEEDED</small><b>{selected.candidate.roommatesNeeded}</b></div>
              {selected.candidate.moveInDate && <div className="rf-meta-box"><small>MOVE-IN DATE</small><b>{selected.candidate.moveInDate}</b></div>}
              {selected.candidate.city && <div className="rf-meta-box"><small>PREFERRED CITY</small><b>{selected.candidate.city}</b></div>}
              {selected.candidate.deposit && <div className="rf-meta-box"><small>DEPOSIT</small><b>{selected.candidate.deposit}</b></div>}
              {selected.candidate.utilitiesIncluded && <div className="rf-meta-box"><small>UTILITIES</small><b>{selected.candidate.utilitiesIncluded}</b></div>}
            </div>

            {selected.candidate.aboutMe && (
              <div className="rf-card" style={{ marginBottom: 14, fontSize: 11.5, color: T.ink }}>
                <div style={{ fontSize: 9, fontWeight: 750, color: T.ink60, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>About</div>
                {selected.candidate.aboutMe}
              </div>
            )}

            {(selected.candidate.preferences || selected.candidate.lifestyle?.length > 0) && (
              <div className="rf-card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 750, color: T.ink60, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 7 }}>Roommate preferences</div>
                {selected.candidate.preferences && (
                  <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.ink, marginBottom: selected.candidate.lifestyle?.length ? 9 : 0 }}>
                    {selected.candidate.preferences}
                  </div>
                )}
                {selected.candidate.lifestyle?.length > 0 && (
                  <div className="rf-tags">
                    {selected.candidate.lifestyle.map((tag) => <span key={tag} className="rf-tag">{tag}</span>)}
                  </div>
                )}
              </div>
            )}

            {selected.candidate.importantNotes && (
              <div className="rf-card" style={{ marginBottom: 14, fontSize: 11.5, color: T.ink, borderColor: "rgba(184,61,49,.2)", background: "rgba(184,61,49,.05)" }}>
                <div style={{ fontSize: 9, fontWeight: 750, color: T.brick, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Important notes</div>
                {selected.candidate.importantNotes}
              </div>
            )}

            {selected.candidate.property && (
              <button type="button" className="rf-property-mini" style={{ marginBottom: 14 }} onClick={() => { setSelectedId(null); onFindRoommate?.(selected.candidate.property); }}>
                <img src={propertyPhoto(selected.candidate.property)} alt="" />
                <span><small>Property they want to share</small><b>{selected.candidate.property.title}</b><em>{selected.candidate.property.suburb} · ${selected.candidate.property.rent}/mo</em></span>
                <ArrowRight size={13} />
              </button>
            )}

            {selected.compatibility && (
              <div className="rf-card" style={{ marginTop: 4, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>Preferences that align</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.jacaranda }}>{selected.compatibility.matched}/{selected.compatibility.total}</span>
                </div>
                <div style={{ fontSize: 9.5, color: T.ink60, marginBottom: 6 }}>{selected.compatibility.matched} of {selected.compatibility.total} available preferences align. This is a preference guide, not a prediction.</div>
                {selected.compatibility.checks.map((c) => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.match ? T.msasa : T.ink60, padding: "3px 0" }}>
                    <Check size={12} style={{ opacity: c.match ? 1 : 0.25 }} /> {c.label}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="rf-btn-primary" onClick={() => openMessage(selected.candidate)}>
                <MessageCircle size={13} /> Message
              </button>
              <button
                type="button"
                className={`rf-btn-secondary ${interested.has(String(selected.candidate.id)) ? "active" : ""}`}
                onClick={() => toggleInterested(selected.candidate.id)}
              >
                {interested.has(String(selected.candidate.id)) ? <><Check size={12} /> Connected</> : "Connect about this property"}
              </button>
            </div>

            <button
              type="button"
              className="rf-btn-secondary"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                if (selected.candidate.property) { setSelectedId(null); onFindRoommate?.(selected.candidate.property); }
                else { setSelectedId(null); setTab?.("search"); }
              }}
            >
              {selected.candidate.property ? "View shared property" : "Explore student accommodation"} <ArrowRight size={12} />
            </button>

            <button
              type="button"
              onClick={() => showToast("Reporting will be available once roommate profiles are backed by real accounts.")}
              style={{ width: "100%", marginTop: 10, border: 0, background: "none", color: T.ink60, fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}
            >
              <Flag size={11} /> Report profile
            </button>
          </div>
        </div>
  ) : null;
}
