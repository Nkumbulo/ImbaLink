/** Infrastructure adapter: canonical registration persistence boundary. */
export { registerAgent, getAgentRegistration, getAllAgentRegistrations } from '../implementations/registrations/agent.js';
export { registerCompany, getCompanyRegistration, getAllCompanyRegistrations } from '../implementations/registrations/company.js';
export { registerContractor, getContractorRegistrations } from '../implementations/registrations/contractor.js';
export { getLandlordRegistration, registerLandlord, getLandlordVerification, submitLandlordVerification, getAllLandlordRegistrations } from '../implementations/registrations/landlord.js';
export { getProRegistration, registerPro } from '../implementations/registrations/pro.js';
export { rowToRegistration, writeRegistration, readRegistration, readRegistrations } from '../implementations/registrations/shared.js';
