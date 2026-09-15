import { useState, useRef, useCallback } from "react";
import { prepareImages, deleteMedia, MAX_IMAGES_PER_LISTING } from "../../../services/media/imageStore";

const createInitialForm = (listing) => listing ? {
  title: listing.title || "", suburb: listing.suburb || "", streetAddress: listing.streetAddress || listing.street || "",
  type: listing.type || listing.propertyType || "House", rent: listing.rent ?? 150, deposit: listing.deposit ?? 150,
  rooms: listing.rooms ?? 2, bathrooms: listing.bathrooms ?? 1, bathroomType: listing.bathroomType || "Private",
  furnished: !!listing.furnished, availability: listing.availability || "Available now", leaseTerm: listing.leaseTerm || "12 months",
  description: listing.description || "", amenities: Array.isArray(listing.amenities) ? listing.amenities : [],
  rules: Array.isArray(listing.rules) ? listing.rules : [], electricity: listing.electricity || "Prepaid meter",
  water: listing.water || "Council water", security: listing.security || "Walled + gate", parking: !!listing.parking,
  ownershipType: listing.ownershipType || "Owner", ownershipReference: listing.ownershipReference || "",
  contactPreference: listing.contactPreference || "Phone", images: Array.isArray(listing.images) ? listing.images : [],
  mediaIds: Array.isArray(listing.images) ? listing.images.map(() => null) : [],
} : {
  title: "", suburb: "", streetAddress: "", type: "House", rent: 150, deposit: 150, rooms: 2, bathrooms: 1,
  bathroomType: "Private", furnished: false, availability: "Available now", leaseTerm: "12 months", description: "",
  amenities: [], rules: [], electricity: "Prepaid meter", water: "Council water", security: "Walled + gate", parking: false,
  ownershipType: "Owner", ownershipReference: "", contactPreference: "Phone", images: [], mediaIds: [],
};

export function useListingFormState(listing) {
  const [form, setForm] = useState(() => createInitialForm(listing));
  const [error, setError] = useState("");
  const [busyPhotos, setBusyPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const submittingRef = useRef(false);
  const updateField = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);
  const toggleItem = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(x => x !== value) : [...prev[key], value] })), []);
  const pickPhotos = useCallback(async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return;
    const room = MAX_IMAGES_PER_LISTING - form.images.length;
    if (room <= 0) return setError(`You can add up to ${MAX_IMAGES_PER_LISTING} photos.`);
    setBusyPhotos(true); setError("");
    try {
      const prepared = await prepareImages(files.slice(0, room), { ownerType: "listing" });
      if (!prepared.length) setError("Those files couldn't be read as photos. Try JPG or PNG.");
      else setForm(prev => ({ ...prev, images: [...prev.images, ...prepared.map(p => p.dataUrl)], mediaIds: [...(prev.mediaIds || []), ...prepared.map(p => p.id)] }));
    } catch { setError("Something went wrong adding those photos."); }
    finally { setBusyPhotos(false); }
  }, [form.images.length]);
  const removePhoto = useCallback((i) => {
    const mediaId = (form.mediaIds || [])[i]; if (mediaId) deleteMedia(mediaId);
    setForm(prev => ({ ...prev, images: prev.images.filter((_, x) => x !== i), mediaIds: (prev.mediaIds || []).filter((_, x) => x !== i) }));
  }, [form.mediaIds]);
  return { form, setForm, error, setError, busyPhotos, submitting, setSubmitting, fileRef, submittingRef, updateField, toggleItem, pickPhotos, removePhoto };
}
