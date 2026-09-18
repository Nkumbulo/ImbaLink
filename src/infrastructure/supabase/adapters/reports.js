/** Infrastructure adapter: listing-report persistence boundary. */
import { supabase } from "../client";
import { activeUserKey } from "../../../core/data/implementations/shared/identity";
import { createReportService } from "../../../core/data/implementations/reports/reports";

export const supabaseReportRepository = Object.freeze(
  createReportService({ supabase, activeUserKey })
);
