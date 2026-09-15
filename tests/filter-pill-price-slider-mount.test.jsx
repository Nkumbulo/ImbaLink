// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FilterPill } from '../src/pages/HomePage/FilterControls.jsx';
import PriceHistogramSlider from '../src/components/common/PriceHistogramSlider.jsx';
import HomeFilterBar from '../src/pages/HomePage/HomeFilterBar.jsx';

// Real mounts confirming the active/inactive color pairing actually matches
// what Sort uses (not just that the files compile), and that the price
// slider's bars/track/thumb/value-chips no longer reference the old
// unthemed brick-orange.

let container;
afterEach(() => {
  if (container) { document.body.removeChild(container); container = null; }
});

function mount(node) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(node));
  return container;
}

const ACTIVE_COLOR = 'var(--theme-accent-deep, #075E66)';
const HEADER_GLASS_BG = 'rgba(255, 255, 255, 0.08)';

describe('FilterPill matches the header "All"/notification glass buttons when inactive, teal when active', () => {
  it('inactive pill uses the same frosted-glass-on-dark treatment as the header buttons', () => {
    const c = mount(<FilterPill label="Type" active={false} onClick={() => {}} />);
    const btn = c.querySelector('button');
    expect(btn.style.background).toBe(HEADER_GLASS_BG);
    expect(btn.style.border).toContain('rgba(255, 255, 255, 0.08)');
  });

  it('active pill uses the theme teal accent, not the old purple', () => {
    const c = mount(<FilterPill label="Type" active={true} onClick={() => {}} />);
    const btn = c.querySelector('button');
    expect(btn.style.color).toBe(ACTIVE_COLOR);
    expect(btn.style.background).toContain('--theme-accent-soft');
    expect(btn.className).toContain('is-active');
  });
});

describe('PriceHistogramSlider no longer hardcodes the old brick accent', () => {
  it('mounts and renders both thumbs plus the value chips', () => {
    const c = mount(
      <PriceHistogramSlider
        cityProperties={[{ id: '1', rent: 300 }, { id: '2', rent: 700 }]}
        min={0}
        max={1000}
        valueMin={200}
        valueMax={600}
        onChange={() => {}}
      />
    );
    expect(c.querySelectorAll('input[type="range"]').length).toBe(2);
    // The inline <style> block should reference the themed accent var for
    // the thumb border, not the old fixed brick hex.
    const styleTag = c.querySelector('style');
    expect(styleTag.textContent).toContain('var(--theme-accent-deep');
    expect(styleTag.textContent).not.toContain('#C1512F');
  });

  it('the selected-range fill and value chips use the themed accent, not brick', () => {
    const c = mount(
      <PriceHistogramSlider
        cityProperties={[{ id: '1', rent: 300 }]}
        min={0}
        max={1000}
        valueMin={200}
        valueMax={600}
        onChange={() => {}}
      />
    );
    const html = c.innerHTML;
    expect(html).not.toContain('#C1512F');
    expect(html).toContain('--theme-accent');
  });
});

describe('Mobile filter dropdown checkmarks no longer render the old purple', () => {
  it('the Type dropdown\'s selected checkmark uses the teal accent var, not T.jacaranda\'s purple fallback', () => {
    const props = {
      isDesktopLayout: false,
      city: 'Harare',
      filters: { type: 'Apartment', beds: 'Any', maxPrice: null, minPrice: null },
      setFilters: () => {},
      sort: 'newest',
      setSort: () => {},
      setShowCityPicker: () => {},
      setShowFilters: () => {},
      propertyTypes: ['Apartment', 'House'],
      cityProperties: [{ id: '1', rent: 400 }],
      priceCeiling: 1000,
      hasOtherActiveFilters: false,
      hasAnyActiveFilter: false,
      openDropdown: 'type',
      setOpenDropdown: () => {},
      toggleDropdown: () => {},
      dropdownRef: { current: null },
      pressedPillKey: null,
      setPressedPillKey: () => {},
      pressedSort: false,
      setPressedSort: () => {},
    };
    const c = mount(<HomeFilterBar {...props} />);
    const panel = c.querySelector('.mobile-filter-dropdown-type');
    expect(panel).toBeTruthy();
    // The selected option ("Apartment") should render a Check icon; its
    // stroke color must be the teal var, never the raw purple hex the old
    // T.jacaranda fallback used (#6E63B8).
    const checkSvg = panel.querySelector('svg');
    expect(checkSvg).toBeTruthy();
    expect(checkSvg.getAttribute('stroke')).toBe('var(--theme-accent-deep, #075E66)');
    expect(checkSvg.getAttribute('stroke')).not.toContain('6E63B8');
  });
});
