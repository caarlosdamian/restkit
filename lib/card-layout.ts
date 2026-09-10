import { DEFAULT_LOYALTY, formatMXN, stampState } from './loyalty';
import { CARD_FIELDS, defaultCardFields, SLOT_LIMITS } from './card-fields';
import type { CardFieldConfig, CardFieldId } from './card-fields';
import type { ILoyaltyConfig } from '@/models/Business';

// Re-exported so a caller needs only this module to build and describe a card.
export * from './card-fields';

/**
 * One description of the card, projected onto both wallets.
 *
 * Apple and Google expose completely different vocabularies — Apple has named
 * field slots on a fixed template, Google has points, text modules and a row
 * template — so writing the card twice meant the two platforms quietly drifted
 * apart. This module decides WHAT the card says once; lib/apple-pass.ts and
 * lib/google-wallet.ts only decide how to say it.
 *
 * The hard platform constraints are encoded here rather than in either builder:
 *
 * - **A storeCard's `primaryFields` are drawn ON TOP of `strip.png`.** We use
 *   the strip for the stamps, so the primary slot must stay empty or Wallet
 *   prints the progress a second time across the customer's own stamps.
 * - **A stacked pass in Wallet shows only the logo and the header fields.**
 *   That makes the header the most valuable slot on the card, not an afterthought.
 * - **Apple notifies on a push only when a field carrying `changeMessage`
 *   changes value.** So the progress field must exist somewhere on every card,
 *   whatever the owner picked — `buildCardLayout` forces it back in if not.
 */

export interface CardField {
  key: string;
  label: string;
  value: string;
  /** Apple only raises a notification for a field that carries one. */
  changeMessage?: string;
}

export interface CardLayoutInput {
  businessName: string;
  config: ILoyaltyConfig;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    createdAt?: Date | string;
    stats: { totalVisits: number; currentVisits: number; cashbackBalance?: number };
  };
  /** True when a strip/hero image occupies the visual band. */
  hasStrip: boolean;
}

export interface CardLayout {
  /** Right of the logo. Survives into the stacked-pass view. */
  header: CardField[];
  /** Empty whenever a strip is present — see the note above. */
  primary: CardField[];
  secondary: CardField[];
  auxiliary: CardField[];
  back: CardField[];
}

/* --------------------------------------------------------------- messages */

/** What the owner types where the new value should appear. */
export const VALUE_TOKEN = '{progreso}';

/** Long enough for a real sentence, short enough to survive a lock screen. */
export const MAX_MESSAGE = 120;

/**
 * Substitutes the owner's `{progreso}` for a value we resolve ourselves.
 *
 * Unlike `changeMessage`, a pass's `relevantText` is plain text — Apple never
 * substitutes anything into it. But the pass is rebuilt per customer, so the
 * placeholder can be filled here and the owner gets one token to learn instead
 * of two rules.
 */
export function fillTokens(template: string, value: string, fallback: string): string {
  const source = template.trim() || fallback.trim();
  const filled = source.split(VALUE_TOKEN).join(value).replace(/\s+/g, ' ').trim();
  if (!filled) return fillTokens(fallback, value, fallback);
  return filled.length > MAX_RELEVANT_TEXT
    ? `${filled.slice(0, MAX_RELEVANT_TEXT - 1).trimEnd()}…`
    : filled;
}

/** A lock-screen suggestion shows one short line. */
export const MAX_RELEVANT_TEXT = 60;

/**
 * Turns an owner-written message into an Apple `changeMessage`.
 *
 * ⚠️ Apple substitutes the field's NEW value for `%@`, and that token is the
 * only dynamic part it understands. Asking a taquería owner to type `%@` is
 * asking for a support call, so they write `{progreso}` and this converts it.
 *
 * Three rules, each of them a way the notification breaks quietly:
 *  - **A literal `%` is escaped**, because the string is a format string: an
 *    unescaped `% d` in "50% de descuento" is a conversion specifier, not text.
 *  - **Only the first placeholder survives.** Apple fills one and prints the
 *    rest verbatim, so a second `%@` would appear raw on the lock screen.
 *  - **Never empty.** A blank changeMessage updates the pass in total silence,
 *    which is indistinguishable from the push being broken.
 */
export function changeMessageFrom(template: string, fallback: string): string {
  const source = template.trim() || fallback.trim();
  const escape = (part: string) => part.replace(/%/g, '%%');

  const [head, ...rest] = source.split(VALUE_TOKEN);
  // Joining the tail without the token drops any further placeholders while
  // keeping the words the owner wrote around them.
  const message = rest.length ? `${escape(head)}%@${escape(rest.join(''))}` : escape(head);

  const collapsed = message.replace(/\s+/g, ' ').trim();
  if (!collapsed || collapsed === '%@') {
    // Nothing but the placeholder is not a message; fall back rather than push
    // a bare number at somebody.
    return fallback.trim() === source ? source : changeMessageFrom(fallback, fallback);
  }
  return collapsed.length > MAX_MESSAGE
    ? `${collapsed.slice(0, MAX_MESSAGE - 1).trimEnd()}…`
    : collapsed;
}

/* ---------------------------------------------------------------- values */

function monthYear(date?: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

/**
 * Resolves one field to a label and a value, or null when it has nothing to
 * say — an empty slot is better than a labelled blank.
 */
export function resolveField(id: CardFieldId, input: CardLayoutInput): CardField | null {
  const { config, customer } = input;
  const cashbackMechanic = config.mechanic === 'cashback';
  const balance = customer.stats.cashbackBalance ?? 0;
  const required = config.sellos.required;
  const state = stampState(customer.stats.currentVisits, required);

  switch (id) {
    case 'progress':
      if (cashbackMechanic) {
        return {
          key: 'progress',
          label: 'SALDO',
          value: formatMXN(balance),
          changeMessage: changeMessageFrom(
            config.notifications.cashback,
            DEFAULT_LOYALTY.notifications.cashback
          ),
        };
      }
      return {
        key: 'progress',
        label: state.rewardsPending > 0 ? '¡PREMIO LISTO!' : config.sellos.unitPlural.toUpperCase(),
        value:
          state.rewardsPending > 0
            ? config.sellos.rewardDescription
            : `${state.stamps} de ${required}`,
        // The pass is rebuilt on every update, so the message can be chosen
        // from the state the customer has just landed in — "another stamp" and
        // "your reward is ready" are different news through the same field.
        changeMessage: changeMessageFrom(
          state.rewardsPending > 0 ? config.notifications.rewardReady : config.notifications.stamp,
          state.rewardsPending > 0
            ? DEFAULT_LOYALTY.notifications.rewardReady
            : DEFAULT_LOYALTY.notifications.stamp
        ),
      };

    case 'reward':
      return cashbackMechanic
        ? { key: 'reward', label: 'DEVOLUCIÓN', value: `${config.cashback.rate}% de cada compra` }
        : { key: 'reward', label: 'PREMIO', value: config.sellos.rewardDescription };

    case 'customerName':
      return { key: 'customerName', label: 'TITULAR', value: customer.name };

    case 'totalVisits':
      return {
        key: 'totalVisits',
        label: `TOTAL DE ${config.sellos.unitPlural.toUpperCase()}`,
        value: String(customer.stats.totalVisits),
      };

    case 'memberSince': {
      const since = monthYear(customer.createdAt);
      return since ? { key: 'memberSince', label: 'CLIENTE DESDE', value: since } : null;
    }

    case 'contact': {
      const value = customer.email || customer.phone || '';
      return value ? { key: 'contact', label: 'CONTACTO', value } : null;
    }

    case 'threshold':
      return {
        key: 'threshold',
        label: 'MÍNIMO PARA USAR',
        value: formatMXN(config.cashback.threshold),
      };

    case 'rate':
      return { key: 'rate', label: 'DEVOLUCIÓN', value: `${config.cashback.rate}%` };

    default:
      return null;
  }
}

/* ---------------------------------------------------------------- layout */

function fill(ids: CardFieldId[], limit: number, input: CardLayoutInput): CardField[] {
  const out: CardField[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (out.length >= limit) break;
    // Switching mechanic leaves the other one's fields behind in the stored
    // config. "Total de visitas" on a cashback card is nonsense, so drop it
    // rather than render it.
    const spec = CARD_FIELDS.find((f) => f.id === id);
    if (spec && !spec.mechanics.includes(input.config.mechanic)) continue;
    const field = resolveField(id, input);
    if (!field || seen.has(field.key)) continue;
    seen.add(field.key);
    out.push(field);
  }
  return out;
}

export function buildCardLayout(
  input: CardLayoutInput,
  fields: CardFieldConfig = defaultCardFields(input.config.mechanic)
): CardLayout {
  const header = fill(fields.header ?? [], SLOT_LIMITS.header, input);
  const secondary = fill(fields.secondary ?? [], SLOT_LIMITS.secondary, input);
  const auxiliary = fill(fields.auxiliary ?? [], SLOT_LIMITS.auxiliary, input);

  const placed = [...header, ...secondary, ...auxiliary];
  const hasProgress = placed.some((f) => f.key === 'progress');

  // A card with no progress field has no field carrying a changeMessage, so
  // every stamp would land in silence. The owner can move it; they cannot
  // remove it. Header is the fallback because a stacked pass still shows it.
  if (!hasProgress) {
    const progress = resolveField('progress', input);
    if (progress) header.unshift(progress);
    header.length = Math.min(header.length, SLOT_LIMITS.header);
  }

  // The strip carries the stamps. Apple draws primaryFields over it, so a
  // populated primary slot prints the progress across the customer's own card.
  const primary = input.hasStrip ? [] : (fill(['progress'], 1, input) as CardField[]);

  const back: CardField[] = [];
  for (const id of ['totalVisits', 'memberSince', 'contact'] as CardFieldId[]) {
    if (placed.some((f) => f.key === id)) continue;
    const field = resolveField(id, input);
    if (field) back.push(field);
  }
  back.push({
    key: 'howItWorks',
    label: 'Cómo funciona',
    value:
      input.config.mechanic === 'cashback'
        ? `Acumulas ${input.config.cashback.rate}% de cada compra. Usa tu saldo a partir de ${formatMXN(input.config.cashback.threshold)}. Se aplica solo al pagar en ${input.businessName}.`
        : `Junta ${input.config.sellos.required} ${input.config.sellos.unitPlural} y recibe: ${input.config.sellos.rewardDescription}. El sello se registra al pagar en ${input.businessName}.`,
  });

  return { header, primary, secondary, auxiliary, back };
}
