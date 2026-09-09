import { describe, it, expect } from 'vitest';
import {
  stampState,
  accrualFor,
  cashbackRedeemable,
  maxCashbackFor,
  applyDelta,
  loyaltyConfig,
  DEFAULT_LOYALTY,
} from '@/lib/loyalty';
import {
  stampPalette,
  saturation,
  stripSvg,
  renderStrip,
  readableInk,
  contrastRatio,
  groundFor,
} from '@/lib/strip-render';
import { findStampIcon, searchStampIcons, STAMP_ICONS } from '@/lib/stamp-icons';
import type { ILoyaltyConfig } from '@/models/Business';

const sellos = (
  over: Partial<ILoyaltyConfig['sellos']> = {},
  card: Partial<ILoyaltyConfig['card']> = {}
): ILoyaltyConfig => ({
  ...DEFAULT_LOYALTY,
  mechanic: 'sellos',
  sellos: { ...DEFAULT_LOYALTY.sellos, ...over },
  card: { ...DEFAULT_LOYALTY.card, ...card },
});

const cashback = (over: Partial<ILoyaltyConfig['cashback']> = {}): ILoyaltyConfig => ({
  ...DEFAULT_LOYALTY,
  mechanic: 'cashback',
  cashback: { ...DEFAULT_LOYALTY.cashback, ...over },
});

describe('stampState', () => {
  it('counts partial progress', () => {
    expect(stampState(3, 10)).toEqual({ rewardsPending: 0, stamps: 3, cardFull: false });
  });

  it('shows a completed card as full, not as freshly empty', () => {
    // The old code reset to 0 the instant the last stamp landed, so the
    // customer never saw they had won.
    expect(stampState(10, 10)).toEqual({ rewardsPending: 1, stamps: 10, cardFull: true });
  });

  it('keeps earning while a reward waits to be claimed', () => {
    expect(stampState(12, 10)).toEqual({ rewardsPending: 1, stamps: 2, cardFull: false });
  });

  it('tracks more than one unclaimed reward', () => {
    expect(stampState(23, 10)).toEqual({ rewardsPending: 2, stamps: 3, cardFull: false });
  });

  it('never goes negative or divides by zero', () => {
    expect(stampState(-5, 10).stamps).toBe(0);
    expect(stampState(3, 0).rewardsPending).toBe(3);
  });
});

describe('accrualFor', () => {
  it('gives one stamp per paid order', () => {
    expect(accrualFor({ total: 340 }, sellos())).toEqual({ mechanic: 'sellos', delta: 1 });
  });

  it('earns nothing on a zero-total order', () => {
    expect(accrualFor({ total: 0 }, sellos())).toBeNull();
  });

  it('ignores the guards when they are unset — the shipped default', () => {
    // Split-bill farming is accepted, deliberately. The guards exist in the
    // schema so turning them on later is a settings change, not a migration.
    expect(accrualFor({ total: 50, todayCount: 9 }, sellos())).not.toBeNull();
  });

  it('applies a minimum ticket once configured', () => {
    expect(accrualFor({ total: 50 }, sellos({ minTicket: 80 }))).toBeNull();
    expect(accrualFor({ total: 80 }, sellos({ minTicket: 80 }))).not.toBeNull();
  });

  it('applies a daily cap once configured', () => {
    const config = sellos({ maxPerDay: 1 });
    expect(accrualFor({ total: 200, todayCount: 0 }, config)).not.toBeNull();
    expect(accrualFor({ total: 200, todayCount: 1 }, config)).toBeNull();
  });

  it('accrues a percentage under cashback', () => {
    expect(accrualFor({ total: 340 }, cashback({ rate: 5 }))).toEqual({
      mechanic: 'cashback',
      delta: 17,
    });
  });

  it('rounds cashback to centavos', () => {
    expect(accrualFor({ total: 149.99 }, cashback({ rate: 5 }))?.delta).toBe(7.5);
  });

  it('earns nothing at a zero rate', () => {
    expect(accrualFor({ total: 340 }, cashback({ rate: 0 }))).toBeNull();
  });
});

describe('cashback redemption', () => {
  it('stays locked below the threshold', () => {
    expect(cashbackRedeemable(87, cashback({ threshold: 100 }))).toBe(false);
    expect(maxCashbackFor(87, 340, cashback({ threshold: 100 }))).toBe(0);
  });

  it('unlocks at the threshold', () => {
    expect(cashbackRedeemable(100, cashback({ threshold: 100 }))).toBe(true);
  });

  it('never applies more than the bill', () => {
    expect(maxCashbackFor(128, 60, cashback({ threshold: 100 }))).toBe(60);
  });

  it('never applies more than the balance', () => {
    expect(maxCashbackFor(128, 340, cashback({ threshold: 100 }))).toBe(128);
  });
});

describe('applyDelta', () => {
  it('floors at zero so a reversal cannot push a customer negative', () => {
    expect(applyDelta(1, -5)).toBe(0);
  });

  it('keeps money arithmetic exact to centavos', () => {
    expect(applyDelta(0.1, 0.2)).toBe(0.3);
  });
});

describe('loyaltyConfig', () => {
  it('fills in defaults for a business saved before a field existed', () => {
    expect(loyaltyConfig(null).sellos.required).toBe(10);
    expect(loyaltyConfig({ settings: { loyalty: { mechanic: 'cashback' } } } as never).cashback.rate)
      .toBe(5);
  });
});

describe('readable stamp ink', () => {
  it('leaves a colour that already reads alone', () => {
    expect(readableInk('#0b7d57')).toBe('#0b7d57');
  });

  it('darkens a pale brand so earned stamps are visible', () => {
    // The reported bug: a light brand stroked stamps that vanished on the
    // white card ground. Pure white made them disappear entirely.
    for (const pale of ['#fde047', '#fce7f3', '#ffffff', '#a7f3d0']) {
      const ink = readableInk(pale);
      expect(contrastRatio(ink, '#ffffff')).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the hue so the card still looks like the brand', () => {
    // Pastel pink stays pink, not a generic dark grey.
    const ink = readableInk('#fce7f3');
    const [r, , b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(60);
  });

  it('uses neutral ink for a brand with no hue', () => {
    // White/grey/black have undefined hue — inventing one turned white into red.
    expect(readableInk('#ffffff')).toBe('#3a4550');
    expect(readableInk('#f2f2f2')).toBe('#3a4550');
  });

  it('renders every earned stamp visibly for a white brand, in any style', () => {
    // The requirement is that a white brand never draws white-on-white. How
    // that shows up in the markup depends on the style — `filled` strokes the
    // glyph in the GROUND colour on purpose, knocking it out of a dark disc —
    // so assert the readable ink is what carries the stamp, not one selector.
    for (const stampStyle of ['plain', 'filled', 'outline'] as const) {
      const svg = stripSvg({
        currentVisits: 4,
        cashbackBalance: 0,
        config: sellos({ required: 10 }, { stampStyle }),
        brandColor: '#ffffff',
      });
      expect(svg).toContain('#3a4550');
    }

    // Under `plain` there is no disc to knock out of, so nothing may be white.
    const plain = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }, { stampStyle: 'plain' }),
      brandColor: '#ffffff',
    });
    expect(plain).not.toContain('stroke="#ffffff"');
    expect(plain).toContain('stroke="#3a4550"');
  });
});

describe('stamp palette', () => {
  it('greys out pending stamps for a saturated brand', () => {
    const p = stampPalette('#0b7d57');
    expect(p.outlinePending).toBe(false);
    expect(p.earned).toBe('#0b7d57');
  });

  it('falls back to an outline when the brand is already grey', () => {
    // Grey-on-grey would make earned and pending indistinguishable.
    expect(saturation('#8a8a8a')).toBeLessThan(0.18);
    expect(stampPalette('#8a8a8a').outlinePending).toBe(true);
  });
});

describe('stripSvg', () => {
  it('draws one shape per required stamp', () => {
    const svg = stripSvg({
      currentVisits: 3,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
    });
    // 3 earned + 7 pending, all as <g> groups for a saturated brand.
    expect(svg.match(/<g transform/g)).toHaveLength(10);
  });

  it('shouts when the card is complete', () => {
    const svg = stripSvg({
      currentVisits: 10,
      cashbackBalance: 0,
      config: sellos({ required: 10, rewardDescription: 'Café gratis' }),
      brandColor: '#0b7d57',
    });
    expect(svg).toContain('¡PREMIO LISTO!');
    expect(svg).toContain('Café gratis');
  });

  it('keeps the caption legible for a dark brand', () => {
    // Regression: the caption colour was derived from brand luminance, which
    // is right when the strip ground IS the brand colour (cashback) but put
    // white text on the white stamp-card ground for any dark brand.
    const svg = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
    });
    expect(svg).toContain('Te faltan 6 visitas para tu premio');
    expect(svg).not.toMatch(/fill="#ffffff">Te faltan/);
  });

  it('lays a band under the caption when a photo is behind it', () => {
    const svg = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
      backgroundUrl: 'https://example.test/local.jpg',
    });
    expect(svg).toContain('opacity="0.55"');
  });

  it('renders a balance under cashback', () => {
    const svg = stripSvg({
      currentVisits: 0,
      cashbackBalance: 128.5,
      config: cashback({ threshold: 100 }),
      brandColor: '#0b7d57',
    });
    expect(svg).toContain('$128.50');
    expect(svg).toContain('listo para usarse');
  });

  it('tells the customer how far off the threshold they are', () => {
    const svg = stripSvg({
      currentVisits: 0,
      cashbackBalance: 87,
      config: cashback({ threshold: 100 }),
      brandColor: '#0b7d57',
    });
    expect(svg).toContain('Te faltan $13.00');
  });

  it('escapes a reward description containing markup', () => {
    const svg = stripSvg({
      currentVisits: 10,
      cashbackBalance: 0,
      config: sellos({ required: 10, rewardDescription: 'Café <b>gratis</b> & más' }),
      brandColor: '#0b7d57',
    });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&amp;');
  });
});

describe('stamp icon catalogue', () => {
  it('every icon has a unique id and real path data', () => {
    const ids = STAMP_ICONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const icon of STAMP_ICONS) expect(icon.d.length).toBeGreaterThan(10);
  });

  it('falls back to a neutral icon for an unknown id', () => {
    expect(findStampIcon('does-not-exist').id).toBe('star');
    expect(findStampIcon(undefined).id).toBe('star');
  });

  it('searches accent-insensitively in Spanish', () => {
    expect(searchStampIcons('cafe').some((i) => i.id === 'coffee')).toBe(true);
    expect(searchStampIcons('CAFÉ').some((i) => i.id === 'coffee')).toBe(true);
    expect(searchStampIcons('barberia').some((i) => i.id === 'scissors')).toBe(true);
  });
});

describe('uploaded stamp icon', () => {
  const dataUri = 'data:image/png;base64,iVBORw0KGgo=';

  it('draws the uploaded mark instead of the catalogue one', () => {
    // It was accepted, stored, and then never rendered — uploading a custom
    // icon silently did nothing.
    const svg = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
      customIconDataUri: dataUri,
    });
    expect(svg.match(/<image /g)).toHaveLength(10);
    expect(svg).not.toContain('<path d=');
  });

  it('desaturates pending copies rather than re-inking them', () => {
    const svg = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
      customIconDataUri: dataUri,
    });
    expect(svg).toContain('feColorMatrix');
    expect(svg.match(/filter="url\(#faded\)"/g)).toHaveLength(6);
  });

  it('adds no filter definition when no icon was uploaded', () => {
    const svg = stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#0b7d57',
    });
    expect(svg).not.toContain('feColorMatrix');
  });
});

describe('stamps over a background photo', () => {
  const DARK = '#4a3018';
  const LIGHT = '#efe7d8';

  it('inks LIGHTER on a dark photo instead of darker', () => {
    // The reported bug: earned stamps were inked for the white card ground and
    // vanished into an uploaded brown photo — the top row looked half empty.
    const ink = readableInk('#a06a2c', DARK);
    expect(contrastRatio(ink, DARK)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(ink, '#ffffff')).toBeLessThan(contrastRatio(ink, DARK));
  });

  it('still inks darker on a light photo', () => {
    const ink = readableInk('#a06a2c', LIGHT);
    expect(contrastRatio(ink, LIGHT)).toBeGreaterThanOrEqual(3);
  });

  it('flips the pending colour with the ground', () => {
    expect(stampPalette('#a06a2c', DARK).pending).toBe('#ffffff');
    expect(stampPalette('#a06a2c', LIGHT).pending).toBe('#b6bcc4');
    expect(stampPalette('#a06a2c', DARK).darkGround).toBe(true);
    expect(stampPalette('#a06a2c', LIGHT).darkGround).toBe(false);
  });

  it('leaves white alone on a dark photo and darkens it on a light one', () => {
    // White already clears contrast against a dark ground, so it stays white.
    expect(readableInk('#ffffff', DARK)).toBe('#ffffff');
    expect(readableInk('#ffffff', LIGHT)).toBe('#3a4550');
    // A hueless colour too close to the ground moves to the neutral that reads.
    expect(readableInk('#4a4a4a', DARK)).toBe('#f2f5f7');
    expect(readableInk('#d8d8d8', LIGHT)).toBe('#3a4550');
    // Whatever it picks, the requirement is contrast — assert that, not a hex.
    for (const ground of [DARK, LIGHT]) {
      for (const brand of ['#4a4a4a', '#d8d8d8', '#a06a2c', '#fde047']) {
        expect(contrastRatio(readableInk(brand, ground), ground)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('lays a scrim and a matching caption band over a photo', () => {
    const svg = stripSvg({
      currentVisits: 3,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#a06a2c',
      backgroundUrl: 'https://example.test/local.jpg',
      groundHex: DARK,
    });
    // Dark ground: dark veil, dark caption band, white caption text.
    expect(svg).toContain('fill="#000000" opacity="0.28"');
    expect(svg).toContain('fill="#ffffff">Te faltan 7');
    expect(svg).not.toContain('fill="#141a21">Te faltan 7');
  });

  it('keeps a light photo on light treatment', () => {
    const svg = stripSvg({
      currentVisits: 3,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#a06a2c',
      backgroundUrl: 'https://example.test/local.jpg',
      groundHex: LIGHT,
    });
    expect(svg).toContain('fill="#ffffff" opacity="0.28"');
    expect(svg).toContain('fill="#141a21">Te faltan 7');
  });

  it('assumes a white ground when there is no photo', () => {
    const svg = stripSvg({
      currentVisits: 3,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#a06a2c',
    });
    expect(svg).not.toContain('opacity="0.28"');
  });
});

describe('card ground', () => {
  it('paints white, the brand, or a deep version of the brand hue', () => {
    expect(groundFor('light', '#b3202c')).toBe('#ffffff');
    expect(groundFor('brand', '#b3202c')).toBe('#b3202c');

    // "Dark" keeps the hue so the card still belongs to the business — an
    // espresso for a red brand, a navy for a blue one, never generic black.
    const dark = groundFor('dark', '#b3202c');
    expect(dark).not.toBe('#000000');
    expect(contrastRatio(dark, '#ffffff')).toBeGreaterThan(7);
  });

  it('falls back to a neutral for a brand with no hue to deepen', () => {
    expect(groundFor('dark', '#8a8a8a')).toBe('#1b2430');
  });

  it('lets an uploaded photo win over the setting', () => {
    // The owner uploaded a picture of their place because they want to see it.
    expect(groundFor('brand', '#b3202c', '#4a3018')).toBe('#4a3018');
  });

  it('keeps every ground readable for its ink', () => {
    for (const ground of ['light', 'brand', 'dark'] as const) {
      for (const brand of ['#b3202c', '#fde047', '#0b7d57', '#ffffff', '#8a8a8a', '#1b2430']) {
        const bg = groundFor(ground, brand);
        expect(contrastRatio(readableInk(brand, bg), bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('stamp styles', () => {
  const svgFor = (stampStyle: 'plain' | 'filled' | 'outline', ground: 'light' | 'brand' | 'dark') =>
    stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos({ required: 10 }, { stampStyle, ground }),
      brandColor: '#b3202c',
    });

  it('knocks the glyph out of the disc in the ground colour', () => {
    // This is what makes `filled` read across a counter: a solid badge with a
    // hole in it, rather than a hairline glyph floating on the card.
    const svg = svgFor('filled', 'light');
    expect(svg.match(/<circle/g)).toHaveLength(10);
    expect(svg).toContain('stroke="#ffffff"'); // the knockout
    expect(svg).toContain('fill="#b3202c" opacity="1"'); // 4 earned discs
  });

  it('rings the glyph instead of filling it', () => {
    const svg = svgFor('outline', 'brand');
    expect(svg.match(/<circle/g)).toHaveLength(10);
    expect(svg).toContain('fill="none"');
  });

  it('draws nothing but the glyph under plain', () => {
    const svg = svgFor('plain', 'light');
    expect(svg).not.toContain('<circle');
    expect(svg.match(/<g transform/g)).toHaveLength(10);
  });

  it('always separates earned from pending, in every combination', () => {
    // The whole point of a stamp card is being able to count it at a glance.
    for (const style of ['plain', 'filled', 'outline'] as const) {
      for (const ground of ['light', 'brand', 'dark'] as const) {
        const svg = svgFor(style, ground);
        // Some element carries a partial opacity: that is the pending state.
        const faded = svg.match(/opacity="0\.\d+"/g) ?? [];
        expect(faded.length).toBeGreaterThan(0);
      }
    }
  });

  it('defaults to the badge, not the bare glyph it shipped with', () => {
    expect(DEFAULT_LOYALTY.card.stampStyle).toBe('filled');
    expect(DEFAULT_LOYALTY.card.ground).toBe('light');
  });

  it('gives a business saved before these fields existed the defaults', () => {
    // Every existing row predates them, including ones whose stored card
    // object carries the key with an explicit undefined.
    const legacy = loyaltyConfig({
      settings: { loyalty: { card: { stampIcon: 'coffee' } } },
    } as never);
    expect(legacy.card).toMatchObject({ stampIcon: 'coffee', ground: 'light', stampStyle: 'filled' });

    const explicitUndefined = loyaltyConfig({
      settings: { loyalty: { card: { stampIcon: 'coffee', ground: undefined, stampStyle: undefined } } },
    } as never);
    expect(explicitUndefined.card.ground).toBe('light');
    expect(explicitUndefined.card.stampStyle).toBe('filled');
  });
});

describe('cashback strip', () => {
  const svg = (balance: number, ground: 'light' | 'brand' = 'light') =>
    stripSvg({
      currentVisits: 0,
      cashbackBalance: balance,
      config: { ...cashback({ rate: 5, threshold: 100 }), card: { ...DEFAULT_LOYALTY.card, ground } },
      brandColor: '#0b7d57',
    });

  it('shows what they have AND what they earn on the next purchase', () => {
    // The old strip showed the balance alone, which told a customer nothing
    // about why it was growing.
    const s = svg(62.5);
    expect(s).toContain('SALDO');
    expect(s).toContain('$62.50');
    expect(s).toContain('DEVUELVE');
    expect(s).toContain('5%');
    expect(s).toContain('Te faltan $37.50 para usarlo');
  });

  it('fills the bar and changes the message once the balance is usable', () => {
    const s = svg(240);
    expect(s).toContain('Tu saldo está listo para usarse');
    // Bar at full width: 375 - 22*2 = 331.
    expect(s).toContain('width="331.0"');
  });

  it('never divides by a zero threshold', () => {
    const s = stripSvg({
      currentVisits: 0,
      cashbackBalance: 0,
      config: cashback({ rate: 5, threshold: 0 }),
      brandColor: '#0b7d57',
    });
    expect(s).not.toContain('NaN');
    expect(s).toContain('Tu saldo está listo para usarse');
  });
});

describe('what the card art says', () => {
  const caption = (currentVisits: number, over: Partial<ILoyaltyConfig['sellos']> = {}) =>
    stripSvg({ currentVisits, cashbackBalance: 0, config: sellos(over), brandColor: '#0b7d57' });

  it('names the distance to the reward, not the count already in the field', () => {
    // Both wallets print "4 de 10" in a field beside the strip. Repeating it
    // spent the one line of copy on the card saying what was just read.
    const svg = caption(4, { required: 10 });
    expect(svg).toContain('Te faltan 6 visitas para tu premio');
    expect(svg).not.toContain('4 de 10');
  });

  it('agrees in number when only one is left', () => {
    expect(caption(9, { required: 10, unitSingular: 'visita' })).toContain('Te falta 1 visita para');
  });

  it('switches to the reward itself once the card is full', () => {
    const svg = caption(10, { required: 10, rewardDescription: 'Un café gratis' });
    expect(svg).toContain('¡PREMIO LISTO!');
    expect(svg).toContain('Un café gratis');
    expect(svg).not.toContain('Te faltan');
  });
});

describe('where the photo goes', () => {
  const PHOTO = 'https://example.test/local.jpg';
  const svgFor = (
    photoPlacement: 'background' | 'side' | 'footer',
    over: Partial<ILoyaltyConfig['sellos']> = {},
    photoInset = 0
  ) =>
    stripSvg({
      currentVisits: 4,
      cashbackBalance: 0,
      config: sellos(over, { photoPlacement }),
      brandColor: '#b3202c',
      // renderStrip only passes backgroundUrl through once it has composited a
      // base, and only sets an inset for `side`.
      backgroundUrl: photoPlacement === 'footer' ? undefined : PHOTO,
      groundHex: '#4a3018',
      photoInset,
    });

  it('keeps the stamps clear of the picture under `side`', () => {
    // The band the photo takes is the band the stamps must not use.
    const inset = 135;
    const svg = svgFor('side', { required: 10 }, inset);
    const xs = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]));

    expect(xs.length).toBe(10);
    for (const x of xs) expect(x).toBeGreaterThan(inset);
  });

  it('inks `side` stamps for the card ground, not for the photo', () => {
    // Under `side` the stamps sit on the ground; letting the photo's average
    // drive the ink would tint them for a surface they never touch.
    const svg = svgFor('side', { required: 6 }, 135);
    // A white ground means dark ink, even though groundHex is a dark brown.
    expect(svg).toContain('fill="#b3202c"');
    expect(svg).not.toContain('opacity="0.28"'); // no full-width veil
  });

  it('veils the whole band only when the photo is BEHIND the stamps', () => {
    expect(svgFor('background', { required: 10 })).toContain('opacity="0.28"');
    expect(svgFor('side', { required: 10 }, 135)).not.toContain('opacity="0.28"');
  });

  it('leaves the strip alone under `footer`', () => {
    // The photo gets a band of its own outside the strip — Google renders it as
    // an image module, the web card as a band. Apple has nowhere to put it.
    const svg = svgFor('footer', { required: 10 });
    expect(svg).toContain('fill="#ffffff"'); // the plain card ground, painted
    expect(svg).not.toContain('opacity="0.28"');
  });

  it('centres the caption over the stamps, not over the whole strip', () => {
    const plain = svgFor('background', { required: 10 });
    expect(plain).toContain('x="187.5"');
    const side = svgFor('side', { required: 10 }, 135);
    expect(side).toContain('x="255"'); // 135 + (375-135)/2
  });
});

describe('the renderer itself', () => {
  // Nothing else in the suite actually invokes sharp: every strip test reads
  // the SVG string, so a sharp that cannot load — or whose API moved — passed
  // all 405 of them and failed only in production. This is the one test that
  // proves the native binding works before a deploy does.
  it('produces a PNG', async () => {
    const png = await renderStrip({
      currentVisits: 3,
      cashbackBalance: 0,
      config: sellos({ required: 10 }),
      brandColor: '#b7348d',
      scale: 2,
    });
    // PNG magic number, and a strip with ten stamps drawn on it is not tiny.
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.byteLength).toBeGreaterThan(1000);
  });
});
