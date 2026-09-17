/** Infrastructure adapter: canonical student/property sharing persistence boundary. */
import { supabase } from '../../../services/supabase';
import { requireCurrentUserId } from '../domains/shared/identity';
import { newId } from '../../../services/ids';
import { normalizeStudentProfile } from '../../../services/db/profile';
import { createSharingService } from '../implementations/sharing/sharing';

export const {
  createShareRequest,
  getShareRequests,
  getUniversityGeneralShareRequestStudents,
  getActiveShareRequestsForProperty,
  getMyShareRequestForProperty,
  setShareRequestStatus,
  withdrawShareRequest,
  deleteShareRequest,
  getShareRequestCountsByProperty,
} = createSharingService({ supabase, requireCurrentUserId, newId, normalizeStudentProfile });
