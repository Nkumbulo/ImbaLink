import { defineBackendContract } from "../contract";

export const SHARING_METHODS = [
  "createShareRequest",
  "getShareRequests",
  "getUniversityGeneralShareRequestStudents",
  "getActiveShareRequestsForProperty",
  "getMyShareRequestForProperty",
  "setShareRequestStatus",
  "withdrawShareRequest",
  "deleteShareRequest",
  "getShareRequestCountsByProperty",
];

export const sharingRepositoryContract = defineBackendContract(
  "SharingRepository",
  SHARING_METHODS
);
