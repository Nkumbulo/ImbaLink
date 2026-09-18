/** Infrastructure adapter: canonical student/property sharing persistence boundary. */
import { supabase } from "../client";
import { requireCurrentUserId } from "../../../core/data/implementations/shared/identity";
import { newId } from "../../../services/ids";
import { normalizeStudentProfile } from "../../../core/data/implementations/shared/helpers";
import { createSharingService } from "../../../core/data/implementations/sharing/sharing";

export const supabaseSharingRepository = Object.freeze(
  createSharingService({ supabase, requireCurrentUserId, newId, normalizeStudentProfile })
);

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
} = supabaseSharingRepository;
