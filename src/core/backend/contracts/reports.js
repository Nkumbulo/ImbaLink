import { defineBackendContract } from "../contract";

export const REPORT_METHODS = [
  "reportListing",
  "getMyReportForListing",
];

export const reportRepositoryContract = defineBackendContract(
  "ReportRepository",
  REPORT_METHODS
);
