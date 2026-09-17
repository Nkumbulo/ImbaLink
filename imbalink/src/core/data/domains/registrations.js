/** Canonical registration domain API. Explicit exports keep the public
 * boundary statically discoverable during the Core/legacy migration.
 */
export { registerAgent, getAgentRegistration, getAllAgentRegistrations } from '../adapters/registrations.js';
export { registerCompany, getCompanyRegistration, getAllCompanyRegistrations } from '../adapters/registrations.js';
export { registerContractor, getContractorRegistrations } from '../adapters/registrations.js';
export { getLandlordRegistration, registerLandlord, getLandlordVerification, submitLandlordVerification, getAllLandlordRegistrations } from '../adapters/registrations.js';
export { getProRegistration, registerPro } from '../adapters/registrations.js';
export { rowToRegistration, writeRegistration, readRegistration, readRegistrations } from '../adapters/registrations.js';
