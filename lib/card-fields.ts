/**
 * The catalogue of things a wallet card can say, and where they may sit.
 *
 * Deliberately import-free: lib/loyalty.ts needs the defaults to build its own
 * default config, and lib/card-layout.ts needs the catalogue while importing
 * loyalty.ts for the rules — putting these in either one made a cycle.
 */

export type CardFieldId =
  | 'progress'
  | 'reward'
  | 'customerName'
  | 'totalVisits'
  | 'memberSince'
  | 'contact'
  | 'threshold'
  | 'rate';

export interface CardFieldSpec {
  id: CardFieldId;
  /** Shown in the slot picker. */
  name: string;
  /** Only offered for the mechanic(s) it makes sense under. */
  mechanics: ReadonlyArray<'sellos' | 'cashback'>;
}

export const CARD_FIELDS: readonly CardFieldSpec[] = [
  { id: 'progress', name: 'Progreso', mechanics: ['sellos', 'cashback'] },
  { id: 'reward', name: 'Premio', mechanics: ['sellos', 'cashback'] },
  { id: 'customerName', name: 'Titular', mechanics: ['sellos', 'cashback'] },
  { id: 'totalVisits', name: 'Total acumulado', mechanics: ['sellos'] },
  { id: 'memberSince', name: 'Cliente desde', mechanics: ['sellos', 'cashback'] },
  { id: 'contact', name: 'Contacto', mechanics: ['sellos', 'cashback'] },
  { id: 'threshold', name: 'Mínimo para usar', mechanics: ['cashback'] },
  { id: 'rate', name: '% de devolución', mechanics: ['cashback'] },
];

export function fieldsForMechanic(mechanic: 'sellos' | 'cashback'): readonly CardFieldSpec[] {
  return CARD_FIELDS.filter((f) => f.mechanics.includes(mechanic));
}

/** Slots the owner can actually fill. Header capacity is Apple's limit. */
export const SLOT_LIMITS = { header: 1, secondary: 2, auxiliary: 2 } as const;
export type SlotId = keyof typeof SLOT_LIMITS;

export interface CardFieldConfig {
  header: CardFieldId[];
  secondary: CardFieldId[];
  auxiliary: CardFieldId[];
}

/**
 * Progress goes where a stacked pass still shows it, then the two things a
 * customer looks for. The mechanics differ because the cashback card art
 * already prints the rate — repeating it as a field would spend a slot saying
 * what the strip says an inch above it, and truncate doing so.
 */
export const DEFAULT_CARD_FIELDS: CardFieldConfig = {
  header: ['progress'],
  secondary: ['customerName', 'reward'],
  auxiliary: [],
};

export const DEFAULT_CASHBACK_FIELDS: CardFieldConfig = {
  header: ['progress'],
  secondary: ['customerName', 'threshold'],
  auxiliary: [],
};

export function defaultCardFields(mechanic: 'sellos' | 'cashback'): CardFieldConfig {
  return mechanic === 'cashback' ? DEFAULT_CASHBACK_FIELDS : DEFAULT_CARD_FIELDS;
}
