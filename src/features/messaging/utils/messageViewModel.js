const VIEWING_REQUEST_PATTERN = /^I would like to request a viewing(?: of (.+?))?\.$/i;

export function parseViewingRequest(text) {
  const match = String(text || "").match(VIEWING_REQUEST_PATTERN);
  if (!match) return null;
  return { requestedTitle: match[1]?.trim() || "" };
}

function resolveProperty(requestedTitle, properties, currentProperty) {
  const normalizedTitle = requestedTitle.toLowerCase();
  const exactTitle = requestedTitle
    ? properties.find((p) => String(p?.title || "").trim().toLowerCase() === normalizedTitle)
    : null;
  const fallback = currentProperty &&
    (!requestedTitle || String(currentProperty.title || "").trim().toLowerCase() === normalizedTitle)
    ? currentProperty
    : null;
  return exactTitle || fallback;
}

export function buildViewingRequestContexts({ currentThreadType, rawMessages, properties, currentProperty }) {
  if (currentThreadType !== "property") return [];

  return (rawMessages || [])
    .map((message) => {
      const parsed = parseViewingRequest(message?.text);
      if (!parsed || !message?.senderId) return null;
      const property = resolveProperty(parsed.requestedTitle, properties, currentProperty);
      if (!property) return null;
      return { property, requesterId: String(message.senderId), messageId: message.id || null };
    })
    .filter(Boolean)
    .filter((context, index, all) =>
      all.findIndex((x) =>
        String(x.property.id) === String(context.property.id) &&
        String(x.requesterId) === String(context.requesterId)
      ) === index
    );
}

export function buildCurrentMessages({ rawMessages, currentUserId, properties, currentProperty, getViewingRequestStatus, viewingRequestBusyKey }) {
  return (rawMessages || []).map((message) => {
    const parsed = parseViewingRequest(message?.text);
    let attachment = null;

    if (parsed) {
      const property = resolveProperty(parsed.requestedTitle, properties, currentProperty);
      if (property) {
        const image = Array.isArray(property.images) && property.images.length
          ? property.images[0]
          : property.imageUrl || property.image || null;
        attachment = {
          type: "property",
          id: String(property.id),
          title: property.title || "Property viewing",
          image,
          suburb: property.suburb || property.location || "",
          rent: property.rent != null ? property.rent : null,
          isViewingRequest: true,
          requesterId: message.senderId ? String(message.senderId) : null,
        };
      }
    }

    const requestPropertyId = attachment?.isViewingRequest ? attachment.id : null;
    const requestRequesterId = attachment?.isViewingRequest ? attachment.requesterId : null;
    const requestKey = requestPropertyId && requestRequesterId
      ? `${requestPropertyId}:${requestRequesterId}`
      : null;

    return {
      id: message.id,
      from: message.senderId === currentUserId ? "me" : "them",
      text: message.text,
      ts: message.createdAt,
      status: message.status,
      attachment,
      viewingRequestStatus: requestKey ? getViewingRequestStatus(requestPropertyId, requestRequesterId) : null,
      viewingRequestBusy: requestKey ? viewingRequestBusyKey === requestKey : false,
    };
  });
}

export function buildConversationRows({ conversations, currentUserId, searchQuery, inboxFilter }) {
  const raw = (conversations || [])
    .map((conversation) => {
      if (!conversation?.lastMessage) return null;

      const isContractor = conversation.type === "contractor";
      const isRoommate = conversation.type === "roommate";
      const last = {
        ts: conversation.lastMessage.createdAt,
        text: conversation.lastMessage.text,
        from: conversation.lastMessage.senderId === currentUserId ? "me" : "them",
      };

      const p = isContractor
        ? { id: conversation.contractorId, landlord: conversation.displayName, grad: ["#6E63B8", "#3E3670"] }
        : {
            id: isRoommate ? conversation.roommateId : conversation.propertyId,
            landlord: conversation.displayName,
            grad: conversation.displayAvatar?.grad || ["#6E63B8", "#3E3670"],
            url: conversation.displayAvatar?.url || null,
          };

      return {
        type: isContractor ? "contractor" : isRoommate ? "roommate" : "property",
        p,
        last,
        id: conversation.id,
        threadKey: conversation.id,
        unreadCount: Number(conversation.unreadCount) || 0,
        contractorId: isContractor ? conversation.contractorId : undefined,
        roommateId: isRoommate ? conversation.roommateId : undefined,
      };
    })
    .filter(Boolean);

  const query = searchQuery.trim().toLowerCase();
  let filtered = query
    ? raw.filter((conversation) => String(conversation.p?.landlord || "").toLowerCase().includes(query))
    : raw;

  if (inboxFilter === "unread") {
    filtered = filtered.filter((conversation) => conversation.unreadCount > 0);
  }

  return filtered;
}

export function formatConversationTime(ts) {
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.floor(Math.max(0, Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatMessageTime(ts) {
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.floor(Math.max(0, Date.now() - timestamp) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days === 0) {
    if (hours === 0) return minutes === 0 ? "just now" : `${minutes}m ago`;
    return `${hours}h ago`;
  }
  if (days === 1) {
    return `yesterday at ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
