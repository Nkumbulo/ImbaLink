/**
 * Canonical ImbaLink lifecycle contracts.
 *
 * These are deliberately framework-independent. UI, hooks and services should
 * ask this module whether a transition is legal instead of duplicating status
 * conditionals across components. The database migration 032 enforces the
 * same transition graph at the authoritative boundary.
 */

export const USER_STATES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'suspended',
  'banned',
]);

export const PROPERTY_STATES = Object.freeze([
  'pending_review',
  'approved',
  'rejected',
  'flagged',
  'sold',
  'rented',
  'expired',
]);

export const VERIFICATION_STATES = Object.freeze([
  'pending',
  'verified',
  'rejected',
  'flagged',
]);

export const VIEWING_STATES = Object.freeze([
  'requested',
  'accepted',
  'declined',
  'cancelled',
  'completed',
]);

export const REPORT_STATES = Object.freeze([
  'open',
  'reviewing',
  'resolved',
  'dismissed',
]);

export const PAYMENT_STATES = Object.freeze([
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
  'cancelled',
  'expired',
]);

export const PRO_MEMBERSHIP_STATES = Object.freeze([
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'suspended',
]);

const transitions = Object.freeze({
  user: {
    pending: ['approved', 'rejected'],
    approved: ['suspended', 'banned'],
    rejected: ['pending'],
    suspended: ['approved', 'banned'],
    banned: [],
  },
  property: {
    pending_review: ['approved', 'rejected', 'flagged'],
    approved: ['flagged', 'sold', 'rented', 'expired'],
    rejected: ['pending_review'],
    flagged: ['pending_review', 'approved', 'rejected'],
    sold: ['approved'],
    rented: ['approved'],
    expired: ['pending_review', 'approved'],
  },
  verification: {
    pending: ['verified', 'rejected', 'flagged'],
    verified: ['flagged'],
    rejected: ['pending'],
    flagged: ['pending', 'verified', 'rejected'],
  },
  viewing: {
    requested: ['accepted', 'declined', 'cancelled'],
    accepted: ['completed', 'cancelled'],
    declined: [],
    cancelled: [],
    completed: [],
  },
  report: {
    open: ['reviewing', 'resolved', 'dismissed'],
    reviewing: ['resolved', 'dismissed'],
    resolved: [],
    dismissed: ['open'],
  },
  payment: {
    pending: ['processing', 'cancelled', 'expired'],
    processing: ['paid', 'failed', 'cancelled'],
    paid: ['refunded'],
    failed: ['pending'],
    refunded: [],
    cancelled: ['pending'],
    expired: ['pending'],
  },
  pro_membership: {
    pending: ['active', 'cancelled'],
    active: ['past_due', 'cancelled', 'expired', 'suspended'],
    past_due: ['active', 'cancelled', 'suspended', 'expired'],
    cancelled: ['pending'],
    expired: ['pending'],
    suspended: ['active', 'cancelled'],
  },
});

export function getAllowedTransitions(machine, from) {
  return [...(transitions[machine]?.[from] || [])];
}

export function canTransition(machine, from, to) {
  if (!transitions[machine] || !transitions[machine][from]) return false;
  return from === to || transitions[machine][from].includes(to);
}

export function assertTransition(machine, from, to) {
  if (!canTransition(machine, from, to)) {
    const error = new Error(`Invalid ${machine} transition: ${from} -> ${to}`);
    error.code = 'INVALID_STATE_TRANSITION';
    error.machine = machine;
    error.from = from;
    error.to = to;
    throw error;
  }
  return true;
}

export function transition(machine, state, to) {
  assertTransition(machine, state, to);
  return to;
}

export function isTerminal(machine, state) {
  return getAllowedTransitions(machine, state).length === 0;
}

export const STATE_MACHINES = Object.freeze(transitions);
