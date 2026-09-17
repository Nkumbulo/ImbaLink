// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ListingForm, { PHASE_LABEL } from '../src/components/landlord/ListingForm.jsx';

let container;
let root;
afterEach(() => {
  if (root) { act(() => { root.unmount(); }); root = null; }
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(overrides = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ListingForm
        onClose={() => {}}
        onCreate={overrides.onCreate || (async () => ({ id: 'listing-1' }))}
        onUpdate={overrides.onUpdate || (async () => ({ id: 'listing-1' }))}
        listing={overrides.listing || null}
      />
    );
  });
  return container;
}

describe('ListingForm inputs no longer trigger mobile zoom-on-focus', () => {
  it('every text/number/select/textarea field renders at 16px, not the old 12px', () => {
    const c = mount();
    expect(c.querySelector('input[name="title"]').style.fontSize).toBe('16px');
    expect(c.querySelector('input[name="suburb"]').style.fontSize).toBe('16px');
    expect(c.querySelector('select[name="type"]').style.fontSize).toBe('16px');
    expect(c.querySelector('textarea[name="description"]').style.fontSize).toBe('16px');
    expect(c.querySelector('input[name="rent"]').style.fontSize).toBe('16px');
  });

  it('no progress bar is shown before a submission is in flight', () => {
    const c = mount();
    expect(c.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe('ListingForm progress phase labels', () => {
  it('names the current photo out of the total while uploading', () => {
    const label = PHASE_LABEL['uploading-photos']({ photosDone: 1, photosTotal: 4 });
    expect(label).toBe('Uploading photo 2 of 4…');
  });

  it('falls back to a generic label when the photo total is unknown', () => {
    const label = PHASE_LABEL['uploading-photos']({ photosDone: 0, photosTotal: 0 });
    expect(label).toBe('Uploading photos…');
  });

  it('never reports a photo number past the actual total, even on the last one', () => {
    const label = PHASE_LABEL['uploading-photos']({ photosDone: 4, photosTotal: 4 });
    expect(label).toBe('Uploading photo 4 of 4…');
  });

  it('distinguishes "publishing" (create) from "saving changes" (edit) for the same phase', () => {
    expect(PHASE_LABEL['creating-listing']({}, false)).toMatch(/publishing/i);
    expect(PHASE_LABEL['creating-listing']({}, true)).toMatch(/saving/i);
  });
});
