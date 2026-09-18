/** Infrastructure adapter: contractor quote persistence boundary. */
import { supabase } from "../client";
import { requireUser } from "../../../core/data/domains/shared/identity";
import { newId } from "../../../services/ids";
import { createQuoteService } from "../../../core/data/implementations/quotes/quotes";

export const supabaseQuoteRepository = Object.freeze(
  createQuoteService({ supabase, requireUser, newId })
);

export const { createQuoteRequest, getQuoteRequests } = supabaseQuoteRepository;
