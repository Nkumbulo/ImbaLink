import { createBackend } from "../../core/backend/createBackend";
import { supabaseAuthAdapter } from "./adapters/auth";
import { supabasePropertyRepository } from "./adapters/properties";
import { supabaseProfileRepository } from "./adapters/profiles";
import { supabaseAccountStateRepository } from "./adapters/accountState";
import { supabaseInteractionRepository } from "./adapters/interactions";
import { supabaseViewingRequestRepository } from "./adapters/viewingRequests";
import { supabaseEnquiryRepository } from "./adapters/enquiries";
import { supabaseReportRepository } from "./adapters/reports";
import * as supabaseRegistrationRepository from "./adapters/registrations";
import { supabaseStudentRepository } from "./adapters/students";
import { supabaseNotificationRepository } from "./adapters/notifications";
import { supabaseSharingRepository } from "./adapters/sharing";
import { supabaseQuoteRepository } from "./adapters/quotes";
import { supabaseSupportRepository } from "./adapters/support";
import { createSupabaseVerificationRepository } from "./adapters/verification";
import { supabaseStorage } from "./adapters/storage";
import { setStoragePort } from "../../core/data/implementations/shared/storagePort";
import { invalidatePropertyCache } from "../../core/data/implementations/properties/queries";
import { resetContractorCache } from "../../core/data/implementations/interactions/contractors";
import { supabase } from "./client";
import { subscribeToPropertyFeed } from "../../core/data/implementations/properties/queries";
import { supabaseLegalDocumentRepository } from "./adapters/legalDocuments";
import {
  supabaseMessageRepository,
  supabaseConversationRepository,
} from "./adapters/messaging";

const supabaseVerificationRepository = createSupabaseVerificationRepository({
  invalidatePropertyCache,
  resetContractorCache,
});

const storage = supabaseStorage;
setStoragePort(storage);

const realtimeSubscriptions = new WeakMap();

const realtime = Object.freeze({
  subscribe(topic, handler) {
    if (topic !== "property-feed") {
      throw new Error(`Realtime topic is not supported: ${String(topic)}`);
    }
    const unsubscribe = subscribeToPropertyFeed(handler);
    const handle = { unsubscribe };
    realtimeSubscriptions.set(handle, unsubscribe);
    return handle;
  },

  unsubscribe(handle) {
    const unsubscribe = realtimeSubscriptions.get(handle);
    if (typeof unsubscribe !== "function") return;
    realtimeSubscriptions.delete(handle);
    unsubscribe();
  },
});

const functions = Object.freeze({
  async invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) throw error;
    return data;
  },
});

/**
 * The application's current backend composition root.
 *
 * New code should receive this object rather than importing Supabase.
 * Unmigrated domains intentionally fail loudly if called through a contract;
 * this prevents a half-wired adapter from silently changing production data.
 */
export const backend = createBackend({
  auth: supabaseAuthAdapter,
  propertyRepository: supabasePropertyRepository,
  profileRepository: supabaseProfileRepository,
  accountStateRepository: supabaseAccountStateRepository,
  interactionRepository: supabaseInteractionRepository,
  viewingRequestRepository: supabaseViewingRequestRepository,
  enquiryRepository: supabaseEnquiryRepository,
  reportRepository: supabaseReportRepository,
  registrationRepository: supabaseRegistrationRepository,
  studentRepository: supabaseStudentRepository,
  notificationRepository: supabaseNotificationRepository,
  sharingRepository: supabaseSharingRepository,
  quoteRepository: supabaseQuoteRepository,
  supportRepository: supabaseSupportRepository,
  verificationRepository: supabaseVerificationRepository,
  messageRepository: supabaseMessageRepository,
  conversationRepository: supabaseConversationRepository,
  storage,
  realtime,
  functions,
  legalDocumentRepository: supabaseLegalDocumentRepository,
});
