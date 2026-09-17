import { activeUserKey } from '../shared/identity';
import { readRegistration, readRegistrations, writeRegistration } from './shared';

export async function registerCompany(input) {
  return writeRegistration('company', input, 'companyreg');
}

export async function getCompanyRegistration(userId = activeUserKey()) {
  return readRegistration('company', userId);
}

export async function getAllCompanyRegistrations() {
  return readRegistrations('company');
}
