import { useEffect, useState, useCallback } from "react";
import { Eye, Trash2, X, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from "lucide-react";
import { T } from "../../styles/tokens";
import { getAdminProperties, adminFormat } from "../../services/admin/adminAnalytics";
import { getAdminPropertyImages, deleteAdminPropertyImage } from "../../services/admin/adminTools";
import { EmptyState, LoadingState, SearchInput, Pagination, StatusPill } from "./shared";

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["all", "pending", "verified", "rejected", "flagged"];

export default function PropertiesSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [deletingImageId, setDeletingImageId] = useState(null);

  const openGallery = async (property) => {
    setGallery({ property, images: [] });
    setGalleryLoading(true);
    setGalleryError("");
    try {
      const images = await getAdminPropertyImages(property.id);
      setGallery((current) => current ? { ...current, images } : current);
    } catch (err) {
      setGalleryError(err?.message || "Could not load property photos.");
    } finally {
      setGalleryLoading(false);
    }
  };

  const removeImage = async (image) => {
    if (!window.confirm("Delete this property photo? This cannot be undone.")) return;
    setDeletingImageId(image.id);
    try {
      await deleteAdminPropertyImage(image.id);
      setGallery((current) => current ? {
        ...current,
        images: current.images.filter((item) => item.id !== image.id),
      } : current);
    } catch (err) {
      setGalleryError(err?.message || "Could not delete this photo.");
    } finally {
      setDeletingImageId(null);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    getAdminProperties({ search, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((res) => setData(res || { rows: [], total: 0 }))
      .catch((err) => setError(err?.message || "Could not load properties."))
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  return (
    <div>
      <div className="mb-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title, city, suburb…" />
      </div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="f-body font-medium px-3 py-1.5 rounded-full capitalize shrink-0"
            style={{
              background: status === s ? T.ink : T.paperDim,
              color: status === s ? T.paper : T.ink,
              fontSize: 11,
              border: "none",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>}
      {!loading && !error && data.rows.length === 0 && <EmptyState label="No properties match." />}

      {!loading && !error && data.rows.length > 0 && (
        <div className="space-y-1.5">
          {data.rows.map((p) => (
            <div key={p.id} className="rounded-xl p-3" style={{ background: T.paperDim }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 12.5 }}>{p.title}</div>
                  <div className="f-body truncate" style={{ color: T.ink60, fontSize: 10.5 }}>
                    {p.owner_name} · {p.suburb}, {p.city} · ${p.rent_usd}/mo
                  </div>
                </div>
                <StatusPill status={p.verification} />
              </div>
              <div className="f-body" style={{ color: T.ink60, fontSize: 10, marginBottom: 8 }}>
                {adminFormat.number(p.view_count)} views · {adminFormat.number(p.save_count)} saves · {adminFormat.number(p.request_count)} requests
              </div>
              <button type="button" onClick={() => openGallery(p)} className="inline-flex items-center gap-1.5 f-body font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.paper, color: T.ink, border: `1px solid ${T.line}`, fontSize: 10.5 }}>
                <ImageIcon size={13} /> Review photos
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && data.total > PAGE_SIZE && (
        <Pagination page={page} hasMore={page * PAGE_SIZE < data.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
      )}

      {gallery && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.72)" }} onClick={() => setGallery(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl" style={{ background: T.paper }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: `1px solid ${T.line}` }}>
              <div className="min-w-0">
                <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 14 }}>{gallery.property.title}</div>
                <div className="f-body" style={{ color: T.ink60, fontSize: 11 }}>{gallery.property.owner_name} · {gallery.images.length} photo{gallery.images.length === 1 ? "" : "s"}</div>
              </div>
              <button type="button" onClick={() => setGallery(null)} aria-label="Close photo review" style={{ border: 0, background: "transparent", color: T.ink }}><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 78px)" }}>
              {galleryLoading && <div className="flex items-center justify-center py-12" style={{ color: T.ink60 }}><Loader2 size={20} className="animate-spin" /></div>}
              {galleryError && <div className="f-body p-3 rounded-xl mb-3" style={{ background: T.paperDim, color: T.brick, fontSize: 12 }}>{galleryError}</div>}
              {!galleryLoading && !galleryError && gallery.images.length === 0 && <div className="flex flex-col items-center justify-center py-12" style={{ color: T.ink60 }}><ImageIcon size={30} style={{ opacity: .35 }} /><div className="f-body mt-2" style={{ fontSize: 12 }}>No photos uploaded.</div></div>}
              {!galleryLoading && gallery.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gallery.images.map((image, index) => (
                    <div key={image.id} className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "4 / 3", background: T.paperDim, border: `1px solid ${T.line}` }}>
                      <img src={image.url} alt={`${gallery.property.title} photo ${index + 1}`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.72))", paddingTop: 28 }}>
                        <span className="f-body font-medium" style={{ color: "white", fontSize: 10 }}>Photo {index + 1}{index === 0 ? " · Cover" : ""}</span>
                        <button type="button" onClick={() => removeImage(image)} disabled={deletingImageId === image.id} aria-label={`Delete photo ${index + 1}`} className="inline-flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, border: 0, background: "rgba(255,255,255,.92)", color: T.brick, cursor: deletingImageId === image.id ? "wait" : "pointer" }}>
                          {deletingImageId === image.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
