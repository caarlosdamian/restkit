import { describe, it, expect } from 'vitest';
import {
  buildCardLayout,
  resolveField,
  fieldsForMechanic,
  DEFAULT_CARD_FIELDS,
  SLOT_LIMITS,
  type CardLayoutInput,
} from '@/lib/card-layout';
import { DEFAULT_LOYALTY, loyaltyConfig } from '@/lib/loyalty';
import { DEFAULT_CASHBACK_FIELDS } from '@/lib/card-fields';
import type { ILoyaltyConfig } from '@/models/Business';

const sellos = (over: Partial<ILoyaltyConfig['sellos']> = {}): ILoyaltyConfig => ({
  ...DEFAULT_LOYALTY,
  mechanic: 'sellos',
  sellos: { ...DEFAULT_LOYALTY.sellos, ...over },
});

const cashback = (over: Partial<ILoyaltyConfig['cashback']> = {}): ILoyaltyConfig => ({
  ...DEFAULT_LOYALTY,
  mechanic: 'cashback',
  cashback: { ...DEFAULT_LOYALTY.cashback, ...over },
});

const input = (config: ILoyaltyConfig, over: Partial<CardLayoutInput> = {}): CardLayoutInput => ({
  businessName: 'Café Luna',
  config,
  customer: {
    name: 'Ana Pérez',
    phone: '5512345678',
    createdAt: new Date('2026-02-14'),
    stats: { totalVisits: 14, currentVisits: 4, cashbackBalance: 62.5 },
  },
  hasStrip: true,
  ...over,
});

describe('the primary slot and the strip', () => {
  it('leaves primary empty whenever a strip is present', () => {
    // Wallet draws primaryFields ON TOP of strip.png for a storeCard. The pass
    // shipped both, so the progress was reprinted across the customer's own
    // stamps — which is exactly what made our card look worse than a rival's.
    expect(buildCardLayout(input(sellos())).primary).toEqual([]);
  });

  it('falls back to showing progress there when there is no strip', () => {
    const layout = buildCardLayout(input(sellos(), { hasStrip: false }));
    expect(layout.primary.map((f) => f.key)).toEqual(['progress']);
  });
});

describe('the progress field is not optional', () => {
  it('comes back even when the owner empties every slot', () => {
    // It is the only field carrying a changeMessage, and Apple raises a
    // notification only when such a field changes value. Without it every
    // stamp would land in silence.
    const layout = buildCardLayout(input(sellos()), {
      header: [],
      secondary: ['customerName'],
      auxiliary: [],
    });
    const placed = [...layout.header, ...layout.secondary, ...layout.auxiliary];
    expect(placed.some((f) => f.key === 'progress')).toBe(true);
    expect(layout.header[0].changeMessage).toBeTruthy();
  });

  it('is not duplicated when the owner did place it', () => {
    const layout = buildCardLayout(input(sellos()), {
      header: [],
      secondary: ['progress', 'reward'],
      auxiliary: [],
    });
    const placed = [...layout.header, ...layout.secondary, ...layout.auxiliary];
    expect(placed.filter((f) => f.key === 'progress')).toHaveLength(1);
    expect(layout.header).toEqual([]);
  });

  it('carries no gendered participle in its change message', () => {
    // The unit noun is owner-configurable, so its grammatical gender is
    // unknowable here — "nueva visita" vs "nuevo sello".
    const msg = resolveField('progress', input(sellos()))!.changeMessage!;
    expect(msg).not.toMatch(/nuev[oa]/i);
    expect(msg).toContain('%@');
  });
});

describe('slot limits', () => {
  it('never overflows a platform slot', () => {
    const layout = buildCardLayout(input(sellos()), {
      header: ['progress', 'reward'],
      secondary: ['customerName', 'reward', 'totalVisits', 'memberSince'],
      auxiliary: ['contact', 'totalVisits', 'memberSince'],
    });
    expect(layout.header.length).toBeLessThanOrEqual(SLOT_LIMITS.header);
    expect(layout.secondary.length).toBeLessThanOrEqual(SLOT_LIMITS.secondary);
    expect(layout.auxiliary.length).toBeLessThanOrEqual(SLOT_LIMITS.auxiliary);
  });

  it('drops a duplicate rather than printing the same field twice', () => {
    const layout = buildCardLayout(input(sellos()), {
      header: [],
      secondary: ['reward', 'reward'],
      auxiliary: [],
    });
    expect(layout.secondary.filter((f) => f.key === 'reward')).toHaveLength(1);
  });

  it('skips a field with nothing to say instead of labelling a blank', () => {
    const noContact = input(sellos());
    noContact.customer = { ...noContact.customer, phone: undefined, email: undefined };
    expect(resolveField('contact', noContact)).toBeNull();

    const noDate = input(sellos());
    noDate.customer = { ...noDate.customer, createdAt: undefined };
    expect(resolveField('memberSince', noDate)).toBeNull();
  });
});

describe('mechanic awareness', () => {
  it('reads as a balance under cashback and as stamps under sellos', () => {
    expect(resolveField('progress', input(sellos()))).toMatchObject({
      label: 'VISITAS',
      value: '4 de 10',
    });
    expect(resolveField('progress', input(cashback()))).toMatchObject({
      label: 'SALDO',
      value: '$62.50',
    });
  });

  it('shouts when the card is complete', () => {
    const full = input(sellos({ required: 4, rewardDescription: 'Un café gratis' }));
    expect(resolveField('progress', full)).toMatchObject({
      label: '¡PREMIO LISTO!',
      value: 'Un café gratis',
    });
  });

  it('only offers fields that make sense for the mechanic', () => {
    const forSellos = fieldsForMechanic('sellos').map((f) => f.id);
    expect(forSellos).toContain('totalVisits');
    expect(forSellos).not.toContain('threshold');

    const forCashback = fieldsForMechanic('cashback').map((f) => f.id);
    expect(forCashback).toContain('threshold');
    expect(forCashback).not.toContain('totalVisits');
  });

  it('explains the programme on the back in its own terms', () => {
    const stamps = buildCardLayout(input(sellos({ required: 8 })));
    const how = stamps.back.find((f) => f.key === 'howItWorks')!;
    expect(how.value).toContain('8');
    expect(how.value).toContain('Café Luna');

    const money = buildCardLayout(input(cashback({ rate: 5, threshold: 100 })));
    expect(money.back.find((f) => f.key === 'howItWorks')!.value).toContain('5%');
  });
});

describe('the back of the card', () => {
  it('holds what the front had no room for, without repeating it', () => {
    const layout = buildCardLayout(input(sellos()), {
      header: ['progress'],
      secondary: ['customerName', 'totalVisits'],
      auxiliary: [],
    });
    const backKeys = layout.back.map((f) => f.key);
    // totalVisits is already on the front, so it does not repeat on the back.
    expect(backKeys).not.toContain('totalVisits');
    expect(backKeys).toContain('contact');
    expect(backKeys).toContain('howItWorks');
  });
});

describe('defaults', () => {
  it('starts where a customer expects to look', () => {
    expect(DEFAULT_CARD_FIELDS.header).toEqual(['progress']);
    expect(DEFAULT_CARD_FIELDS.secondary).toEqual(['customerName', 'reward']);

    const layout = buildCardLayout(input(sellos()));
    expect(layout.secondary.map((f) => f.label)).toEqual(['TITULAR', 'PREMIO']);
  });
});

describe('defaults follow the mechanic', () => {
  it('does not repeat the rate a cashback card already prints', () => {
    // The cashback strip shows "DEVUELVE 5%" an inch above the fields, and the
    // long form ("5% de cada compra") truncates in Apple's narrow slot — so the
    // default spends that slot on the threshold instead, which is not shown.
    expect(DEFAULT_CASHBACK_FIELDS.secondary).toEqual(['customerName', 'threshold']);

    const layout = buildCardLayout(input(cashback({ rate: 5, threshold: 100 })));
    expect(layout.secondary.map((f) => f.label)).toEqual(['TITULAR', 'MÍNIMO PARA USAR']);
  });

  it('gives a cashback business the cashback defaults, not the sellos ones', () => {
    const config = loyaltyConfig({
      settings: { loyalty: { ...DEFAULT_LOYALTY, mechanic: 'cashback', card: { stampIcon: 'star' } } },
    } as never);
    expect(config.card.fields).toEqual(DEFAULT_CASHBACK_FIELDS);
  });

  it('drops the other mechanic\'s fields left behind by a switch', () => {
    // "Total de visitas" on a cashback card is nonsense; it should not render
    // just because it was stored before the owner switched.
    const layout = buildCardLayout(input(cashback()), {
      header: ['progress'],
      secondary: ['customerName', 'totalVisits'],
      auxiliary: [],
    });
    expect(layout.secondary.map((f) => f.key)).toEqual(['customerName']);
  });
});
