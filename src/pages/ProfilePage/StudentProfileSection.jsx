import { backend } from '../../application/backend/index.js';
import { useState, useEffect } from "react";
import { GraduationCap, MapPin } from "lucide-react";
import { T } from "../../styles/tokens";
import { photosFor } from "../../utils/propertyHelpers";
import { ACCOMMODATION_PREFERENCES } from "../../utils/studentHelpers";
import PropertyPicker from "./PropertyPicker";
import { StudentVerificationBadge } from "./StatusPrimitives";

// The Student section of Profile (spec section 16): university,
// verification status, and editable accommodation preferences — all
// persisted through the same saveUserProfile() every other profile
// edit already goes through (see App.jsx's updateStudentProfile).
function StudentProfileSection({ studentProfile, verificationStatus, onRequestVerification, onUpdateProfile, saved, properties = [] }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState(() => ({
    university: studentProfile?.university || "",
    preferredArea: studentProfile?.preferredArea || "",
    budget: studentProfile?.budget || "",
    accommodationPreference: studentProfile?.accommodationPreference || "Any",
    roommatesNeeded: studentProfile?.roommatesNeeded || "1",
    lifestyleNotes: studentProfile?.lifestyleNotes || "",
    roommatePropertyId: studentProfile?.roommatePropertyId || "",
    studyYear: studentProfile?.studyYear || "",
    wantsRoommate: !!studentProfile?.wantsRoommate,
  }));

  useEffect(() => {
    let active = true;
    backend.studentRepository.getUniversities().then((rows) => {
      if (!active) return;
      setUniversities(rows);
      setForm((f) => ({ ...f, university: f.university || rows[0]?.name || "" }));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      university: studentProfile?.university || f.university,
      preferredArea: studentProfile?.preferredArea || "",
      budget: studentProfile?.budget || "",
      accommodationPreference: studentProfile?.accommodationPreference || "Any",
      roommatesNeeded: studentProfile?.roommatesNeeded || "1",
      lifestyleNotes: studentProfile?.lifestyleNotes || "",
      roommatePropertyId: studentProfile?.roommatePropertyId || "",
      studyYear: studentProfile?.studyYear || "",
      wantsRoommate: !!studentProfile?.wantsRoommate,
    }));
  }, [studentProfile]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProfile?.(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestVerification = async () => {
    setRequesting(true);
    try {
      await onRequestVerification?.();
    } finally {
      setRequesting(false);
    }
  };

  const selectStyle = {
    border: `1px solid ${T.line}`,
    borderRadius: 9,
    padding: "8px 10px",
    background: T.white,
    fontSize: 11.5,
    color: T.ink,
    outline: "none",
  };

  const savedProperties = (Array.isArray(properties) ? properties : []).filter((p) => saved?.has?.(String(p?.id)));
  const selectedPreferenceProperty = form.roommatePropertyId
    ? properties.find((p) => String(p?.id) === String(form.roommatePropertyId)) || null
    : null;

  return (
    <div className="px-4 pb-2 student-profile-preferences">
      <style>{`
        .student-profile-preferences .rf-section{padding:26px 0 0}
        .student-profile-preferences .rf-section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
        .student-profile-preferences .rf-section-head h2{font-size:18px;margin:0;font-family:'Sora',sans-serif;letter-spacing:-.02em;color:${T.ink}}
        .student-profile-preferences .rf-section-head p{font-size:11.5px;color:${T.ink60};margin:4px 0 0;line-height:1.5}
        .student-profile-preferences .rf-card{background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:16px;padding:16px}
        .student-profile-preferences .rf-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:14px 0}
        .student-profile-preferences .rf-meta-box{background:${T.paperDim};border-radius:9px;padding:9px;min-width:0}
        .student-profile-preferences .rf-meta-box small{display:block;color:${T.ink60};font-size:8px;margin-bottom:3px;letter-spacing:.03em}
        .student-profile-preferences .rf-meta-box b{font-size:10.5px;color:${T.ink};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .student-profile-preferences .rf-pref-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        .student-profile-preferences .rf-pref-field{display:flex;flex-direction:column;gap:5px;min-width:0}
        .student-profile-preferences .rf-pref-field.full{grid-column:1/-1}
        .student-profile-preferences .rf-pref-field label{font-size:9px;font-weight:750;color:${T.ink60};text-transform:uppercase;letter-spacing:.04em}
        .student-profile-preferences .rf-btn-secondary{border:1px solid rgba(20,32,26,.12);background:${T.white};color:${T.ink};border-radius:9px;padding:9px;font-size:10.5px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
        .student-profile-preferences .rf-btn-primary{border:0;background:${T.jacaranda};color:${T.paper};border-radius:9px;padding:9px;font-size:10.5px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
        .student-profile-preferences .rf-property-preview{display:flex;align-items:center;gap:14px;background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:16px;padding:14px;flex-wrap:wrap}
        .student-profile-preferences .rf-property-preview-img{width:76px;height:76px;border-radius:12px;object-fit:cover;flex-shrink:0;background:${T.paperDim}}
        .student-profile-preferences .rf-property-preview-body{flex:1;min-width:180px}
        .student-profile-preferences .rf-property-preview-body h2{font-size:15px;margin:0 0 4px;font-family:'Sora',sans-serif;color:${T.ink}}
        .student-profile-preferences .rf-property-preview-body p{font-size:11px;color:${T.ink60};margin:0 0 6px;display:flex;align-items:center;gap:3px}
        .student-profile-preferences .rf-property-preview-meta{display:flex;gap:10px;font-size:10.5px;color:${T.ink};font-weight:700}
        .student-profile-preferences .rf-property-picker{margin-top:4px}
        .student-profile-preferences .rf-property-picker>label{display:block;font-size:11px;font-weight:700;color:${T.ink};margin-bottom:7px}
        .student-profile-preferences .rf-property-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:7px}
        .student-profile-preferences .rf-property-choice{display:flex;flex-direction:column;min-width:0;padding:0;overflow:hidden;border:1px solid rgba(20,32,26,.12);border-radius:12px;background:${T.white};text-align:left;cursor:pointer}
        .student-profile-preferences .rf-property-choice img{width:100%;height:96px;object-fit:cover;display:block}
        .student-profile-preferences .rf-property-choice-body{display:flex;flex-direction:column;gap:3px;padding:9px}
        .student-profile-preferences .rf-property-choice-body strong{font-size:11.5px;color:${T.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .student-profile-preferences .rf-property-choice-body small,.student-profile-preferences .rf-property-choice-body em{display:flex;align-items:center;gap:3px;font-size:9.5px;color:${T.ink60};font-style:normal}
        .student-profile-preferences .rf-property-choice-body em{color:${T.ink};font-weight:650}
        .student-profile-preferences .rf-property-select-card{position:relative;display:flex;gap:10px;align-items:stretch;margin-top:7px;padding:7px;border:1px solid rgba(20,32,26,.2);border-radius:12px;background:${T.white};cursor:pointer}
        .student-profile-preferences .rf-property-select-card>img{width:92px;height:78px;object-fit:cover;border-radius:8px;flex:none}
        .student-profile-preferences .rf-property-select-info{min-width:0;padding:2px 48px 2px 0}
        .student-profile-preferences .rf-property-selected-label{display:flex;align-items:center;gap:4px;font-size:8.5px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
        .student-profile-preferences .rf-property-select-info h4{margin:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .student-profile-preferences .rf-property-select-info p{display:flex;align-items:center;gap:3px;margin:3px 0;font-size:9.5px;color:${T.ink60}}
        .student-profile-preferences .rf-property-select-meta{display:flex;gap:9px;font-size:9.5px}
        .student-profile-preferences .rf-property-select-meta span{color:${T.ink60}}
        .student-profile-preferences .rf-property-change{position:absolute;right:7px;top:7px;padding:5px 7px!important;font-size:9px!important}
        @media(max-width:640px){
          .student-profile-preferences .rf-pref-grid{grid-template-columns:1fr}
          .student-profile-preferences .rf-pref-field.full{grid-column:auto}
          .student-profile-preferences .rf-section-head{flex-direction:column;align-items:flex-start}
          .student-profile-preferences .rf-property-choice-grid{grid-template-columns:1fr}
          .student-profile-preferences .rf-property-choice img{height:110px}
          .student-profile-preferences .rf-property-preview{padding:12px}
          .student-profile-preferences .rf-property-preview-img{width:64px;height:64px}
        }
      `}</style>
      <div className="f-mono mb-2 flex items-center gap-2" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".14em" }}>
        <GraduationCap size={12} /> STUDENT PROFILE
      </div>

      <section className="rf-section" style={{ margin: 0 }}>
        <div className="rf-section-head">
          <div>
            <h2>Your preferences</h2>
            <p>Used to sort recommended roommates and to prefill your share requests.</p>
          </div>
          <StudentVerificationBadge status={verificationStatus} />
        </div>

        <div className="rf-card">
          {!editing ? (
            <>
              <div className="rf-meta">
                <div className="rf-meta-box"><small>UNIVERSITY</small><b>{studentProfile?.university || "Not set"}</b></div>
                <div className="rf-meta-box"><small>PREFERRED AREA</small><b>{studentProfile?.preferredArea || "Any area"}</b></div>
                <div className="rf-meta-box"><small>BUDGET</small><b>{studentProfile?.budget || "Not set"}</b></div>
                <div className="rf-meta-box"><small>ROOMMATES NEEDED</small><b>{studentProfile?.roommatesNeeded || "Not set"}</b></div>
              </div>
              {selectedPreferenceProperty && <div className="rf-card" style={{ marginTop: 10, background: T.paperDim }}><small style={{ color: T.ink60 }}>PROPERTY TO SHARE</small><div style={{ marginTop: 4, fontWeight: 750 }}>{selectedPreferenceProperty.title}</div><div style={{ fontSize: 10.5, color: T.ink60 }}>{selectedPreferenceProperty.suburb}, {selectedPreferenceProperty.city} · ${selectedPreferenceProperty.rent}/mo</div></div>}
              <button type="button" className="rf-btn-secondary" style={{ maxWidth: 180, marginTop: 14 }} onClick={() => setEditing(true)}>
                Edit preferences
              </button>
            </>
          ) : (
            <>
              <div className="rf-pref-grid">
                <div className="rf-pref-field">
                  <label>University</label>
                  <select style={selectStyle} value={form.university} onChange={(e) => update("university", e.target.value)}>
                    {universities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                </div>
                <div className="rf-pref-field">
                  <label>Preferred area</label>
                  <input style={selectStyle} value={form.preferredArea} onChange={(e) => update("preferredArea", e.target.value)} placeholder="e.g. Mt Pleasant" />
                </div>
                <div className="rf-pref-field">
                  <label>Budget</label>
                  <input style={selectStyle} value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="e.g. $180" />
                </div>
                <div className="rf-pref-field">
                  <label>Accommodation type</label>
                  <select style={selectStyle} value={form.accommodationPreference} onChange={(e) => update("accommodationPreference", e.target.value)}>
                    {ACCOMMODATION_PREFERENCES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="rf-pref-field">
                  <label>Roommates needed</label>
                  <select style={selectStyle} value={form.roommatesNeeded} onChange={(e) => update("roommatesNeeded", e.target.value)}>
                    <option value="1">1 roommate</option>
                    <option value="2">2 roommates</option>
                    <option value="3">3 roommates</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
                <div className="rf-pref-field full">
                  <label>Property I want to share</label>
                  <PropertyPicker
                    properties={savedProperties}
                    value={form.roommatePropertyId}
                    onChange={(value) => update("roommatePropertyId", value)}
                    hint="Choose a saved property you would actually consider sharing. You can also start this flow directly from a property in Explore."
                  />
                </div>
                {selectedPreferenceProperty && (
                  <div className="rf-pref-field full">
                    <div className="rf-property-preview" style={{ padding: 10 }}>
                      <img src={photosFor(selectedPreferenceProperty.id)[0]} alt="" className="rf-property-preview-img" style={{ width: 58, height: 58 }} />
                      <div className="rf-property-preview-body"><h2 style={{ fontSize: 13 }}>{selectedPreferenceProperty.title}</h2><p><MapPin size={11} />{selectedPreferenceProperty.suburb}, {selectedPreferenceProperty.city}</p><div className="rf-property-preview-meta"><span>${selectedPreferenceProperty.rent}/mo</span><span>{selectedPreferenceProperty.rooms} rooms</span></div></div>
                    </div>
                  </div>
                )}
                <div className="rf-pref-field full">
                  <label>Lifestyle notes (optional)</label>
                  <input style={selectStyle} value={form.lifestyleNotes} onChange={(e) => update("lifestyleNotes", e.target.value)} placeholder="e.g. quiet, early riser, non-smoker" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="rf-btn-primary" style={{ flex: "none", padding: "9px 16px" }} disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save preferences"}
                </button>
                <button type="button" className="rf-btn-secondary" style={{ flex: "none", padding: "9px 16px" }} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="rounded-xl p-3.5 mt-3" style={{ background: T.paperDim }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12.5 }}>{studentProfile?.university || "No university set"}</div>
          <StudentVerificationBadge status={verificationStatus} />
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {verificationStatus === "unverified" && (
            <button type="button" onClick={handleRequestVerification} disabled={requesting} className="f-body font-semibold px-3 py-2 rounded-full" style={{ background: T.jacaranda, color: T.paper, fontSize: 11, border: "none", cursor: "pointer", opacity: requesting ? 0.7 : 1 }}>
              {requesting ? "Requesting…" : "Request verification"}
            </button>
          )}
          {verificationStatus === "pending" && <span className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>We'll update this once your student status has been checked.</span>}
        </div>
      </div>
    </div>
  );
}

export default StudentProfileSection;
