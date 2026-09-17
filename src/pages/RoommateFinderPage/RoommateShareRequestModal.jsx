import { Check, X } from "lucide-react";
import { T } from "../../styles/tokens";
import { PREFERENCE_TAGS } from "../../utils/studentHelpers";
import { PropertyPicker } from "./PropertyPicker";
import { propertyPhoto } from "./helpers";

export default function RoommateShareRequestModal({ showRequestForm, setShowRequestForm, requestFormLocked, focusProperty, requestForm, setRequestForm, pickableProperties, submittingRequest, handlePublishRequest, inputStyle }) {
  return showRequestForm ? (
        <div className="rf-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowRequestForm(false)}>
          <div className="rf-modal" role="dialog" aria-modal="true" aria-label="Share this property with a roommate">
            <div className="rf-modal-head">
              <div>
                <h3 style={{ fontSize: 18, margin: "0 0 4px", fontFamily: "'Sora',sans-serif" }}>
                  {requestFormLocked ? "Looking to share this place" : "Post a request"}
                </h3>
                <p style={{ fontSize: 11, color: T.ink60, margin: 0 }}>Visible to other students browsing Find a Roommate.</p>
              </div>
              <button type="button" className="rf-close" onClick={() => setShowRequestForm(false)} aria-label="Close"><X size={15} /></button>
            </div>

            {requestFormLocked && focusProperty ? (
              <div className="rf-property-mini" style={{ marginTop: 14, cursor: "default" }}>
                <img src={propertyPhoto(focusProperty)} alt="" />
                <span><small>Property</small><b>{focusProperty.title}</b><em>{focusProperty.suburb} · ${focusProperty.rent}/mo</em></span>
              </div>
            ) : null}

            <div className="rf-pref-grid">
              {!requestFormLocked && (
                <div className="rf-pref-field full">
                  <label>Property to share</label>
                  <PropertyPicker
                    properties={pickableProperties}
                    value={requestForm.propertyId}
                    onChange={(value) => setRequestForm((f) => ({ ...f, propertyId: value }))}
                    hint="Choose a real property so students know exactly what you want to share. Leave it unselected for a general request."
                    emptyText="Save or like a property in Explore first, so you can attach it here."
                  />
                </div>
              )}

              <div className="rf-pref-field full">
                <label>About me</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
                  value={requestForm.aboutMe}
                  maxLength={400}
                  onChange={(e) => setRequestForm((f) => ({ ...f, aboutMe: e.target.value }))}
                  placeholder="A couple of lines about you — course, year, what you're like to live with."
                />
              </div>

              <div className="rf-pref-field full">
                <label>Roommate preferences</label>
                <div className="rf-tag-picker">
                  {PREFERENCE_TAGS.map((tag) => {
                    const active = requestForm.preferenceTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        className={`rf-tag-choice ${active ? "is-active" : ""}`}
                        onClick={() => setRequestForm((f) => ({
                          ...f,
                          preferenceTags: active ? f.preferenceTags.filter((t) => t !== tag) : [...f.preferenceTags, tag],
                        }))}
                      >
                        {active && <Check size={11} />} {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rf-pref-field">
                <label>Roommates needed</label>
                <select style={inputStyle} value={requestForm.roommatesNeeded} onChange={(e) => setRequestForm((f) => ({ ...f, roommatesNeeded: e.target.value }))}>
                  <option value="1">1 roommate</option>
                  <option value="2">2 roommates</option>
                  <option value="3">3 roommates</option>
                </select>
              </div>
              <div className="rf-pref-field">
                <label>Move-in</label>
                <input style={inputStyle} type="date" value={requestForm.moveInDate} onChange={(e) => setRequestForm((f) => ({ ...f, moveInDate: e.target.value }))} />
              </div>

              <div className="rf-pref-field">
                <label>Est. monthly cost</label>
                <input style={inputStyle} value={requestForm.budget} onChange={(e) => setRequestForm((f) => ({ ...f, budget: e.target.value }))} placeholder="$200" />
              </div>
              <div className="rf-pref-field">
                <label>Deposit</label>
                <input style={inputStyle} value={requestForm.deposit} onChange={(e) => setRequestForm((f) => ({ ...f, deposit: e.target.value }))} placeholder="$200" />
              </div>
              <div className="rf-pref-field full">
                <label>Utilities</label>
                <select style={inputStyle} value={requestForm.utilitiesIncluded} onChange={(e) => setRequestForm((f) => ({ ...f, utilitiesIncluded: e.target.value }))}>
                  <option value="">Not specified</option>
                  <option value="Included">Included</option>
                  <option value="Not included">Not included</option>
                  <option value="Split evenly">Split evenly among roommates</option>
                </select>
              </div>

              <div className="rf-pref-field full">
                <label>What are you looking for?</label>
                <input style={inputStyle} value={requestForm.preferences} onChange={(e) => setRequestForm((f) => ({ ...f, preferences: e.target.value }))} placeholder="e.g. quiet, clean, another student" />
              </div>
              <div className="rf-pref-field full">
                <label>Important notes</label>
                <input style={inputStyle} value={requestForm.importantNotes} onChange={(e) => setRequestForm((f) => ({ ...f, importantNotes: e.target.value }))} placeholder="e.g. no pets, must love plants, near the library" />
              </div>
            </div>
            <button type="button" className="rf-btn-primary" style={{ width: "100%", marginTop: 14, padding: 11 }} disabled={submittingRequest} onClick={handlePublishRequest}>
              {submittingRequest ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
  ) : null;
}
