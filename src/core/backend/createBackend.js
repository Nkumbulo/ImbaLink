import { authContract } from "./contracts/auth";
import { propertyRepositoryContract } from "./contracts/properties";
import { profileRepositoryContract } from "./contracts/profiles";
import { accountStateRepositoryContract } from "./contracts/accountState";
import { interactionRepositoryContract } from "./contracts/interactions";
import { viewingRequestRepositoryContract } from "./contracts/viewingRequests";
import { enquiryRepositoryContract } from "./contracts/enquiries";
import { reportRepositoryContract } from "./contracts/reports";
import { registrationRepositoryContract } from "./contracts/registrations";
import { studentRepositoryContract } from "./contracts/students";
import { notificationRepositoryContract } from "./contracts/notifications";
import { sharingRepositoryContract } from "./contracts/sharing";
import { quoteRepositoryContract } from "./contracts/quotes";
import { supportRepositoryContract } from "./contracts/support";
import { verificationRepositoryContract } from "./contracts/verification";
import {
  messageRepositoryContract,
  conversationRepositoryContract,
} from "./contracts/messaging";
import { storageContract } from "./contracts/storage";
import { realtimeContract } from "./contracts/realtime";
import { functionsContract } from "./contracts/functions";
import { legalDocumentRepositoryContract } from "./contracts/legalDocuments";

/**
 * Dependency-injection boundary for the application backend.
 *
 * Phase 1 only establishes and validates the shape. Existing features still
 * use their compatibility/domain paths, so this factory does not alter
 * runtime behavior yet.
 */
export function createBackend(implementation = {}) {
  return Object.freeze({
    auth: authContract.validate(implementation.auth),
    propertyRepository: propertyRepositoryContract.validate(
      implementation.propertyRepository
    ),
    profileRepository: profileRepositoryContract.validate(
      implementation.profileRepository
    ),
    accountStateRepository: accountStateRepositoryContract.validate(
      implementation.accountStateRepository
    ),
    interactionRepository: interactionRepositoryContract.validate(
      implementation.interactionRepository
    ),
    viewingRequestRepository: viewingRequestRepositoryContract.validate(
      implementation.viewingRequestRepository
    ),
    enquiryRepository: enquiryRepositoryContract.validate(
      implementation.enquiryRepository
    ),
    reportRepository: reportRepositoryContract.validate(
      implementation.reportRepository
    ),
    registrationRepository: registrationRepositoryContract.validate(
      implementation.registrationRepository
    ),
    studentRepository: studentRepositoryContract.validate(
      implementation.studentRepository
    ),
    notificationRepository: notificationRepositoryContract.validate(
      implementation.notificationRepository
    ),
    sharingRepository: sharingRepositoryContract.validate(
      implementation.sharingRepository
    ),
    quoteRepository: quoteRepositoryContract.validate(implementation.quoteRepository),
    supportRepository: supportRepositoryContract.validate(implementation.supportRepository),
    verificationRepository: verificationRepositoryContract.validate(implementation.verificationRepository),
    messageRepository: messageRepositoryContract.validate(
      implementation.messageRepository
    ),
    conversationRepository: conversationRepositoryContract.validate(
      implementation.conversationRepository
    ),
    storage: storageContract.validate(implementation.storage),
    realtime: realtimeContract.validate(implementation.realtime),
    functions: functionsContract.validate(implementation.functions),
    legalDocumentRepository: legalDocumentRepositoryContract.validate(implementation.legalDocumentRepository),
  });
}
