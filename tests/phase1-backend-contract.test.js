import { describe, expect, it } from "vitest";
import { createBackend } from "../src/core/backend/createBackend";
import { AUTH_METHODS } from "../src/core/backend/contracts/auth";
import {
  MESSAGE_REPOSITORY_METHODS,
  CONVERSATION_REPOSITORY_METHODS,
} from "../src/core/backend/contracts/messaging";
import { PROFILE_REPOSITORY_METHODS } from "../src/core/backend/contracts/profiles";
import { ACCOUNT_STATE_REPOSITORY_METHODS } from "../src/core/backend/contracts/accountState";
import { INTERACTION_METHODS } from "../src/core/backend/contracts/interactions";
import { PROPERTY_REPOSITORY_METHODS } from "../src/core/backend/contracts/properties";
import { REALTIME_METHODS } from "../src/core/backend/contracts/realtime";
import { STORAGE_METHODS } from "../src/core/backend/contracts/storage";
import { FUNCTIONS_METHODS } from "../src/core/backend/contracts/functions";
import { STUDENT_METHODS } from "../src/core/backend/contracts/students";
import { VIEWING_REQUEST_METHODS } from "../src/core/backend/contracts/viewingRequests";
import { ENQUIRY_REPOSITORY_METHODS } from "../src/core/backend/contracts/enquiries";
import { REPORT_METHODS } from "../src/core/backend/contracts/reports";
import { REGISTRATION_METHODS } from "../src/core/backend/contracts/registrations";
import { NOTIFICATION_METHODS } from "../src/core/backend/contracts/notifications";
import { SHARING_METHODS } from "../src/core/backend/contracts/sharing";
import { QUOTE_METHODS } from "../src/core/backend/contracts/quotes";
import { SUPPORT_METHODS } from "../src/core/backend/contracts/support";
import { VERIFICATION_METHODS } from "../src/core/backend/contracts/verification";
import { LEGAL_DOCUMENT_METHODS } from "../src/core/backend/contracts/legalDocuments";

// Kept in the same order createBackend.js composes them, so a future new
// domain there is easy to notice missing here.
const required = {
  auth: AUTH_METHODS,
  propertyRepository: PROPERTY_REPOSITORY_METHODS,
  profileRepository: PROFILE_REPOSITORY_METHODS,
  accountStateRepository: ACCOUNT_STATE_REPOSITORY_METHODS,
  interactionRepository: INTERACTION_METHODS,
  viewingRequestRepository: VIEWING_REQUEST_METHODS,
  enquiryRepository: ENQUIRY_REPOSITORY_METHODS,
  reportRepository: REPORT_METHODS,
  registrationRepository: REGISTRATION_METHODS,
  studentRepository: STUDENT_METHODS,
  notificationRepository: NOTIFICATION_METHODS,
  sharingRepository: SHARING_METHODS,
  quoteRepository: QUOTE_METHODS,
  supportRepository: SUPPORT_METHODS,
  verificationRepository: VERIFICATION_METHODS,
  messageRepository: MESSAGE_REPOSITORY_METHODS,
  conversationRepository: CONVERSATION_REPOSITORY_METHODS,
  storage: STORAGE_METHODS,
  realtime: REALTIME_METHODS,
  functions: FUNCTIONS_METHODS,
  legalDocumentRepository: LEGAL_DOCUMENT_METHODS,
};

function mockImplementation(methods) {
  return Object.fromEntries(methods.map((method) => [method, () => undefined]));
}

function completeMockBackend() {
  return Object.fromEntries(
    Object.entries(required).map(([name, methods]) => [name, mockImplementation(methods)])
  );
}

describe("Phase 1 backend contracts", () => {
  it("defines every required backend capability explicitly", () => {
    expect(Object.keys(required)).toEqual([
      "auth",
      "propertyRepository",
      "profileRepository",
      "accountStateRepository",
      "interactionRepository",
      "viewingRequestRepository",
      "enquiryRepository",
      "reportRepository",
      "registrationRepository",
      "studentRepository",
      "notificationRepository",
      "sharingRepository",
      "quoteRepository",
      "supportRepository",
      "verificationRepository",
      "messageRepository",
      "conversationRepository",
      "storage",
      "realtime",
      "functions",
      "legalDocumentRepository",
    ]);

    for (const methods of Object.values(required)) {
      expect(methods.length).toBeGreaterThan(0);
      expect(new Set(methods).size).toBe(methods.length);
    }
  });

  it("accepts a complete provider implementation", () => {
    const backend = createBackend(completeMockBackend());

    for (const [name, methods] of Object.entries(required)) {
      expect(backend[name]).toBeDefined();
      for (const method of methods) {
        expect(typeof backend[name][method]).toBe("function");
      }
    }
  });

  it("rejects a missing backend domain instead of allowing a partial composition", () => {
    const implementation = completeMockBackend();
    delete implementation.propertyRepository;

    expect(() => createBackend(implementation)).toThrow(
      "PropertyRepository implementation is required."
    );
  });

  it("rejects a missing method instead of silently accepting a partial adapter", () => {
    const implementation = completeMockBackend();
    delete implementation.propertyRepository.updateProperty;

    expect(() => createBackend(implementation)).toThrow(
      "PropertyRepository is missing required method: updateProperty()"
    );
  });

  it("returns an immutable backend composition", () => {
    const backend = createBackend(completeMockBackend());

    expect(Object.isFrozen(backend)).toBe(true);
  });
});
