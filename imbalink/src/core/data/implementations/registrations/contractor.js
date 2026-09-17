/** Canonical contractor registration data operations. */
// debug.noveatech: restore the contractor registration exports used by account state. 
import { activeUserKey } from '../shared/identity.js';
import { readRegistrations, writeRegistration } from './shared.js';

export async function registerContractor(input) {
  return writeRegistration('contractor', input, 'contractorreg');
}

export async function getContractorRegistrations(userId = activeUserKey()) {
  return readRegistrations('contractor', userId);
}
