/** Supabase-backed registration repository.
 *
 * The domain implementations remain compatibility-safe while the application
 * receives them through the explicit backend contract.
 */
export {
  registerAgent, getAgentRegistration, getAllAgentRegistrations,
} from "../../../core/data/implementations/registrations/agent.js";
export {
  registerCompany, getCompanyRegistration, getAllCompanyRegistrations,
} from "../../../core/data/implementations/registrations/company.js";
export {
  registerContractor, getContractorRegistrations,
} from "../../../core/data/implementations/registrations/contractor.js";
export {
  getLandlordRegistration, registerLandlord, getLandlordVerification,
  submitLandlordVerification, getAllLandlordRegistrations,
} from "../../../core/data/implementations/registrations/landlord.js";
export {
  getProRegistration, registerPro,
} from "../../../core/data/implementations/registrations/pro.js";
export {
  rowToRegistration, writeRegistration, readRegistration, readRegistrations,
} from "../../../core/data/implementations/registrations/shared.js";
