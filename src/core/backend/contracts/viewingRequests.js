import { defineBackendContract } from "../contract";

export const VIEWING_REQUEST_METHODS = [
  "requestViewing",
  "respondToViewingRequest",
  "findConversationWith",
  "getViewingRequestStatus",
  "getLandlordViewingRequests",
  "subscribeViewingRequestStatuses",
];

export const viewingRequestRepositoryContract = defineBackendContract(
  "ViewingRequestRepository",
  VIEWING_REQUEST_METHODS
);
