import { defineBackendContract } from "../contract";

export const INTERACTION_METHODS = [
  "setPropertyLike",
  "setPropertySave",
  "recordPropertyView",
  "setContractorLike",
];

export const interactionRepositoryContract = defineBackendContract(
  "InteractionRepository",
  INTERACTION_METHODS
);
