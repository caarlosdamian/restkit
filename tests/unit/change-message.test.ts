import { describe, it, expect } from 'vitest';
import {
  buildCardLayout,
  changeMessageFrom,
  fillTokens,
  VALUE_TOKEN,
  MAX_MESSAGE,
  MAX_RELEVANT_TEXT,
  withoutChangeMessages,
} from '@/lib/card-layout';
import { DEFAULT_LOYALTY, loyaltyConfig } from '@/lib/loyalty';
import { passLocations } from '@/lib/apple-pass';
import type { ILoyaltyNotifications } from '@/models/Business';

const FALLBACK = 'Registro actualizado: {progreso}';

describe('the message the customer sees on their lock screen', () => {
  it('converts the owner’s token into the one Apple understands', () => {
    // The owner never types %@ — it is the single most confusing thing we
    // could put in a settings field.
    expect(changeMessageFrom('¡Gracias por tu visita! Llevas {progreso}', FALLBACK)).toBe(
      '¡Gracias por tu visita! Llevas %@'
    );
  });

  it('escapes a literal percent, which is a format specifier otherwise', () => {
    expect(changeMessageFrom('Ya llevas 50% de tu tarjeta: {progreso}', FALLBACK)).toBe(
      'Ya llevas 50%% de tu tarjeta: %@'
    );
  });

  it('keeps only the first placeholder', () => {
    // Apple fills one and prints the rest verbatim, so a second would show up
    // as a raw %@ on the customer's phone.
    const out = changeMessageFrom('{progreso} de {progreso}', FALLBACK);
    expect(out.match(/%@/g)).toHaveLength(1);
    expect(out).toBe('%@ de');
  });

  it('works with no placeholder at all', () => {
    // Valid: a fixed sentence still notifies.
    expect(changeMessageFrom('Tu tarjeta se actualizó', FALLBACK)).toBe('Tu tarjeta se actualizó');
  });

  it('falls back rather than ever going empty', () => {
    // ⚠️ A blank changeMessage means the pass updates in SILENCE, which reads
    // as the push being broken. An owner clearing the box must not do that.
    for (const empty of ['', '   ', '\n']) {
      expect(changeMessageFrom(empty, FALLBACK)).toBe('Registro actualizado: %@');
    }
  });

  it('falls back when the message is nothing but the placeholder', () => {
    expect(changeMessageFrom(VALUE_TOKEN, FALLBACK)).toBe('Registro actualizado: %@');
  });

  it('truncates what a lock screen would cut off anyway', () => {
    const out = changeMessageFrom('a'.repeat(400) + VALUE_TOKEN, FALLBACK);
    expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('the owner’s message on the actual card', () => {
  const business = (notifications?: Partial<ILoyaltyNotifications>) =>
    ({ settings: { loyalty: { ...DEFAULT_LOYALTY, notifications: { ...DEFAULT_LOYALTY.notifications, ...notifications } } } }) as never;

  const layoutFor = (currentVisits: number, notifications?: Partial<ILoyaltyNotifications>) =>
    buildCardLayout({
      businessName: 'Matruma Café',
      config: loyaltyConfig(business(notifications)),
      customer: { name: 'Ana', stats: { totalVisits: currentVisits, currentVisits, cashbackBalance: 0 } },
      hasStrip: true,
    });

  const progressOf = (layout: ReturnType<typeof buildCardLayout>) =>
    [...layout.header, ...layout.secondary, ...layout.auxiliary, ...layout.back].find(
      (f) => f.key === 'progress'
    );

  it('carries what the owner wrote onto the pass', () => {
    const field = progressOf(layoutFor(3, { stamp: '¡Gracias! Llevas {progreso}' }));
    expect(field?.changeMessage).toBe('¡Gracias! Llevas %@');
  });

  it('switches to the reward message the moment the reward is claimable', () => {
    // Same field, different news. The pass is rebuilt on every update, so the
    // message is chosen from the state the customer has just landed in.
    const notifications = { stamp: 'Llevas {progreso}', rewardReady: '¡Tu premio te espera! {progreso}' };
    expect(progressOf(layoutFor(3, notifications))?.changeMessage).toBe('Llevas %@');
    expect(progressOf(layoutFor(10, notifications))?.changeMessage).toBe('¡Tu premio te espera! %@');
  });

  it('always ships a changeMessage, whatever the owner leaves behind', () => {
    // ⚠️ The progress field is the only one carrying a changeMessage, and a
    // field without one updates in silence — no notification, no stamp alert,
    // nothing. An owner emptying a text box must never be able to cause that.
    const field = progressOf(layoutFor(4, { stamp: '   ' }));
    expect(field?.changeMessage).toBeTruthy();
    expect(field?.changeMessage).toContain('%@');
  });
});

describe('what the lock screen says when the customer walks past', () => {
  const FALLBACK = 'Llevas {progreso} visitas';

  it('fills the placeholder itself — Apple substitutes nothing here', () => {
    // relevantText is plain text, not a format string. The pass is built per
    // customer, so the value is resolved on our side.
    expect(fillTokens('Llevas {progreso} sellos', '3 de 10', FALLBACK)).toBe('Llevas 3 de 10 sellos');
  });

  it('never emits %@, which would appear raw on the phone', () => {
    expect(fillTokens('Tu avance: {progreso}', '4 de 8', FALLBACK)).not.toContain('%@');
  });

  it('leaves a literal percent alone', () => {
    // The escaping that changeMessage needs would be a bug here — this string
    // is never parsed as a format.
    expect(fillTokens('Ya vas al 50% — {progreso}', '5 de 10', FALLBACK)).toBe(
      'Ya vas al 50% — 5 de 10'
    );
  });

  it('falls back rather than showing a blank line', () => {
    expect(fillTokens('   ', '3 de 10', FALLBACK)).toBe('Llevas 3 de 10 visitas');
  });

  it('keeps it to one short line', () => {
    const out = fillTokens('x'.repeat(300) + '{progreso}', '3 de 10', FALLBACK);
    expect(out.length).toBeLessThanOrEqual(MAX_RELEVANT_TEXT);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('the geofence on the pass itself', () => {
  const at = (location?: Record<string, unknown>) =>
    passLocations(
      loyaltyConfig({ settings: { loyalty: { ...DEFAULT_LOYALTY, location } } } as never),
      { progress: '3 de 10' }
    );

  it('emits nothing at all when the owner never set a location', () => {
    // No `locations` key, not an empty array: an empty array is a pass that
    // claims a geofence and has none.
    expect(at(undefined)).toEqual({});
    expect(at({ latitude: 19.4 })).toEqual({});
  });

  it('fills the owner’s message with the customer’s own progress', () => {
    const { locations } = at({ latitude: 19.4326, longitude: -99.1332, relevantText: 'Vas {progreso} 👋' });
    expect(locations?.[0].relevantText).toBe('Vas 3 de 10 👋');
  });

  it('leaves the radius to iOS unless the owner picked one', () => {
    // ⚠️ Absent ≠ 0. A maxDistance of 0 would be a geofence nothing can enter.
    const auto = at({ latitude: 19.4326, longitude: -99.1332 });
    expect(auto.locations?.[0]).not.toHaveProperty('maxDistance');

    const tight = at({ latitude: 19.4326, longitude: -99.1332, maxDistance: 30 });
    expect(tight.locations?.[0].maxDistance).toBe(30);
  });

  it('still says something useful when the owner wrote nothing', () => {
    const { locations } = at({ latitude: 19.4326, longitude: -99.1332 });
    expect(locations?.[0].relevantText).toBe('Llevas 3 de 10 visitas');
  });
});

describe('a silent update, for a purchase the manager removed', () => {
  const business = () => ({ settings: { loyalty: DEFAULT_LOYALTY } }) as never;

  const layoutFor = (currentVisits: number) =>
    buildCardLayout({
      businessName: 'Matruma Café',
      config: loyaltyConfig(business()),
      customer: { name: 'Ana', stats: { totalVisits: currentVisits, currentVisits, cashbackBalance: 0 } },
      hasStrip: true,
    });

  const allFields = (layout: ReturnType<typeof buildCardLayout>) => [
    ...layout.header,
    ...layout.secondary,
    ...layout.auxiliary,
    ...layout.back,
  ];

  it('drops every changeMessage, which is what makes Apple stay quiet', () => {
    const layout = layoutFor(4);
    // Precondition: the loud version really does carry one, or this asserts nothing.
    expect(allFields(layout).some((f) => f.changeMessage)).toBe(true);

    const quiet = [
      ...withoutChangeMessages(layout.header),
      ...withoutChangeMessages(layout.secondary),
      ...withoutChangeMessages(layout.auxiliary),
      ...withoutChangeMessages(layout.back),
    ];
    expect(quiet.some((f) => f.changeMessage !== undefined)).toBe(false);
  });

  it('keeps the values, because the card must still become correct', () => {
    // ⚠️ The whole point of the change: silence used to mean skipping the push,
    // which left the iPhone showing a stamp the customer no longer had.
    const loud = allFields(layoutFor(4));
    const quiet = withoutChangeMessages(loud);

    expect(quiet).toHaveLength(loud.length);
    expect(quiet.map((f) => [f.key, f.label, f.value])).toEqual(
      loud.map((f) => [f.key, f.label, f.value])
    );
    expect(quiet.find((f) => f.key === 'progress')?.value).toBe('4 de 10');
  });

  it('leaves the original fields untouched', () => {
    const layout = layoutFor(4);
    const before = allFields(layout).filter((f) => f.changeMessage).length;
    withoutChangeMessages(allFields(layout));
    expect(allFields(layout).filter((f) => f.changeMessage).length).toBe(before);
  });
});
