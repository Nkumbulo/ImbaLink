import { useCallback } from "react";
import { createMessageNavigation } from "./messageNavigation";

/**
 * App-level navigation actions that need to coordinate tab state with the
 * currently selected conversation/property.
 */
export default function useAppNavigation({
  properties,
  setMessagesState,
  setTab,
  setCollectionsView,
}) {
  const navigate = useCallback((next, subView) => {
    if (next === "saved" && subView) setCollectionsView(subView);
    setTab(next);
  }, [setCollectionsView, setTab]);

  const openMessageThread = useCallback((propertyId, otherUserId) => {
    if (propertyId === undefined || propertyId === null || propertyId === "") return;

    let resolvedOtherUserId = otherUserId;
    if (!resolvedOtherUserId) {
      const targetProperty = properties.find((property) => String(property.id) === String(propertyId));
      resolvedOtherUserId = targetProperty?.ownerUserId ||
        targetProperty?.owner_user_id ||
        targetProperty?.landlordUserId ||
        targetProperty?.landlord_user_id ||
        null;
    }

    setMessagesState(createMessageNavigation({
      propertyId,
      otherUserId: resolvedOtherUserId,
    }));
    setTab("messages");
  }, [properties, setMessagesState, setTab]);

  const openRoommateMessageThread = useCallback((roommateId, roommateName, templateMessage) => {
    if (roommateId === undefined || roommateId === null || roommateId === "") return;
    setMessagesState(createMessageNavigation({ roommateId, roommateName, templateMessage }));
    setTab("messages");
  }, [setMessagesState, setTab]);

  return { navigate, openMessageThread, openRoommateMessageThread };
}
