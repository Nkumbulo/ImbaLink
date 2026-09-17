/** Infrastructure adapter: canonical landlord-enquiry persistence boundary. */
import { supabase } from '../../../services/supabase';
import { requireUser } from '../domains/shared/identity';
import { createEnquiryService } from '../implementations/enquiries/enquiries';

export const { getLandlordEnquiryCounts } = createEnquiryService({ supabase, requireUser });
