import { describe, it, expect } from 'vitest';
import { DEMO_BUSINESSES, demoBusiness, demoConfig } from '@/lib/card-demo';
import { STAMP_ICONS } from '@/lib/stamp-icons';
import { contrastRatio } from '@/lib/card-colors';
import { stampState } from '@/lib/loyalty';

/**
 * The landing-page demo is the first thing a stranger sees of the product, and
 * it renders through the REAL card. So its fixed data has to satisfy the same
 * constraints a real business's settings do — a demo that ships an unreadable
 * card or a missing icon is worse than no demo.
 */

describe('the demo businesses', () => {
  it('are two, and lead with different mechanics', () => {
    // One card shown twice in different colours teaches nothing. The pair
    // exists to show that the same product makes a stamp card AND a cashback
    // card, and that the difference is a setting.
    expect(DEMO_BUSINESSES).toHaveLength(2);
    expect(new Set(DEMO_BUSINESSES.map((d) => d.mechanic)).size).toBe(2);
  });

  it('point at icons that exist in the catalogue', () => {
    // A bad id silently falls back to a star, so the demo would ship the wrong
    // mark with nothing reporting it.
    const ids = new Set(STAMP_ICONS.map((i) => i.id));
    for (const d of DEMO_BUSINESSES) expect(ids.has(d.icon)).toBe(true);
  });

  it('use an accent the card can actually print on', () => {
    for (const d of DEMO_BUSINESSES) {
      expect(d.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrastRatio(d.accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sit partway to the reward, never empty and never complete', () => {
    // An empty card shows nothing working; a finished one has no distance left
    // to explain, and "te faltan 0" is not a sentence.
    for (const d of DEMO_BUSINESSES) {
      expect(d.currentVisits).toBeGreaterThan(0);
      expect(d.currentVisits).toBeLessThan(d.required);
      expect(d.cashbackBalance).toBeGreaterThan(0);
      expect(stampState(d.currentVisits, d.required).rewardsPending).toBe(0);
    }
  });

  it('falls back to the first business rather than crashing on a bad id', () => {
    expect(demoBusiness('no-existe').id).toBe(DEMO_BUSINESSES[0].id);
  });
});

describe('the config the demo renders from', () => {
  it('honours the mechanic the walkthrough picked, on either business', () => {
    // Switching sellos/cashback is the single most useful thing the demo
    // teaches, so it has to actually change the config the card is drawn from.
    for (const d of DEMO_BUSINESSES) {
      expect(demoConfig(d, 'sellos').mechanic).toBe('sellos');
      expect(demoConfig(d, 'cashback').mechanic).toBe('cashback');
    }
  });

  it('carries the business its own reward, count and unit', () => {
    const cafe = demoBusiness('cafe');
    const config = demoConfig(cafe, 'sellos');
    expect(config.sellos.required).toBe(cafe.required);
    expect(config.sellos.rewardDescription).toBe(cafe.reward);
    expect(config.sellos.unitPlural).toBe(cafe.unit.many);
    expect(config.cashback.rate).toBe(cafe.rate);
  });

  it('produces a complete config, defaults filled, like a real business', () => {
    // It goes through the same loyaltyConfig() a stored business does, so the
    // card cannot hit an undefined the real one would have had filled in.
    const config = demoConfig(demoBusiness('tacos'), 'cashback');
    expect(config.card.stampIcon).toBeTruthy();
    expect(config.card.ground).toBeTruthy();
    expect(config.card.stampStyle).toBeTruthy();
    expect(config.card.photoPlacement).toBeTruthy();
  });
});
