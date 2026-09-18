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

const required = {
  auth: AUTH_METHODS,
  propertyRepository: PROPERTY_REPOSITORY_METHODS,
  profileRepository: PROFILE_REPOSITORY_METHODS,
  accountStateRepository: ACCOUNT_STATE_REPOSITORY_METHODS,
  interactionRepository: INTERACTION_METHODS,
  messageRepository: MESSAGE_REPOSITORY_METHODS,
  conversationRepository: CONVERSATION_REPOSITORY_METHODS,
  storage: STORAGE_METHODS,
  realtime: REALTIME_METHODS,
  functions: FUNCTIONS_METHODS,
  studentRepository: STUDENT_METHODS,
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
      "messageRepository",
      "conversationRepository",
      "storage",
      "realtime",
      "functions",
      "studentRepository",
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
