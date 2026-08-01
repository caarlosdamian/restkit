import { describe, it, expect } from 'vitest';
import {
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
  const GATED: FeatureId[] = ['pos', 'inventory', 'kds', 'reports'];
  const PRO_ONLY: FeatureId[] = ['inventory', 'kds', 'reports'];

  it('lite has none of the gateable features, including POS', () => {
    for (const f of GATED) expect(planAllows('lite', f)).toBe(false);
  });

  it('basic includes POS but not the pro-only features', () => {
    expect(planAllows('basic', 'pos')).toBe(true);
    for (const f of PRO_ONLY) expect(planAllows('basic', f)).toBe(false);
  });

  it('pro includes everything gateable', () => {
    for (const f of GATED) expect(planAllows('pro', f)).toBe(true);
  });
});
