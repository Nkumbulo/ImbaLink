import { defineBackendContract } from "../contract";

export const AUTH_METHODS = [
  "getSession",
  "getCurrentUser",
  "signIn",
  "signOut",
  "onAuthStateChange",
  "hydrateSession",
  "sessionFromSupabase",
  "completeProfile",
  "updateProfile",
  "handleNativeOAuthRedirect",
];

export const authContract = defineBackendContract("Auth", AUTH_METHODS);
