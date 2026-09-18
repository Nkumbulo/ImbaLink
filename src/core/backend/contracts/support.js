import { defineBackendContract } from "../contract";

export const SUPPORT_METHODS = ["submitSupportRequest"];

export const supportRepositoryContract = defineBackendContract(
  "SupportRepository",
  SUPPORT_METHODS
);
