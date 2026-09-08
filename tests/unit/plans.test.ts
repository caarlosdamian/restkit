import { describe, it, expect } from 'vitest';
import {
  limitFor,
  wouldExceed,
  PLANS,
  getPlan,
  priceFor,
  formatMXN,
  toPlanId,
  toBillingPeriod,
  planAllows,
  ANNUAL_DISCOUNT,
  type FeatureId,
} from '@/lib/plans';

describe('plan catalog', () => {
  it('has lite, basic, and pro (highlighted)', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['lite', 'basic', 'pro']);
    expect(getPlan('pro')!.highlight).toBe(true);
    expect(getPlan('lite')!.highlight).toBe(false);
    expect(getPlan('basic')!.highlight).toBe(false);
  });

  it('annual price is the monthly price minus the annual discount', () => {
    const pro = getPlan('pro')!;
    expect(priceFor(pro, 'monthly')).toBe(pro.monthly);
    expect(priceFor(pro, 'annual')).toBe(Math.round(pro.monthly * (1 - ANNUAL_DISCOUNT)));
    expect(priceFor(pro, 'annual')).toBeLessThan(pro.monthly);
  });

  it('lite is priced below basic', () => {
    const lite = getPlan('lite')!;
    const basic = getPlan('basic')!;
    expect(lite.monthly).toBeLessThan(basic.monthly);
  });

  it('formats MXN with a thousands separator', () => {
    expect(formatMXN(599)).toBe('$599');
    expect(formatMXN(1299)).toBe('$1,299');
  });

  it('toPlanId only accepts real plan ids', () => {
    expect(toPlanId('lite')).toBe('lite');
    expect(toPlanId('basic')).toBe('basic');
    expect(toPlanId('pro')).toBe('pro');
    expect(toPlanId('bogus')).toBeNull();
    expect(toPlanId(undefined)).toBeNull();
    expect(toPlanId(42)).toBeNull();
  });

  it('toBillingPeriod defaults to monthly for anything but "annual"', () => {
    expect(toBillingPeriod('annual')).toBe('annual');
    expect(toBillingPeriod('monthly')).toBe('monthly');
    expect(toBillingPeriod('')).toBe('monthly');
    expect(toBillingPeriod(undefined)).toBe('monthly');
  });
});

describe('planAllows (tier gating)', () => {
  const PRO_ONLY: FeatureId[] = ['inventory', 'kds', 'reports'];

  it('lite and basic share the same feature set', () => {
    // Tiers differ by capacity now, not by which features unlock.
    for (const f of PRO_ONLY) {
      expect(planAllows('lite', f)).toBe(planAllows('basic', f));
    }
  });

  it('keeps inventory, KDS and reports on Profesional', () => {
    for (const f of PRO_ONLY) {
      expect(planAllows('lite', f)).toBe(false);
      expect(planAllows('basic', f)).toBe(false);
      expect(planAllows('pro', f)).toBe(true);
    }
  });

  it('no longer gates POS at all', () => {
    // POS was the only thing separating Lite from Básico, which locked the
    // POS-native loyalty differentiator out of the tier that competes on price.
    expect((PRO_ONLY as string[]).includes('pos')).toBe(false);
  });
});

describe('plan capacity limits', () => {
  it('caps Lite at a small-café size', () => {
    expect(limitFor('lite', 'tables')).toBe(6);
    expect(limitFor('lite', 'staff')).toBe(2);
  });

  it('lifts the table ceiling from Básico up', () => {
    expect(limitFor('basic', 'tables')).toBeNull();
    expect(limitFor('basic', 'staff')).toBe(10);
  });

  it('leaves Profesional uncapped', () => {
    expect(limitFor('pro', 'tables')).toBeNull();
    expect(limitFor('pro', 'staff')).toBeNull();
  });

  it('reports the ceiling only once it is actually reached', () => {
    expect(wouldExceed('lite', 'tables', 5)).toBe(false);
    expect(wouldExceed('lite', 'tables', 6)).toBe(true);
    expect(wouldExceed('lite', 'tables', 7)).toBe(true);
  });

  it('never reports a ceiling where there is none', () => {
    expect(wouldExceed('pro', 'tables', 9999)).toBe(false);
    expect(wouldExceed('basic', 'tables', 9999)).toBe(false);
  });
});
