/** Infrastructure adapter: support request persistence boundary. */
import { supabase } from "../client";
import { createSupportService } from "../../../core/data/implementations/support/support";

export const supabaseSupportRepository = Object.freeze(
  createSupportService({
    getCurrentUser: () => supabase.auth.getUser().then(({ data }) => data),
    insertRequest: async (payload) => {
      const { error } = await supabase.from("support_requests").insert(payload);
      if (error) throw error;
    },
  })
);

export const { submitSupportRequest } = supabaseSupportRepository;
