import { defineBackendContract } from "../contract";

export const VERIFICATION_METHODS = ["setVerificationStatus"];

export const verificationRepositoryContract = defineBackendContract(
  "VerificationRepository",
  VERIFICATION_METHODS
);
