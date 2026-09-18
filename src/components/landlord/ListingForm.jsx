import { useState } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { X, Plus, Loader2 } from "lucide-react";
import { T } from "../../styles/tokens";
import BasicFields from "./ListingForm/BasicFields";
import PhotosField from "./ListingForm/PhotosField";
import DetailsFields from "./ListingForm/DetailsFields";
import { useListingFormState } from "./ListingForm/useListingForm";

export const PHASE_LABEL = {
  "uploading-photos": (p) => p.photosTotal ? `Uploading photo ${Math.min(p.photosDone + 1, p.photosTotal)} of ${p.photosTotal}…` : "Uploading photos…",
  "creating-listing": (_p, isEditing) => isEditing ? "Saving your changes…" : "Publishing your listing…",
  "saving-photos": () => "Saving photo details…",
  "done": () => "Done!",
};

export default function ListingForm({ onClose, onCreate, onUpdate, listing }) {
  useBodyScrollLock(true);
  const isEditing = !!listing?.id;
  const state = useListingFormState(listing);
  const { form, error, setError, busyPhotos, submitting, setSubmitting, fileRef, submittingRef, updateField, toggleItem, pickPhotos, removePhoto } = state;
  const [progress, setProgress] = useState(null);
  const inputClass = "w-full rounded-xl px-3 py-2.5 f-body outline-none";
  // 16px is not a stylistic choice — it's the minimum font size mobile
  // Safari (and Chrome on Android) will accept on a focused input without
  // auto-zooming the whole page in. Below that threshold, tapping ANY
  // field here — even briefly — zoomed the viewport in every time, on
  // every field, on every visit to this form. This is the actual fix, not
  // a cosmetic tweak: everything else on the form (labels, buttons, helper
  // text) is unaffected since only focusable text-entry elements trigger
  // this browser behavior.
  const inputStyle = { background: T.paperDim, color: T.ink, border: `1px solid ${T.line}`, fontSize: 16 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || submitting || busyPhotos) return;
    if (!form.title.trim() || !form.suburb.trim() || !form.description.trim() || Number(form.rent) <= 0) return setError("Complete the listing title, location, description and valid rent.");
    if (form.images.length === 0) return setError("Add at least one photo before submitting your listing.");
    submittingRef.current = true; setSubmitting(true);
    setProgress({ phase: "uploading-photos", percent: 0, photosDone: 0, photosTotal: form.images.length });
    const payload = { ...form, title: form.title.trim(), suburb: form.suburb.trim(), streetAddress: form.streetAddress.trim(), description: form.description.trim(), rent: Number(form.rent), deposit: Number(form.deposit), rooms: Number(form.rooms), bathrooms: Number(form.bathrooms), city: "Harare", postedDaysAgo: 0, grad: [T.jacaranda, T.brick], ...(isEditing ? { verification: listing.verification, landlordVerified: listing.landlordVerified } : {}) };
    setError("");
    try {
      if (isEditing) await onUpdate(listing.id, payload, { onProgress: setProgress });
      else await onCreate({ ...payload, verification: "pending", ownershipVerified: false, landlordVerified: true }, { onProgress: setProgress });
    } catch (submitError) {
      // Most transient failures never reach here at all anymore — photo
      // uploads retry themselves automatically several times behind the
      // scenes first (see retryWithBackoff in services/db/properties/
      // mutations.js). This still shows if every retry for a given photo
      // is exhausted, or for a genuinely non-retryable problem (offline,
      // a missing local photo, a real server rejection).
      const code = String(submitError?.message || "");
      let friendly = isEditing ? "We couldn't save your changes right now." : "We couldn't submit your listing right now.";
      if (/PHOTO.*REQUIRED/i.test(code)) friendly = "Please add at least one photo before trying again.";
      else if (/UNAVAILABLE/i.test(code)) friendly = "One of your photos is no longer available. Please add that photo again, then try again.";
      else if (/OFFLINE|network|fetch|timeout|timed out/i.test(code)) friendly = "You're offline or the connection is taking too long. Check your connection and try again.";
      setError(friendly);
    } finally { submittingRef.current = false; setSubmitting(false); setProgress(null); }
  };

  return <div className="fixed inset-0 z-[1000] sm:z-50 flex items-end form-modal-backdrop" style={{ background: "rgba(20,32,26,.62)" }}>
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto p-5 form-modal-panel" style={{ background:T.paper, borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:"92%", overflowY:"auto", width:"100%" }}>
      <div className="flex items-center justify-between mb-5"><div><div className="f-display font-bold" style={{color:T.ink,fontSize:18}}>{isEditing?"Edit listing":"Add a property"}</div><div className="f-body mt-1" style={{color:T.ink60,fontSize:10.5}}>{isEditing?"Changes are visible immediately.":"All listings are stored as pending until verified."}</div></div><button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:T.paperDim}}><X size={17}/></button></div>
      <div className="space-y-3.5">
        <BasicFields form={form} updateField={updateField} inputClass={inputClass} inputStyle={inputStyle}/>
        <PhotosField form={form} fileRef={fileRef} busyPhotos={busyPhotos} pickPhotos={pickPhotos} removePhoto={removePhoto}/>
        <DetailsFields form={form} updateField={updateField} toggleItem={toggleItem} inputClass={inputClass} inputStyle={inputStyle}/>
      </div>
      {error && <div className="mt-3 rounded-xl p-3 f-body" style={{background:"rgba(184,61,49,.1)",color:T.brick,fontSize:10.5}}><div>{error}</div><button type="button" onClick={()=>handleSubmit({preventDefault(){}})} disabled={submitting||busyPhotos} className="mt-2 px-3 py-1.5 rounded-full font-semibold" style={{background:T.brick,color:T.paper,fontSize:10.5,opacity:submitting||busyPhotos?0.6:1}}>Try again</button></div>}
      {progress && (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between mb-1.5">
            <span className="f-body font-semibold" style={{ color: T.ink, fontSize: 10.5 }}>
              {(PHASE_LABEL[progress.phase] || PHASE_LABEL["uploading-photos"])(progress, isEditing)}
            </span>
            <span className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>{progress.percent}%</span>
          </div>
          <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}
            style={{ height: 6, borderRadius: 999, background: T.paperDim, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress.percent}%`,
              borderRadius: 999,
              background: T.brick,
              transition: "width 0.25s ease",
            }} />
          </div>
        </div>
      )}
      <button type="submit" disabled={submitting||busyPhotos} className="w-full mt-5 py-3.5 rounded-full f-display font-semibold flex items-center justify-center gap-2" style={{background:T.brick,color:T.paper,fontSize:13,opacity:submitting||busyPhotos?0.65:1,cursor:submitting||busyPhotos?"wait":"pointer",pointerEvents:submitting||busyPhotos?"none":"auto"}}>
        {submitting ? <><Loader2 size={16} className="spin"/> {isEditing?"Saving changes…":"Uploading photos & publishing…"}</> : isEditing ? <>Save changes</> : <><Plus size={16}/> Submit listing for verification</>}
      </button>
    </form>
  </div>;
}
