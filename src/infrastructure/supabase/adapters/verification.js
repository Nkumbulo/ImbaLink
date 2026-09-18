/** Infrastructure adapter: consumer verification persistence boundary. */
import { supabase } from "../client";
import { createVerificationService } from "../../../core/data/implementations/verification/verification";

const setStatus = async ({ storeName, id, status, note }) => {
  const { data, error } = await supabase.rpc("set_verification_status", {
    p_store_name: storeName,
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
  return data;
};

export function createSupabaseVerificationRepository({
  invalidatePropertyCache,
  resetContractorCache,
}) {
  return Object.freeze(
    createVerificationService({
      setStatus,
      invalidatePropertyCache,
      resetContractorCache,
    })
  );
}

// Compatibility/default export. The legacy path remains usable without
// importing cache state from infrastructure; the composed backend supplies the
// real cache invalidators at the application composition root.
export const supabaseVerificationRepository = createSupabaseVerificationRepository({
  invalidatePropertyCache: () => {},
  resetContractorCache: () => {},
});

export const { setVerificationStatus } = supabaseVerificationRepository;
