import { findProfileById } from '../../core/data/domains/profile.js';
import { getLandlordListings } from '../../core/data/domains/properties.js';
import { useEffect, useState } from "react";
import { X, MapPin, Home, Loader2, Building2 } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../common/Avatar";
import VerifiedBadge from "../common/VerifiedBadge";

function initials(name) {
  return String(name || "U").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "U";
}

export default function ListerProfile({ lister, listings = [], onClose, onOpen }) {
  const [profile, setProfile] = useState(lister || null);
  const [profileListings, setProfileListings] = useState(listings || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!lister?.id) return;
      setLoading(true);
      setError("");
      try {
        // Load the public profile and all listings directly from the owner id.
        // This keeps the profile page independent from the currently loaded feed.
        const [publicProfile, ownerListings] = await Promise.all([
          findProfileById(lister.id),
          getLandlordListings(lister.id),
        ]);
        if (cancelled) return;
        setProfile({
          ...lister,
          ...(publicProfile || {}),
          id: String(publicProfile?.id || lister.id),
        });
        setProfileListings(Array.isArray(ownerListings) ? ownerListings : []);
      } catch (err) {
        console.warn("Failed to load public profile:", err);
        if (!cancelled) setError("Couldn't load this public profile right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [lister?.id]);

  if (!lister) return null;
  const name = profile?.name || profile?.displayName || lister.name || "User";
  const avatarUrl = profile?.avatarUrl || profile?.avatar_url || lister.avatarUrl || "";
  const verified = profile?.verificationStatus === "verified" || profile?.verified === true || lister.verified === true;
  const accountType = profile?.accountType || lister.accountType || "general";

  return (
    <div className="fixed inset-0 z-[99999] flex items-end md:items-center md:justify-center" style={{ background: "rgba(20,32,26,.62)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)" }} onClick={onClose}>
      <div
        className="w-full md:max-w-2xl md:max-h-[88vh] overflow-hidden rounded-t-[28px] md:rounded-[28px]"
        style={{ background: T.paper, boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.line }}>
          <div className="f-display font-bold" style={{ color: T.ink }}>Public profile</div>
          <button type="button" onClick={onClose} aria-label="Close public profile" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: T.paperDim, color: T.ink }}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(88vh-65px)] px-5 pb-6">
          <div className="flex items-center gap-4 py-6">
            <Avatar src={avatarUrl} grad={profile?.grad || lister.grad} letter={initials(name)} size={72} alt={`${name} profile picture`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="f-display font-bold text-xl" style={{ color: T.ink }}>{name}</h2>
                {verified && <VerifiedBadge status="verified" compact size={24} />}
              </div>
              <div className="f-body mt-1 capitalize" style={{ color: T.ink60, fontSize: 12 }}>
                {accountType === "general" ? "ImbaLink member" : `${accountType} account`}
              </div>
              {profile?.city && <div className="f-body flex items-center gap-1 mt-2" style={{ color: T.ink60, fontSize: 12 }}><MapPin size={13} />{profile.city}</div>}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Home size={16} color={T.brick} />
            <h3 className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>Listings</h3>
            <span className="f-body" style={{ color: T.ink60, fontSize: 12 }}>({profileListings.length})</span>
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 f-body" style={{ color: T.ink60 }}><Loader2 size={18} className="animate-spin" /> Loading profile…</div>
          ) : error ? (
            <div className="py-8 text-center f-body" style={{ color: T.ink60 }}>{error}</div>
          ) : profileListings.length === 0 ? (
            <div className="py-10 text-center rounded-2xl" style={{ background: T.paperDim }}>
              <Building2 size={28} color={T.ink60} style={{ margin: "0 auto 8px" }} />
              <div className="f-body font-semibold" style={{ color: T.ink }}>No public listings</div>
              <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 12 }}>This user hasn't published a rental place yet.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profileListings.map((p) => {
                const image = Array.isArray(p.images) && p.images[0] ? p.images[0] : p.imageUrl || p.image || "";
                return (
                  <button key={String(p.id)} type="button" onClick={() => onOpen?.(p)} className="text-left rounded-2xl overflow-hidden border" style={{ borderColor: T.line, background: T.paper }}>
                    <div className="h-36 overflow-hidden" style={{ background: T.paperDim }}>
                      {image ? <img src={image} alt={p.title || "Rental listing"} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Home size={28} color={T.ink60} /></div>}
                    </div>
                    <div className="p-3">
                      <div className="f-display font-bold truncate" style={{ color: T.ink, fontSize: 14 }}>{p.title || "Rental listing"}</div>
                      <div className="f-body flex items-center gap-1 mt-1 truncate" style={{ color: T.ink60, fontSize: 11 }}><MapPin size={12} />{p.suburb || p.city || "Location unavailable"}</div>
                      <div className="f-display font-bold mt-2" style={{ color: T.brick, fontSize: 14 }}>${Number(p.rent || 0).toLocaleString()}<span className="f-body font-normal" style={{ color: T.ink60, fontSize: 10 }}> / month</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
