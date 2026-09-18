import { defineBackendContract } from "../contract";

export const ACCOUNT_STATE_REPOSITORY_METHODS = [
  "getUserState",
  "saveUserState",
];

export const accountStateRepositoryContract = defineBackendContract(
  "AccountStateRepository",
  ACCOUNT_STATE_REPOSITORY_METHODS
);
