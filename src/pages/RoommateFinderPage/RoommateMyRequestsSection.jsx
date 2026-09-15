import React from "react";
import { Plus } from "lucide-react";
import { T } from "../../styles/tokens";

export default function RoommateMyRequestsSection(props) {
  const { myRequests, properties, shareRequestCounts, setSelectedId, withdrawRequest, onFindRoommate, openShareForm } = props;
  return (
            <section className="rf-section">
              <div className="rf-section-head">
                <div>
                  <h2>You're looking to share</h2>
                  <p>Manage the properties you've expressed interest in sharing.</p>
                </div>
                <button type="button" className="rf-btn-primary" style={{ flex: "none", padding: "9px 14px" }} onClick={() => openShareForm(null, { lockProperty: false })}>
                  <Plus size={14} /> Post a general request
                </button>
              </div>

              {myRequests.length === 0 ? (
                <div className="rf-empty">You haven't expressed interest in sharing any property yet — find a shareable property in Explore and tap "Find a Roommate".</div>
              ) : (
                <div className="rf-card">
                  {myRequests.map((req) => {
                    const linkedProperty = req.propertyId != null
                      ? properties.find((p) => String(p?.id) === String(req.propertyId))
                      : null;
                    const count = req.propertyId != null ? (shareRequestCounts[String(req.propertyId)] || 0) : 0;
                    const withdrawn = (req.status || "active") === "withdrawn";
                    return (
                      <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: `1px solid ${T.paperDim}`, fontSize: 11.5 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {linkedProperty ? linkedProperty.title : "General request"}
                          </div>
                          <div style={{ color: T.ink60, fontSize: 10.5, marginTop: 2 }}>
                            {withdrawn ? "Withdrawn" : linkedProperty ? `${count} student${count === 1 ? "" : "s"} interested` : `${req.roommatesNeeded} roommate${req.roommatesNeeded === "1" ? "" : "s"} · ${req.budget || "Budget flexible"}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {linkedProperty && !withdrawn && (
                            <button type="button" className="rf-btn-secondary" style={{ flex: "none", padding: "6px 10px", fontSize: 10 }} onClick={() => onFindRoommate?.(linkedProperty)}>
                              View
                            </button>
                          )}
                          {!withdrawn && (
                            <button
                              type="button"
                              className="rf-btn-secondary"
                              style={{ flex: "none", padding: "6px 10px", fontSize: 10 }}
                              onClick={() => openShareForm({ ...req, propertyId: req.propertyId != null ? String(req.propertyId) : "" }, { lockProperty: false })}
                            >
                              Edit
                            </button>
                          )}
                          {!withdrawn && (
                            <button
                              type="button"
                              className="rf-btn-secondary"
                              style={{ flex: "none", padding: "6px 10px", fontSize: 10 }}
                              onClick={() => { withdrawRequest(req); setSelectedId(null); }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
  );
}
