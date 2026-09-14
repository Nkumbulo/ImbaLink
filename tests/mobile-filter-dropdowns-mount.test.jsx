// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import HomeFilterBar from '../src/pages/HomePage/HomeFilterBar.jsx';

// Real mount (not just a build check) of the mobile filter toolbar, opening
// each dropdown in turn. jsdom has no layout engine so this can't assert
// final pixel geometry, but it does prove every dropdown still renders
// cleanly (no runtime throw) after the CSS anchoring rework, and that the
// sort/price panels keep the specific classNames the desktop-light.css
// positioning rules target — a silent className typo would otherwise pass
// `npm run build` clean and only break visually at runtime.

let container;
afterEach(() => {
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(openDropdown) {
  let toggled = null;
  const props = {
    isDesktopLayout: false,
    city: 'Harare',
    filters: { type: 'All', beds: 'Any', maxPrice: null, minPrice: null },
    setFilters: () => {},
    sort: 'newest',
    setSort: () => {},
    setShowCityPicker: () => {},
    setShowFilters: () => {},
    propertyTypes: ['Apartment', 'House'],
    cityProperties: [{ id: '1', rent: 400 }, { id: '2', rent: 800 }],
    priceCeiling: 1000,
    hasOtherActiveFilters: false,
    hasAnyActiveFilter: false,
    openDropdown,
    setOpenDropdown: () => {},
    toggleDropdown: (key) => { toggled = key; },
    dropdownRef: { current: null },
    pressedPillKey: null,
    setPressedPillKey: () => {},
    pressedSort: false,
    setPressedSort: () => {},
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(<HomeFilterBar {...props} />));
  return { container, getToggled: () => toggled };
}

describe('HomeFilterBar mobile dropdowns real mount', () => {
  it('renders the sort trigger and, once open, a panel carrying the CSS anchor class', () => {
    const { container } = mount('sort');
    const trigger = container.querySelector('button[aria-label="Sort"]');
    expect(trigger).toBeTruthy();
    const panel = container.querySelector('.mobile-filter-dropdown-sort');
    expect(panel).toBeTruthy();
    // Anchored via CSS (desktop-light.css), not an inline right:auto that
    // would fight the stylesheet's `right: 0 !important` rule.
    expect(panel.style.right).not.toBe('auto');
  });

  it('renders the price panel carrying the CSS anchor class with the histogram slider inside', () => {
    const { container } = mount('price');
    const panel = container.querySelector('.mobile-filter-dropdown-price');
    expect(panel).toBeTruthy();
    expect(panel.querySelectorAll('input[type="range"]').length).toBe(2);
  });

  it('mounts cleanly with no dropdown open', () => {
    const { container } = mount(null);
    expect(container.querySelector('.mobile-filter-dropdown-sort')).toBeNull();
    expect(container.querySelector('.mobile-filter-dropdown-price')).toBeNull();
  });
});
