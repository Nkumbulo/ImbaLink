import { defineBackendContract } from "../contract";

export const PROFILE_REPOSITORY_METHODS = [
  "getProfile",
  "getProfiles",
  "getPublicProfile",
  "updateProfile",
  "upsertProfile",
];

export const profileRepositoryContract = defineBackendContract(
  "ProfileRepository",
  PROFILE_REPOSITORY_METHODS
);
