/** Infrastructure adapter: canonical listing-report persistence boundary. */
import { supabase } from '../../../services/supabase';
import { activeUserKey } from '../domains/shared/identity';
import { createReportService } from '../implementations/reports/reports';

export const { reportListing, getMyReportForListing } = createReportService({ supabase, activeUserKey });
