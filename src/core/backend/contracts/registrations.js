import { defineBackendContract } from "../contract";

export const REGISTRATION_METHODS = [
  "registerAgent",
  "getAgentRegistration",
  "getAllAgentRegistrations",
  "registerCompany",
  "getCompanyRegistration",
  "getAllCompanyRegistrations",
  "registerContractor",
  "getContractorRegistrations",
  "getLandlordRegistration",
  "registerLandlord",
  "getLandlordVerification",
  "submitLandlordVerification",
  "getAllLandlordRegistrations",
  "getProRegistration",
  "registerPro",
  "rowToRegistration",
  "writeRegistration",
  "readRegistration",
  "readRegistrations",
];

export const registrationRepositoryContract = defineBackendContract(
  "RegistrationRepository",
  REGISTRATION_METHODS
);
