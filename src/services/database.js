/**
 * @deprecated Compatibility facade for legacy callers.
 *
 * Phase 2 moves application code to domain APIs under src/core/data/domains/.
 * Keep this facade temporarily for backwards compatibility with external
 * integrations and older modules; new code MUST import a domain API directly.
 */
import * as profile from '../core/data/domains/profile';
import * as properties from '../core/data/domains/properties';
import * as registrations from '../core/data/domains/registrations';
import * as notifications from '../core/data/domains/notifications';
import * as interactions from '../core/data/domains/interactions';
import * as students from '../core/data/domains/students';
import * as sharing from '../core/data/domains/sharing';
import * as quotes from '../core/data/domains/quotes';
import * as messaging from '../core/data/domains/messaging';
import * as verification from '../core/data/domains/verification';
import * as debug from '../core/data/domains/debug';

export const db = {
  ...profile,
  ...properties,
  ...registrations,
  ...notifications,
  ...interactions,
  ...students,
  ...sharing,
  ...quotes,
  ...messaging,
  ...verification,
  ...debug,
};

export const SCHEMA_VERSION = 7;
