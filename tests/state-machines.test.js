import { describe, expect, it } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  isTerminal,
  PAYMENT_STATES,
  PROPERTY_STATES,
  PRO_MEMBERSHIP_STATES,
  REPORT_STATES,
  USER_STATES,
  VERIFICATION_STATES,
  VIEWING_STATES,
} from '../src/core/domain/stateMachines';

describe('ImbaLink lifecycle contracts', () => {
  it('exposes canonical state sets', () => {
    expect(USER_STATES).toEqual(['pending','approved','rejected','suspended','banned']);
    expect(PROPERTY_STATES).toContain('pending_review');
    expect(VERIFICATION_STATES).toContain('flagged');
    expect(VIEWING_STATES).toContain('completed');
    expect(REPORT_STATES).toContain('reviewing');
    expect(PAYMENT_STATES).toContain('refunded');
    expect(PRO_MEMBERSHIP_STATES).toContain('past_due');
  });

  it('prevents illegal user escalation', () => {
    expect(canTransition('user', 'pending', 'approved')).toBe(true);
    expect(canTransition('user', 'pending', 'banned')).toBe(false);
    expect(canTransition('user', 'banned', 'approved')).toBe(false);
  });

  it('protects property publication lifecycle', () => {
    expect(canTransition('property', 'pending_review', 'approved')).toBe(true);
    expect(canTransition('property', 'rejected', 'approved')).toBe(false);
    expect(canTransition('property', 'flagged', 'approved')).toBe(true);
  });

  it('protects terminal viewing states', () => {
    expect(canTransition('viewing', 'requested', 'accepted')).toBe(true);
    expect(canTransition('viewing', 'completed', 'requested')).toBe(false);
    expect(isTerminal('viewing', 'completed')).toBe(true);
  });

  it('allows reopening dismissed reports but not resolved reports', () => {
    expect(canTransition('report', 'dismissed', 'open')).toBe(true);
    expect(canTransition('report', 'resolved', 'open')).toBe(false);
  });

  it('returns only legal next states', () => {
    expect(getAllowedTransitions('payment', 'processing')).toEqual(['paid','failed','cancelled']);
  });
});
