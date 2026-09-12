import { useEffect, useRef, useState } from "react";
import { Home, Eye, MessageCircle, ShieldCheck } from "lucide-react";
import useMediaQuery from "../hooks/useMediaQuery";
import { T } from "../styles/tokens";
import { getLandlordEnquiryCounts, getLandlordViewingRequests } from "../core/data/domains/interactions.js";
import ListingForm from "../components/landlord/ListingForm";
import LandlordRegistration from "../components/landlord/LandlordRegistration";
import LandlordIdentityVerification from "../components/landlord/LandlordIdentityVerification";
import LandlordHubHeader from "../features/landlord/components/LandlordHubHeader";
import LandlordHubStats from "../features/landlord/components/LandlordHubStats";
import LandlordListings from "../features/landlord/components/LandlordListings";
import LandlordViewingRequests from "../features/landlord/components/LandlordViewingRequests";
import LandlordHubToast from "../features/landlord/components/LandlordHubToast";

export default function LandlordDashboardPage({
  properties,
  viewingRequested,
  threads,
  onCreateListing,
  onUpdateListing,
  onDeleteListing,
  onToggleListingPause,
  onOpenProperty,
  onOpenMessages,
  landlordRegistration,
  onRegisterLandlord,
  profile,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [toast, setToast] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [enquiryCounts, setEnquiryCounts] = useState(new Map());
  const creatingListingRef = useRef(false);
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const myListings = properties.filter((p) => String(p.ownerUserId || p.userId || "") === String(profile?.id || null));

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) { setIncomingRequests([]); return undefined; }
    getLandlordViewingRequests(profile.id)
      .then((rows) => { if (!cancelled) setIncomingRequests(rows.filter((r) => r.status === "requested")); })
      .catch(() => { if (!cancelled) setIncomingRequests([]); });
    return () => { cancelled = true; };
  }, [profile?.id, myListings.length]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) { setEnquiryCounts(new Map()); return undefined; }
    getLandlordEnquiryCounts(profile.id)
      .then((counts) => { if (!cancelled) setEnquiryCounts(counts); })
      .catch(() => { if (!cancelled) setEnquiryCounts(new Map()); });
    return () => { cancelled = true; };
  }, [profile?.id, myListings.length]);

  const requested = incomingRequests;
  const activeChats = Object.keys(threads).length;
  const verified = myListings.filter((p) => p.verification === "verified").length;
  const stats = [
    [myListings.length, "Listings", Home],
    [requested.length, "Viewings", Eye],
    [activeChats, "Messages", MessageCircle],
    [verified, "Verified", ShieldCheck],
  ];

  const containerStyle = {
    maxWidth: isDesktop ? 1200 : "100%",
    margin: isDesktop ? "0 auto" : undefined,
    padding: isTabletOrDesktop ? "24px" : "0 16px 16px",
  };
  const listingsAndRequestsRowStyle = isTabletOrDesktop
    ? { display: "grid", gridTemplateColumns: isDesktop ? "1.5fr 1fr" : "1fr", gap: 24, marginTop: 32 }
    : { marginTop: 24 };
  const statsSectionWrapperProps = isTabletOrDesktop
    ? {}
    : { className: "web-surface", style: { background: T.paper, borderRadius: 18, margin: "0 -16px", padding: "8px 16px 24px" } };

  const showToast = (message, duration = 3000) => {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  };

  const handleAdd = () => {
    if (landlordRegistration) {
      setEditingListing(null);
      setShowForm(true);
    } else if (profile?.accountType === "landlord") {
      setShowVerification(true);
    } else {
      setShowRegistration(true);
    }
  };

  const handleTogglePause = async (event, property) => {
    event.stopPropagation();
    if (togglingId === property.id) return;
    setTogglingId(property.id);
    try {
      await onToggleListingPause?.(property.id, !property.isPaused);
      showToast(property.isPaused ? "Listing resumed — viewing requests are open again." : "Listing paused — viewing requests are temporarily unavailable.");
    } catch (error) {
      showToast(error?.message || "Could not update the listing status.", 4000);
    } finally {
      setTogglingId(null);
    }
  };

  const handleEdit = (event, property) => {
    event.stopPropagation();
    setEditingListing(property);
    setShowForm(true);
  };

  const handleDelete = async (event, property) => {
    event.stopPropagation();
    if (deletingId === property.id) return;
    if (!window.confirm(`Delete “${property.title}”? This cannot be undone.`)) return;
    setDeletingId(property.id);
    try {
      await onDeleteListing(property.id);
      showToast("Property deleted successfully.");
    } catch (error) {
      showToast(error?.message || "Could not delete the property.", 4000);
    } finally {
      setDeletingId(null);
    }
  };

  const closeForm = () => { setShowForm(false); setEditingListing(null); };

  return (
    <div className="pb-8 web-page">
      <LandlordHubHeader
        isTabletOrDesktop={isTabletOrDesktop}
        isDesktop={isDesktop}
        landlordRegistration={landlordRegistration}
        profile={profile}
        onAdd={handleAdd}
      />

      <div style={containerStyle}>
        <div {...statsSectionWrapperProps}>
          <LandlordHubStats stats={stats} isTabletOrDesktop={isTabletOrDesktop} isDesktop={isDesktop} />
          <div style={listingsAndRequestsRowStyle}>
            <LandlordListings
              listings={myListings}
              profile={profile}
              enquiryCounts={enquiryCounts}
              togglingId={togglingId}
              deletingId={deletingId}
              onOpenProperty={onOpenProperty}
              onTogglePause={handleTogglePause}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
            <LandlordViewingRequests requests={requested} onOpenMessages={onOpenMessages} />
          </div>
        </div>
      </div>

      {showForm && landlordRegistration && (
        <ListingForm
          listing={editingListing}
          onClose={closeForm}
          onCreate={async (listing) => {
            if (creatingListingRef.current) return;
            creatingListingRef.current = true;
            try {
              const hasPhotos = Array.isArray(listing?.mediaIds) && listing.mediaIds.filter(Boolean).length > 0;
              await onCreateListing(listing);
              setShowForm(false);
              showToast(hasPhotos ? "Property listed successfully. Photos are uploaded and ready." : "Property listed successfully.", 3500);
            } finally {
              creatingListingRef.current = false;
            }
          }}
          onUpdate={async (propertyId, listing) => {
            await onUpdateListing(propertyId, listing);
            setShowForm(false);
            setEditingListing(null);
            showToast("Property updated successfully.", 3500);
          }}
        />
      )}

      <LandlordHubToast message={toast} />

      {showVerification && (
        <LandlordIdentityVerification userId={profile?.id} onClose={() => setShowVerification(false)} />
      )}
      {showRegistration && (
        <LandlordRegistration
          profile={profile}
          onClose={() => setShowRegistration(false)}
          onSubmit={async (data) => {
            try {
              await onRegisterLandlord(data);
              setShowRegistration(false);
            } catch (error) {
              showToast(error?.message || "Could not complete landlord registration.", 5000);
            }
          }}
        />
      )}
    </div>
  );
}
