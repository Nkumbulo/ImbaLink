import { defineBackendContract } from "../contract";

export const ENQUIRY_REPOSITORY_METHODS = ["getLandlordEnquiryCounts"];

export const enquiryRepositoryContract = defineBackendContract(
  "EnquiryRepository",
  ENQUIRY_REPOSITORY_METHODS
);
