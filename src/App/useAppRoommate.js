import { useCallback, useEffect, useState } from "react";
import { backend } from "../application/backend/index.js";

/**
 * Owns the Find-a-Roommate navigation context and its property-level badge
 * counts. This state only exists to bridge the Student flow into and back out
 * of the services/roommate view.
 */
export default function useAppRoommate({
  studentMode,
  tab,
  properties,
  openProperty,
  setTab,
}) {
  const [shareRequestCounts, setShareRequestCounts] = useState({});
  const [roommatePropertyId, setRoommatePropertyId] = useState(null);
  const [roommateOriginTab, setRoommateOriginTab] = useState("search");
  const [roommateOriginHadDetailOpen, setRoommateOriginHadDetailOpen] = useState(false);

  const refreshShareRequestCounts = useCallback(async () => {
    const counts = await backend.sharingRepository.getShareRequestCountsByProperty().catch(() => ({}));
    setShareRequestCounts(counts || {});
  }, []);

  useEffect(() => {
    if (!studentMode) return;
    refreshShareRequestCounts();
  }, [refreshShareRequestCounts, studentMode]);

  useEffect(() => {
    if (tab !== "services") setRoommatePropertyId(null);
  }, [tab]);

  const openRoommateForProperty = useCallback((property, { fromDetail = false } = {}) => {
    setRoommateOriginTab(tab);
    setRoommateOriginHadDetailOpen(fromDetail);
    setRoommatePropertyId(property?.id ?? null);
    setTab("services");
  }, [setTab, tab]);

  const returnFromRoommateFinder = useCallback(() => {
    const property = properties.find((item) => String(item.id) === String(roommatePropertyId));
    const hadDetailOpen = roommateOriginHadDetailOpen;
    setRoommatePropertyId(null);
    setRoommateOriginHadDetailOpen(false);
    setTab(roommateOriginTab || "search");
    if (hadDetailOpen && property) openProperty(property);
  }, [openProperty, properties, roommateOriginHadDetailOpen, roommateOriginTab, roommatePropertyId, setTab]);

  return {
    shareRequestCounts,
    refreshShareRequestCounts,
    roommatePropertyId,
    openRoommateForProperty,
    returnFromRoommateFinder,
  };
}
