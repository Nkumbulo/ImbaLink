/**
 * Listing photos.
 *
 * Before this module the app had no way to add a photo at all: property
 * records carry an `images: [url]` array and every consumer (PostCard,
 * GridTile, PropertyDetail, RoommateFinderPage) renders those straight into
 * `<img src>`, but `ListingForm` initialised `images: []` and never filled
 * it, so a landlord's own listing had no pictures. Seeded catalog photos are
 * remote Unsplash URLs.
 *
 * Design constraint: whatever a photo becomes, it has to keep working as an
 * `<img src>` string, because changing that would mean touching every
 * consumer — exactly the kind of change that breaks a working UI. So a
 * captured photo is downscaled and stored as a `data:` URL, which drops
 * straight into the existing `images` array with no consumer changes at all.
 *
 * The original Blob is kept alongside it in the `media` store, keyed by a
 * media id that is also recorded on the listing (`mediaIds`). That is what
 * makes this a migration path rather than a dead end: when object storage
 * exists, `uploadPending()` walks the unuploaded blobs, PUTs them, and
 * rewrites the listing's `images` entry from the data URL to the returned
 * https URL. The listing shape never changes; only the contents of the
 * string do.
 *
 * Why downscale: a modern phone camera produces a 3–8MB JPEG. Six of those
 * as data URLs is ~40MB of base64 in IndexedDB for one listing, on devices
 * and data plans where that is a real cost. Downscaling to a long edge of
 * 1280px at quality 0.72 lands around 120–220KB per photo, which is more
 * than enough for a listing card and detail view, and keeps a full listing
 * comfortably close to 1MB.
 */

import { idbGet, idbGetAll, idbPut, idbDelete, ensureReady } from "../../core/infrastructure/indexeddb";
import { newId } from "../ids";
import { isBackendEnabled, uploadFile } from "../../core/infrastructure/apiClient";

export const MAX_IMAGES_PER_LISTING = 8;
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.72;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // reject absurd inputs before decoding
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function isAcceptedImage(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  // Some Android pickers hand over an empty MIME type; fall back to the name.
  if (!type) return /\.(jpe?g|png|webp|heic|heif)$/i.test(String(file.name || ""));
  return ACCEPTED_TYPES.includes(type);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("ENCODE_FAILED"))), type, quality);
      return;
    }
    // Very old webviews: dataURL round-trip.
    try {
      const dataUrl = canvas.toDataURL(type, quality);
      const [meta, b64] = dataUrl.split(",");
      const mime = meta.match(/:(.*?);/)?.[1] || type;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: mime }));
    } catch {
      reject(new Error("ENCODE_FAILED"));
    }
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscale one File to a JPEG blob no larger than MAX_EDGE_PX on its long
 * edge. Images already smaller than that are still re-encoded, which strips
 * EXIF — including the GPS coordinates phones attach by default. Publishing
 * a landlord's exact location because they photographed their own house is
 * a privacy leak worth closing here rather than remembering to close later.
 */
async function downscale(file) {
  const img = await loadImage(file);
  const longEdge = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height) || MAX_EDGE_PX;
  const scale = Math.min(1, MAX_EDGE_PX / longEdge);
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  return { blob, width, height };
}

/**
 * Turn picked files into `{ id, dataUrl, width, height, bytes }` records and
 * persist their blobs. Returns only the ones that succeeded — a single
 * unreadable file must not fail the whole selection while the person is
 * mid-listing.
 */
export async function prepareImages(files, { ownerType = "listing", ownerId = null, limit = MAX_IMAGES_PER_LISTING } = {}) {
  const list = Array.from(files || []).filter(isAcceptedImage).slice(0, limit);
  const results = [];

  for (const file of list) {
    if (file.size > MAX_SOURCE_BYTES) continue;
    try {
      const { blob, width, height } = await downscale(file);
      const dataUrl = await blobToDataUrl(blob);
      const id = newId("media");
      await ensureReady();
      await idbPut("media", {
        id,
        ownerType,
        ownerId: ownerId == null ? null : String(ownerId),
        blob,
        mimeType: "image/jpeg",
        width,
        height,
        bytes: blob.size,
        uploaded: false,
        remoteUrl: null,
        createdAt: Date.now(),
      });
      results.push({ id, dataUrl, width, height, bytes: blob.size });
    } catch {
      // Unreadable/corrupt file — skip it.
    }
  }

  return results;
}

/** Attach freshly-created media to their owning record once it has an id. */
export async function assignOwner(mediaIds, ownerId, ownerType = "listing") {
  if (!Array.isArray(mediaIds) || !mediaIds.length || !ownerId) return;
  try {
    await ensureReady();
    for (const id of mediaIds) {
      const record = await idbGet("media", String(id));
      if (record) await idbPut("media", { ...record, ownerId: String(ownerId), ownerType });
    }
  } catch {
    // Non-fatal: the images are already embedded in the owning record.
  }
}

export async function getMediaRecord(id) {
  if (!id) return null;
  try {
    await ensureReady();
    return await idbGet("media", String(id));
  } catch {
    return null;
  }
}

export async function deleteMedia(id) {
  try {
    await ensureReady();
    await idbDelete("media", String(id));
  } catch {
    // nothing to do
  }
}

/** Rough total of locally-held image bytes, for a storage warning later. */
export async function localMediaBytes() {
  try {
    await ensureReady();
    return (await idbGetAll("media")).reduce((total, row) => total + Number(row?.bytes || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Upload every stored blob that hasn't been uploaded yet, and hand back the
 * data-URL -> remote-URL mapping so the caller can rewrite the owning
 * records' `images` arrays. No-op until the backend is configured.
 *
 * Deliberately returns the mapping instead of rewriting records itself:
 * this module knows about bytes, not about what a listing is, and keeping
 * that split is what lets database.js stay the single place that writes
 * property records.
 */
export async function uploadPending({ limit = 20 } = {}) {
  if (!isBackendEnabled()) return [];

  const mapping = [];
  try {
    await ensureReady();
    const pending = (await idbGetAll("media")).filter((row) => row && !row.uploaded && row.blob).slice(0, limit);

    for (const record of pending) {
      try {
        const result = await uploadFile("/v1/media", record.blob, {
          filename: `${record.id}.jpg`,
          fields: { ownerType: record.ownerType || "listing", ownerId: record.ownerId || "" },
        });
        const remoteUrl = result?.url || result?.location || null;
        if (!remoteUrl) continue;

        await idbPut("media", { ...record, uploaded: true, remoteUrl, uploadedAt: Date.now(), blob: undefined });
        mapping.push({ mediaId: record.id, ownerId: record.ownerId, ownerType: record.ownerType, remoteUrl });
      } catch {
        // Leave it pending; the next drain retries.
      }
    }
  } catch {
    // ignore
  }
  return mapping;
}
