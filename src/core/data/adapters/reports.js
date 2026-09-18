/** Compatibility facade: listing reports use the application backend boundary. */
import { backend } from "../../../application/backend/index.js";

export const reportListing = (...args) => backend.reportRepository.reportListing(...args);
export const getMyReportForListing = (...args) => backend.reportRepository.getMyReportForListing(...args);
