import { supabase } from "../client";
import { requireUser } from "../../../core/data/domains/shared/identity";
import { createEnquiryService } from "../../../core/data/implementations/enquiries/enquiries";

export const supabaseEnquiryRepository = Object.freeze(
  createEnquiryService({ supabase, requireUser })
);
