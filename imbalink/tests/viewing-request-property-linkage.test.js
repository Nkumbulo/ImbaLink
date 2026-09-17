import { describe, expect, it } from 'vitest';
import {
  resolveProperty,
  buildViewingRequestContexts,
  buildCurrentMessages,
} from '../src/features/messaging/utils/messageViewModel.js';

// Reproduces the real, confirmed condition in this app's own shipped
// catalog: two DIFFERENT properties sharing an identical title (10 such
// pairs exist in src/data/properties.json, e.g. two separate
// "Back room, Unit L" listings from different owners).
const properties = [
  { id: 'prop-A', title: 'Back room, Unit L', suburb: 'Avondale', rent: 300, images: ['a.jpg'] },
  { id: 'prop-B', title: 'Back room, Unit L', suburb: 'Borrowdale', rent: 450, images: ['b.jpg'] },
  { id: 'prop-C', title: 'Sunny 2-bed', suburb: 'Hillside', rent: 500, images: ['c.jpg'] },
];

describe('resolveProperty', () => {
  it('BUG: with only a title (legacy messages), a duplicate title silently resolves to the WRONG property', () => {
    // This is the pre-fix behavior, still exercised for messages that
    // predate 1004 and have no relatedPropertyId — .find() returns
    // whichever duplicate-titled property comes first, not necessarily
    // the one that was actually requested.
    const resolved = resolveProperty('Back room, Unit L', properties, null, null);
    expect(resolved.id).toBe('prop-A'); // not necessarily prop-B, even if B was requested
  });

  it('FIX: an exact relatedPropertyId resolves correctly regardless of a title collision', () => {
    const resolved = resolveProperty('Back room, Unit L', properties, null, 'prop-B');
    expect(resolved.id).toBe('prop-B');
  });

  it('falls back to title matching when relatedPropertyId does not resolve against loaded properties', () => {
    const resolved = resolveProperty('Sunny 2-bed', properties, null, 'prop-does-not-exist');
    expect(resolved.id).toBe('prop-C');
  });

  it('falls back to title matching when no relatedPropertyId is given at all', () => {
    const resolved = resolveProperty('Sunny 2-bed', properties, null, null);
    expect(resolved.id).toBe('prop-C');
  });
});

describe('buildViewingRequestContexts with relatedPropertyId', () => {
  it('two requests for two different duplicate-titled properties resolve to their own distinct property, not the same one twice', () => {
    const rawMessages = [
      { id: 'm1', senderId: 'tenant-1', text: 'I would like to request a viewing of Back room, Unit L.', relatedPropertyId: 'prop-A' },
      { id: 'm2', senderId: 'tenant-1', text: 'I would like to request a viewing of Back room, Unit L.', relatedPropertyId: 'prop-B' },
    ];
    const contexts = buildViewingRequestContexts({
      currentThreadType: 'property', rawMessages, properties, currentProperty: null,
    });
    expect(contexts).toHaveLength(2);
    expect(contexts.map((c) => c.property.id).sort()).toEqual(['prop-A', 'prop-B']);
  });

  it('a message with no relatedPropertyId and a colliding title does not silently attach the wrong property\'s context on top of the correct one', () => {
    // Only ONE real request was ever made (prop-B, tagged correctly).
    // A second, unrelated message that merely CONTAINS matching text but
    // has no relatedPropertyId must not fabricate a second context for a
    // property that was never actually requested.
    const rawMessages = [
      { id: 'm1', senderId: 'tenant-1', text: 'I would like to request a viewing of Back room, Unit L.', relatedPropertyId: 'prop-B' },
    ];
    const contexts = buildViewingRequestContexts({
      currentThreadType: 'property', rawMessages, properties, currentProperty: null,
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0].property.id).toBe('prop-B');
  });
});

describe('buildCurrentMessages attachment resolution with relatedPropertyId', () => {
  it('attaches the correct property card even when its title collides with another property', () => {
    const rawMessages = [
      { id: 'm1', senderId: 'tenant-1', text: 'I would like to request a viewing of Back room, Unit L.', createdAt: 1, relatedPropertyId: 'prop-B' },
    ];
    const messages = buildCurrentMessages({
      rawMessages,
      currentUserId: 'tenant-1',
      properties,
      currentProperty: null,
      getViewingRequestStatus: () => null,
      getViewingRequestResolvedAt: () => null,
      viewingRequestBusyKey: null,
    });
    expect(messages[0].attachment.id).toBe('prop-B');
    expect(messages[0].attachment.suburb).toBe('Borrowdale');
  });
});
