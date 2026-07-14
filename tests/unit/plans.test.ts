import { describe, it, expect } from 'vitest';
import {
  PLANS,
  getPlan,
  priceFor,
  formatMXN,
  toSelfServePlanId,
  toBillingPeriod,
  ANNUAL_DISCOUNT,
} from '@/lib/plans';

describe('plan catalog', () => {
  it('has basic, pro (highlighted, self-serve) and enterprise (quote-only)', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['basic', 'pro', 'enterprise']);
    expect(getPlan('pro')!.highlight).toBe(true);
    expect(getPlan('enterprise')!.selfServe).toBe(false);
    expect(getPlan('enterprise')!.monthly).toBeNull();
  });

  it('annual price is the monthly price minus the annual discount', () => {
    const pro = getPlan('pro')!;
    expect(priceFor(pro, 'monthly')).toBe(pro.monthly);
    expect(priceFor(pro, 'annual')).toBe(Math.round(pro.monthly! * (1 - ANNUAL_DISCOUNT)));
    expect(priceFor(pro, 'annual')!).toBeLessThan(pro.monthly!);
  });

  it('quote-only plans have null price in both periods', () => {
    const ent = getPlan('enterprise')!;
    expect(priceFor(ent, 'monthly')).toBeNull();
    expect(priceFor(ent, 'annual')).toBeNull();
  });

  it('formats MXN with a thousands separator', () => {
    expect(formatMXN(599)).toBe('$599');
    expect(formatMXN(1299)).toBe('$1,299');
  });

  it('toSelfServePlanId only accepts self-serve plan ids', () => {
    expect(toSelfServePlanId('basic')).toBe('basic');
    expect(toSelfServePlanId('pro')).toBe('pro');
    expect(toSelfServePlanId('enterprise')).toBeNull(); // not self-serve
    expect(toSelfServePlanId('bogus')).toBeNull();
    expect(toSelfServePlanId(undefined)).toBeNull();
    expect(toSelfServePlanId(42)).toBeNull();
  });

  it('toBillingPeriod defaults to monthly for anything but "annual"', () => {
    expect(toBillingPeriod('annual')).toBe('annual');
    expect(toBillingPeriod('monthly')).toBe('monthly');
    expect(toBillingPeriod('')).toBe('monthly');
    expect(toBillingPeriod(undefined)).toBe('monthly');
  });
});
