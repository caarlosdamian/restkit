import { DEFAULT_LOYALTY, loyaltyConfig } from './loyalty';
import type { ILoyaltyConfig, LoyaltyMechanic, CardGround } from '@/models/Business';

/**
 * The pre-filled businesses the landing-page demo builds cards for.
 *
 * Deliberately fixed and unwritable. The demo exists so somebody who has never
 * heard of RestKit can see what a card IS in thirty seconds — not so they can
 * design one before signing up. Every value here is chosen to survive being
 * looked at rather than edited: a real reward, a real count, a colour that
 * actually passes contrast on the card.
 *
 * Pure data, no db and no React, so the walkthrough and its tests can both
 * read it and the config it produces is the same shape a real business stores.
 */

export interface DemoBusiness {
  id: string;
  name: string;
  /** What the trade is, for the chip under the name. */
  trade: string;
  /** Whose card it is — the demo shows a holder, like a real one. */
  holder: string;
  mechanic: LoyaltyMechanic;
  ground: CardGround;
  accent: string;
  /** From lib/stamp-icons.ts. */
  icon: string;
  /** Sellos. */
  required: number;
  reward: string;
  unit: { one: string; many: string };
  /** Cashback. */
  rate: number;
  /** Where the demo card sits on its way to the reward. */
  currentVisits: number;
  cashbackBalance: number;
}

/**
 * Two, and visibly unalike. One card shown twice in different colours would
 * teach nothing — the point of the pair is that the same product produces a
 * stamp card for a café and a cashback card for a taquería, and that the
 * difference is a setting rather than a different product.
 */
export const DEMO_BUSINESSES: DemoBusiness[] = [
  {
    id: 'cafe',
    name: 'Café Aurora',
    trade: 'Cafetería',
    holder: 'Ana Sofía',
    mechanic: 'sellos',
    ground: 'light',
    accent: '#6f4e37',
    icon: 'coffee',
    required: 10,
    reward: 'Un café gratis',
    unit: { one: 'café', many: 'cafés' },
    rate: 5,
    currentVisits: 6,
    cashbackBalance: 180,
  },
  {
    id: 'tacos',
    name: 'Tacos El Norte',
    trade: 'Taquería',
    holder: 'Carlos Mendoza',
    mechanic: 'cashback',
    ground: 'brand',
    accent: '#b3202c',
    icon: 'utensils',
    required: 8,
    reward: 'Una orden de cortesía',
    unit: { one: 'visita', many: 'visitas' },
    rate: 8,
    currentVisits: 5,
    cashbackBalance: 240,
  },
];

export function demoBusiness(id: string): DemoBusiness {
  return DEMO_BUSINESSES.find((d) => d.id === id) ?? DEMO_BUSINESSES[0];
}

/**
 * The same `loyaltyConfig()` a real business goes through, so the demo card is
 * rendered by the real `LoyaltyCard` from real settings rather than by a
 * mockup that can drift away from the product.
 *
 * `mechanic` is passed separately because the walkthrough lets someone switch
 * between sellos and cashback on either business — that switch is the single
 * most useful thing the demo teaches, and it has to change the card.
 */
export function demoConfig(demo: DemoBusiness, mechanic: LoyaltyMechanic): ILoyaltyConfig {
  return loyaltyConfig({
    settings: {
      loyalty: {
        ...DEFAULT_LOYALTY,
        mechanic,
        sellos: {
          ...DEFAULT_LOYALTY.sellos,
          required: demo.required,
          rewardDescription: demo.reward,
          unitSingular: demo.unit.one,
          unitPlural: demo.unit.many,
        },
        cashback: { rate: demo.rate, threshold: 200 },
        card: { ...DEFAULT_LOYALTY.card, stampIcon: demo.icon, ground: demo.ground },
      },
    },
  } as never);
}
