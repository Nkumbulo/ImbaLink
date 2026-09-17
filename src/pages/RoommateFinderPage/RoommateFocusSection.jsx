import { ArrowLeft, ArrowRight, Check, LayoutGrid, MapPin, MessageCircle, Square, X } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";
import { propertyPhoto } from "./helpers";
import { VerificationBadge } from "./VerificationBadge";
import { PROPERTY_REQUESTERS_PER_PAGE } from "./useRoommateSharing";
import { computeRoommateCompatibility } from "../../utils/studentHelpers";

export default function RoommateFocusSection(props) {
  const { focusProperty, myProfile, myRequestForProperty, togglingShareInterest, openShareForm, removeMyPropertyShare, toggleViewMode, viewMode, loadingPropertyRequesters, otherRequesters, visiblePropertyRequesters, setSelectedRequesterId, openRequesterMessage, propertyRequesterPageCount, propertyRequesterPage, setPropertyRequesterPage, onFindRoommate } = props;
  if (!focusProperty) return null;
  return (
    <>
            <div className="rf-property-preview">
              <img src={propertyPhoto(focusProperty)} alt="" className="rf-property-preview-img" />
              <div className="rf-property-preview-body">
                <h2>{focusProperty.title}</h2>
                <p><MapPin size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />{focusProperty.suburb}, {focusProperty.city}</p>
                <div className="rf-property-preview-meta">
                  <span>${focusProperty.rent}/mo</span>
                  <span>{focusProperty.rooms} room{Number(focusProperty.rooms) === 1 ? "" : "s"}</span>
                  <span>{focusProperty.bathroom} bathroom</span>
                </div>
              </div>
              {myRequestForProperty ? (
                <div className="rf-sharing-status">
                  <span className="rf-badge rf-badge-verified rf-sharing-pill">
                    <Check size={12} /> You're sharing this property
                  </span>
                  <button
                    type="button"
                    className="rf-btn-secondary"
                    style={{ flex: "none", padding: "8px 12px", fontSize: 10.5 }}
                    disabled={togglingShareInterest}
                    onClick={() => openShareForm(myRequestForProperty, { lockProperty: true })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rf-remove-btn"
                    disabled={togglingShareInterest}
                    onClick={removeMyPropertyShare}
                    aria-label="Remove your roommate listing for this property"
                    title="Remove your listing"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="rf-btn-secondary"
                  style={{ flex: "none", padding: "10px 16px" }}
                  onClick={() => openShareForm(null, { lockProperty: true })}
                >
                  I'm Interested in Sharing
                </button>
              )}
            </div>

            <div className="rf-section-head" style={{ marginTop: 22 }}>
              <div>
                <h2>Students interested in sharing this property</h2>
                <p>{otherRequesters.length > 0 ? `${otherRequesters.length} student${otherRequesters.length === 1 ? "" : "s"} interested — real, from active share requests.` : "Real share requests for this property only — no preview data here."}</p>
              </div>
              <button
                type="button"
                className="rf-filter-btn"
                onClick={toggleViewMode}
                title={viewMode === 'compact' ? 'Switch to card view' : 'Switch to grid view'}
              >
                {viewMode === 'compact' ? <Square size={13} /> : <LayoutGrid size={13} />}
                {viewMode === 'compact' ? 'Card' : 'Grid'}
              </button>
            </div>

            {loadingPropertyRequesters ? (
              <div className="rf-empty">Loading…</div>
            ) : otherRequesters.length === 0 ? (
              <div className="rf-empty">
                No one is looking to share this place yet.
                {!myRequestForProperty && (
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="rf-btn-primary" style={{ flex: "none", padding: "9px 16px" }} onClick={() => openShareForm(null, { lockProperty: true })}>
                      Be the first to look for a roommate
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
              {viewMode === 'card' ? (
                <div className="rf-grid">
                  {visiblePropertyRequesters.map((requester) => {
                    const compatibility = computeRoommateCompatibility(myProfile, requester);
                    return (
                      <article className="rf-card" key={requester.requestId}>
                        <div className="rf-person">
                          <Avatar src={requester.avatarUrl} grad={["#6E63B8", "#3E3670"]} letter={requester.name.charAt(0)} size={42} alt={`${requester.name} profile picture`} />
                          <div>
                            <h3>{requester.name}</h3>
                            <p>{requester.university || "University not set"}{requester.studyYear ? ` · ${requester.studyYear}` : ""}</p>
                          </div>
                          {compatibility && (
                            <div className="rf-match">
                              <b>{compatibility.matched}/{compatibility.total}</b>
                              <small>Compatible</small>
                            </div>
                          )}
                        </div>
                        <div className="rf-meta">
                          <div className="rf-meta-box"><small>Budget</small><b>{requester.budget || "Flexible"}</b></div>
                          <div className="rf-meta-box"><small>Looking for</small><b>{requester.roommatesNeeded === "1" ? "1 roommate" : `${requester.roommatesNeeded} roommates`}</b></div>
                          <div className="rf-meta-box" style={{ gridColumn: "1/-1" }}><small>Status</small><b><VerificationBadge status={requester.verificationStatus} size={9} /></b></div>
                        </div>
                        {requester.preferenceTags?.length > 0 && (
                          <div className="rf-tags">
                            {requester.preferenceTags.slice(0, 3).map((tag) => <span key={tag} className="rf-tag">{tag}</span>)}
                          </div>
                        )}
                        <button type="button" className="rf-property-mini" onClick={() => onFindRoommate?.(focusProperty)}>
                          <img src={propertyPhoto(focusProperty)} alt="" />
                          <span><small>Property you're both considering</small><b>{focusProperty.title}</b><em>{focusProperty.suburb} · ${focusProperty.rent}/mo</em></span>
                          <ArrowRight size={13} />
                        </button>
                        <div className="rf-card-actions">
                          <button type="button" className="rf-btn-secondary" onClick={() => setSelectedRequesterId(requester.userId)}>
                            View profile
                          </button>
                          <button type="button" className="rf-btn-primary" onClick={() => openRequesterMessage(requester)}>
                            <MessageCircle size={12} /> Message
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rf-compact-grid">
                  {visiblePropertyRequesters.map((requester) => {
                    const compatibility = computeRoommateCompatibility(myProfile, requester);
                    return (
                      <article className="rf-compact-card" key={requester.requestId}>
                        <img src={propertyPhoto(focusProperty)} alt="" />
                        <div className="rf-person">
                          <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: T.jacaranda, color: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                            {requester.name.charAt(0)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="rf-compact-name">{requester.name}</div>
                            <div className="rf-compact-detail">{requester.university || "University not set"}</div>
                          </div>
                        </div>
                        {compatibility && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.jacaranda }}>
                            {compatibility.matched}/{compatibility.total} compatible
                          </div>
                        )}
                        <button type="button" className="rf-btn-secondary" onClick={() => setSelectedRequesterId(requester.userId)}>
                          View profile
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              {propertyRequesterPageCount > 1 && (
                <div className="rf-pagination" aria-label="Students willing to share pagination">
                  <span>Showing {(propertyRequesterPage - 1) * PROPERTY_REQUESTERS_PER_PAGE + 1}–{Math.min(propertyRequesterPage * PROPERTY_REQUESTERS_PER_PAGE, otherRequesters.length)} of {otherRequesters.length}</span>
                  <div className="rf-pagination-actions">
                    <button
                      type="button"
                      className="rf-btn-secondary"
                      disabled={propertyRequesterPage === 1}
                      onClick={() => setPropertyRequesterPage((page) => Math.max(1, page - 1))}
                    >
                      <ArrowLeft size={12} /> Previous
                    </button>
                    <span className="rf-pagination-page">{propertyRequesterPage} / {propertyRequesterPageCount}</span>
                    <button
                      type="button"
                      className="rf-btn-secondary"
                      disabled={propertyRequesterPage === propertyRequesterPageCount}
                      onClick={() => setPropertyRequesterPage((page) => Math.min(propertyRequesterPageCount, page + 1))}
                    >
                      Next <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
    </>
  );
}
