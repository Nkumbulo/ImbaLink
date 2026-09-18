import { ArrowRight, Check, LayoutGrid, Search, Sparkles, Square } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";
import { propertyPhoto } from "./helpers";
import { VerificationBadge } from "./VerificationBadge";

export default function RoommateDiscoverySection(props) {
  const { query, setQuery, sortedCandidates, toggleViewMode, viewMode, openFindA, onFindRoommate, setSelectedId, openMessage: _openMessage, interested, toggleInterested, lastRecommendationRefresh } = props;
  return (
            <section id="rf-discover" className="rf-section">
              <div className="rf-section-head">
                <div>
                  <h2>Recommended for you</h2>
                  <p>Sorted by how closely a student's stored preferences match yours.</p>
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

              <div className="rf-search-row">
                <div className="rf-search-box">
                  <Search size={14} color={T.ink60} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search compatible students by name, university or area" />
                </div>
                <button type="button" className="rf-find-a-btn" onClick={openFindA}>
                  <Sparkles size={13} /> Find-a
                </button>
              </div>

              {sortedCandidates.length === 0 ? (
                <div className="rf-empty">
                  No strong matches yet — try widening your area, budget, or accommodation preferences.
                </div>
              ) : (
                <>
                  {viewMode === 'card' ? (
                    <div className="rf-grid">
                      {sortedCandidates.map(({ candidate, compatibility }) => (
                        <article className="rf-card" key={candidate.id}>
                          <div className="rf-person">
                            <Avatar src={candidate.avatarUrl} grad={candidate.grad} letter={candidate.name.charAt(0)} size={42} alt={`${candidate.name} profile picture`} />
                            <div>
                              <h3>{candidate.name}</h3>
                              <p>{candidate.university}{candidate.studyYear ? ` · ${candidate.studyYear}` : ""}</p>
                            </div>
                            {compatibility && (
                              <div className="rf-match">
                                <b>{compatibility.matched}/{compatibility.total}</b>
                                <small>Compatible</small>
                              </div>
                            )}
                          </div>

                          <div className="rf-meta">
                            <div className="rf-meta-box"><small>Area</small><b>{candidate.area}</b></div>
                            <div className="rf-meta-box"><small>Budget</small><b>${candidate.budget}/mo</b></div>
                            <div className="rf-meta-box"><small>Looking for</small><b>{candidate.roommatesNeeded === "1" ? "1 roommate" : `${candidate.roommatesNeeded} roommates`}</b></div>
                            <div className="rf-meta-box"><small>Status</small><b><VerificationBadge status={candidate.verificationStatus} size={9} /></b></div>
                          </div>

                          <div className="rf-tags">
                            {candidate.lifestyle.slice(0, 3).map((tag) => <span key={tag} className="rf-tag">{tag}</span>)}
                          </div>
                          {candidate.property && (
                            <button type="button" className="rf-property-mini" onClick={() => onFindRoommate?.(candidate.property)}>
                              <img src={propertyPhoto(candidate.property)} alt="" loading="lazy" />
                              <span><small>Wants to share</small><b>{candidate.property.title}</b><em>{candidate.property.suburb} · ${candidate.property.rent}/mo</em></span>
                              <ArrowRight size={13} />
                            </button>
                          )}

                          <div className="rf-card-actions">
                            <button type="button" className="rf-btn-secondary" onClick={() => setSelectedId(candidate.id)}>
                              View profile
                            </button>
                            <button
                              type="button"
                              className={`rf-btn-secondary ${interested.has(String(candidate.id)) ? "active" : ""}`}
                              onClick={() => toggleInterested(candidate.id)}
                            >
                              {interested.has(String(candidate.id)) ? <><Check size={12} /> Connected</> : "Connect about this property"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rf-compact-grid">
                      {sortedCandidates.map(({ candidate, compatibility }) => (
                        <article className="rf-compact-card" key={candidate.id}>
                          {candidate.property ? (
                            <img src={propertyPhoto(candidate.property)} alt="" loading="lazy" />
                          ) : (
                            <div style={{ width: '100%', height: 100, borderRadius: 8, background: T.paperDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Avatar src={candidate.avatarUrl} grad={candidate.grad} letter={candidate.name.charAt(0)} size={48} alt={`${candidate.name} profile picture`} />
                            </div>
                          )}
                          <div className="rf-person">
                            <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: T.jacaranda, color: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                              {candidate.name.charAt(0)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="rf-compact-name">{candidate.name}</div>
                              <div className="rf-compact-detail">{candidate.university}</div>
                            </div>
                          </div>
                          {compatibility && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.jacaranda }}>
                              {compatibility.matched}/{compatibility.total} compatible
                            </div>
                          )}
                          <button type="button" className="rf-btn-secondary" onClick={() => setSelectedId(candidate.id)}>
                            View profile
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  </>
                )}

              <p className="rf-demo-note">
                Showing up to 12 students with at least two shared preferences. Recommendations refresh every 10 minutes; only a few cards rotate when new matches are available.
                {lastRecommendationRefresh && ` Last checked ${lastRecommendationRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}
              </p>
            </section>
  );
}
