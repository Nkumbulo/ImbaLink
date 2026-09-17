import { useEffect, useState } from "react";
import { getFirstName } from "./textHelpers";
import { findConversationWith } from "../../core/data/domains/interactions.js";

export function useMessageThreadState({
  properties = [],
  contractorId,
  contractorName,
  roommateId,
  roommateName,
  templateMessage,
  propertyId,
  otherUserId,
  clearMessagesState,
  onActiveConversationChange,
}) {
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [currentThreadName, setCurrentThreadName] = useState("");
  const [currentThreadType, setCurrentThreadType] = useState(null);
  const [currentThreadRealId, setCurrentThreadRealId] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (contractorId === null || contractorId === undefined || contractorId === "") return;

    setCurrentThreadId(contractorId);
    setCurrentThreadRealId(null);
    setCurrentThreadName(getFirstName(contractorName));
    setCurrentThreadType("contractor");
    if (templateMessage) setInputValue(templateMessage);
  }, [contractorId, contractorName, templateMessage]);

  useEffect(() => {
    if (roommateId === null || roommateId === undefined || roommateId === "") return;

    setCurrentThreadId(roommateId);
    setCurrentThreadRealId(null);
    setCurrentThreadName(getFirstName(roommateName));
    setCurrentThreadType("roommate");
    if (templateMessage) setInputValue(templateMessage);
  }, [roommateId, roommateName, templateMessage]);

  useEffect(() => {
    if (propertyId === null || propertyId === undefined || propertyId === "") return;

    const targetProperty = properties.find(
      (property) => String(property?.id) === String(propertyId)
    );

    if (targetProperty) {
      setCurrentThreadId(targetProperty.id);
      if (otherUserId) {
        findConversationWith(otherUserId).then((id) => {
          if (id) setCurrentThreadRealId(id);
        });
      } else {
        setCurrentThreadRealId(null);
      }
      setCurrentThreadName(getFirstName(targetProperty.landlord));
      setCurrentThreadType("property");
      setInputValue("");
    }

    if (typeof clearMessagesState === "function") clearMessagesState();
  }, [propertyId, otherUserId, properties, clearMessagesState]);

  const handleBack = () => {
    onActiveConversationChange?.(null);
    setCurrentThreadId(null);
    setCurrentThreadRealId(null);
    setCurrentThreadName("");
    setCurrentThreadType(null);
    setInputValue("");
    setIsInputFocused(false);
  };

  const openThread = (conversation) => {
    if (!conversation) return;

    onActiveConversationChange?.(conversation.id || null);
    setCurrentThreadRealId(conversation.id || null);

    if (conversation.type === "contractor") {
      setCurrentThreadId(conversation.contractorId);
      setCurrentThreadName(getFirstName(conversation.displayName));
      setCurrentThreadType("contractor");
    } else if (conversation.type === "roommate") {
      setCurrentThreadId(conversation.roommateId);
      setCurrentThreadName(getFirstName(conversation.displayName));
      setCurrentThreadType("roommate");
    } else {
      setCurrentThreadId(conversation.propertyId || conversation.id);
      setCurrentThreadName(getFirstName(conversation.displayName));
      setCurrentThreadType("property");
    }

    setInputValue("");
    setIsInputFocused(false);
  };

  return {
    currentThreadId,
    currentThreadName,
    currentThreadType,
    currentThreadRealId,
    setCurrentThreadRealId,
    inputValue,
    setInputValue,
    isInputFocused,
    setIsInputFocused,
    handleBack,
    openThread,
  };
}
