import { defineBackendContract } from "../contract";

export const QUOTE_METHODS = [
  "createQuoteRequest",
  "getQuoteRequests",
];

export const quoteRepositoryContract = defineBackendContract(
  "QuoteRepository",
  QUOTE_METHODS
);
