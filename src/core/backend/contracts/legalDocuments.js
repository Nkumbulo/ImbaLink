import { defineBackendContract } from "../contract";

export const LEGAL_DOCUMENT_METHODS = [
  "getPublishedLegalDocument",
];

export const legalDocumentRepositoryContract = defineBackendContract(
  "LegalDocumentRepository",
  LEGAL_DOCUMENT_METHODS
);
