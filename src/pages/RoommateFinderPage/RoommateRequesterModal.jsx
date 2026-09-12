import React from "react";
import { ArrowRight, Check, Flag, MessageCircle, X } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";
import { propertyPhoto } from "./helpers";
import { VerificationBadge } from "./VerificationBadge";

export default function RoommateRequesterModal({ selectedRequester, setSelectedRequesterId, focusProperty, onFindRoommate, selectedRequesterCompatibility, openRequesterMessage, showToast }) {
  return selectedRequester ? (
        <div className="rf-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedRequesterId(null)}>
          <div className="rf-modal" role="dialog" aria-modal="true" aria-label={`${selectedRequester.name}'s profile`}>
            <div className="rf-modal-head">
              <div className="rf-person">
                <Avatar src={selectedRequester.avatarUrl} grad={["#6E63B8", "#3E3670"]} letter={selectedRequester.name.charAt(0)} size={52} alt={`${selectedRequester.name} profile picture`} />
                <div>
                  <h3 style={{ fontSize: 17, margin: "0 0 3px" }}>{selectedRequester.name}</h3>
                  <VerificationBadge status={selectedRequester.verificationStatus} />
                </div>
              </div>
              <button type="button" className="rf-close" onClick={() => setSelectedRequesterId(null)} aria-label="Close"><X size={15} /></button>
            </div>

            <div className="rf-meta" style={{ marginTop: 16 }}>
              <div className="rf-meta-box"><small>UNIVERSITY</small><b>{selectedRequester.university || "Not set"}</b></div>
              <div className="rf-meta-box"><small>STUDY YEAR</small><b>{selectedRequester.studyYear || "Not set"}</b></div>
              <div className="rf-meta-box"><small>ACCOMMODATION</small><b>{selectedRequester.accommodationPreference}</b></div>
              <div className="rf-meta-box"><small>ROOMMATES NEEDED</small><b>{selectedRequester.roommatesNeeded}</b></div>
              <div className="rf-meta-box"><small>EST. MONTHLY COST</small><b>{selectedRequester.budget || "Flexible"}</b></div>
              <div className="rf-meta-box"><small>DEPOSIT</small><b>{selectedRequester.deposit || "Not specified"}</b></div>
              <div className="rf-meta-box" style={{ gridColumn: "1/-1" }}><small>UTILITIES</small><b>{selectedRequester.utilitiesIncluded || "Not specified"}</b></div>
            </div>

            {selectedRequester.aboutMe && (
              <div className="rf-card" style={{ marginBottom: 14, fontSize: 11.5, color: T.ink }}>
                <div style={{ fontSize: 9, fontWeight: 750, color: T.ink60, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>About</div>
                {selectedRequester.aboutMe}
              </div>
            )}

            {selectedRequester.preferenceTags?.length > 0 && (
              <div className="rf-tags">
                {selectedRequester.preferenceTags.map((tag) => <span key={tag} className="rf-tag">{tag}</span>)}
              </div>
            )}

            {selectedRequester.preferences && (
              <div className="rf-card" style={{ marginBottom: 14, fontSize: 11.5, color: T.ink }}>
                "{selectedRequester.preferences}"
              </div>
            )}

            {selectedRequester.importantNotes && (
              <div className="rf-card" style={{ marginBottom: 14, fontSize: 11.5, color: T.ink, borderColor: "rgba(184,61,49,.2)", background: "rgba(184,61,49,.05)" }}>
                <div style={{ fontSize: 9, fontWeight: 750, color: T.brick, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Important notes</div>
                {selectedRequester.importantNotes}
              </div>
            )}

            {focusProperty && (
              <button type="button" className="rf-property-mini" style={{ marginBottom: 14 }} onClick={() => { setSelectedRequesterId(null); onFindRoommate?.(focusProperty); }}>
                <img src={propertyPhoto(focusProperty)} alt="" />
                <span><small>Property you're considering together</small><b>{focusProperty.title}</b><em>{focusProperty.suburb} · ${focusProperty.rent}/mo</em></span>
                <ArrowRight size={13} />
              </button>
            )}

            {selectedRequesterCompatibility && (
              <div className="rf-card" style={{ marginTop: 4, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>Preferences that align</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.jacaranda }}>{selectedRequesterCompatibility.matched}/{selectedRequesterCompatibility.total}</span>
                </div>
                <div style={{ fontSize: 9.5, color: T.ink60, marginBottom: 6 }}>{selectedRequesterCompatibility.matched} of {selectedRequesterCompatibility.total} available preferences align. This is a preference guide, not a prediction.</div>
                {selectedRequesterCompatibility.checks.map((c) => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.match ? T.msasa : T.ink60, padding: "3px 0" }}>
                    <Check size={12} style={{ opacity: c.match ? 1 : 0.25 }} /> {c.label}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="rf-btn-primary" onClick={() => openRequesterMessage(selectedRequester)}>
                <MessageCircle size={13} /> Message
              </button>
            </div>

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
