import { supabase } from "../client";
import { requireUser } from "../../../core/data/domains/shared/identity";
import { readPublicUserProfiles } from "../../../core/data/domains/shared/publicProfiles";
import { idbPut } from "../../../core/infrastructure/indexeddb";
import { enqueue } from "../../../core/sync/outbox";
import { newId } from "../../../services/ids";
import { createViewingRequestService } from "../../../core/data/implementations/viewingRequests/viewingRequests";

export const supabaseViewingRequestRepository = Object.freeze(
  createViewingRequestService({
    supabase,
    requireUser,
    readPublicUserProfiles,
    idbPut,
    enqueue,
    newId,
  })
);
