import { activeUserKey } from '../shared/identity';
import { readRegistration, readRegistrations, writeRegistration } from './shared';

export async function registerAgent(input) {
  return writeRegistration('agent', input, 'agentreg');
}

export async function getAgentRegistration(userId = activeUserKey()) {
  return readRegistration('agent', userId);
}

export async function getAllAgentRegistrations() {
  return readRegistrations('agent');
}
