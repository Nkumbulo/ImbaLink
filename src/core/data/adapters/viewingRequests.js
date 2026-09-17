/** Infrastructure adapter: canonical viewing-request persistence boundary. */
import { supabase } from '../../../services/supabase';
import { requireUser } from '../domains/shared/identity';
import { readPublicUserProfiles } from '../domains/shared/publicProfiles';
import { idbPut } from '../../infrastructure/indexeddb';
import { enqueue } from '../../sync/outbox';
import { newId } from '../../../services/ids';
import { createViewingRequestService } from '../implementations/viewingRequests/viewingRequests';

export const {
  requestViewing,
  respondToViewingRequest,
  findConversationWith,
  getViewingRequestStatus,
  getLandlordViewingRequests,
  subscribeViewingRequestStatuses,
} = createViewingRequestService({ supabase, requireUser, readPublicUserProfiles, idbPut, enqueue, newId });
