/** Infrastructure adapter: canonical quote persistence boundary. */
import { supabase } from '../../../services/supabase';
import { requireUser } from '../domains/shared/identity';
import { newId } from '../../../services/ids';
import { createQuoteService } from '../implementations/quotes/quotes';

export const { createQuoteRequest, getQuoteRequests } = createQuoteService({ supabase, requireUser, newId });
