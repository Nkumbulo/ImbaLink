import { defineBackendContract } from "../contract";

export const FUNCTIONS_METHODS = [
  "invoke",
];

export const functionsContract = defineBackendContract(
  "Functions",
  FUNCTIONS_METHODS
);
