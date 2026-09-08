import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoyaltyCard from '@/components/loyalty/LoyaltyCard';
import { DEFAULT_LOYALTY, loyaltyConfig } from '@/lib/loyalty';
import type { ILoyaltyConfig } from '@/models/Business';

const cfg = (over: Partial<ILoyaltyConfig> = {}, card: Partial<ILoyaltyConfig['card']> = {}) =>
  loyaltyConfig({
    settings: { loyalty: { ...DEFAULT_LOYALTY, ...over, card: { ...DEFAULT_LOYALTY.card, ...card } } },
  } as never);

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

function render(props: Partial<Parameters<typeof LoyaltyCard>[0]> = {}) {
  return renderToStaticMarkup(
    h(LoyaltyCard, {
      businessName: 'Pastelería Luna',
      customerName: 'Paola Núñez',
      config: cfg(),
      brandColor: '#b3202c',
      currentVisits: 4,
      cashbackBalance: 350,
      ...props,
    })
  );
}

/** Text nodes only. The logo's `alt` carries the business name on purpose —
 *  the mark IS the name for a screen reader — and must not count as the name
 *  being printed twice. */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ');
const occurrences = (html: string, needle: string) =>
  visibleText(html).split(needle).length - 1;

describe('every fact appears once', () => {
  it('puts the name in the band OR the title, never both', () => {
    // A competitor prints it in both, an inch apart. With a logo the band is a
    // letterhead and the title carries the name; without one the band has to.
    expect(occurrences(render({ logo: LOGO }), 'Pastelería Luna')).toBe(1);
    expect(occurrences(render(), 'Pastelería Luna')).toBe(1);
  });

  it('uses the logo as the band when there is one', () => {
    expect(render({ logo: LOGO })).toContain(`src="${LOGO}"`);
  });

  it('does not restate the cashback rate under the figure that already shows it', () => {
    // "5% de cada compra" sitting beneath "DEVUELVE 5%" is the same fact twice.
    const html = render({ config: cfg({ mechanic: 'cashback' }) });
    expect(html).toContain('Devuelve');
    expect(html).not.toContain('de cada compra');
  });

  it('does show the reward beside the holder for stamps', () => {
    // The stamps carry no such figure, so the slot is free for it.
    const html = render({
      config: cfg({ sellos: { ...DEFAULT_LOYALTY.sellos, rewardDescription: 'Un café gratis' } }),
    });
    expect(html).toContain('Premio');
    expect(html).toContain('Un café gratis');
  });
});

describe('one template, blocks that flex', () => {
  it('grows the code into the space the stamps did not take', () => {
    // Not two hard-coded layouts: cashback simply has no stamps block, so the
    // code fills what is left — which is why a competitor's cashback card looks
    // different from their stamp card.
    expect(render({ qrDataUrl: 'data:x', config: cfg({ mechanic: 'cashback' }) })).toContain('h-44');
    expect(render({ qrDataUrl: 'data:x' })).toContain('h-32');
  });

  it('draws one stamp per required visit, and none under cashback', () => {
    const stamps = render({ config: cfg({ sellos: { ...DEFAULT_LOYALTY.sellos, required: 8 } }) });
    expect(stamps.match(/<svg/g)).toHaveLength(8);
    expect(render({ config: cfg({ mechanic: 'cashback' }) })).not.toContain('<svg');
  });

  it('omits the code block entirely when none was rendered', () => {
    // qrDataUrl is generated async by the page; the component must not leave a
    // white plate behind when it is absent.
    expect(render()).not.toContain('rounded-2xl bg-white');
  });
});

describe('the photo', () => {
  it('gets a band of its own only under `footer`', () => {
    const footer = render({ photo: PHOTO, config: cfg({}, { photoPlacement: 'footer' }) });
    expect(footer).toContain('h-36 w-full object-cover');

    for (const photoPlacement of ['background', 'side'] as const) {
      expect(render({ photo: PHOTO, config: cfg({}, { photoPlacement }) })).not.toContain(
        'h-36 w-full object-cover'
      );
    }
  });

  it('veils a background photo so it never takes the stamps with it', () => {
    const html = render({ photo: PHOTO, config: cfg({}, { photoPlacement: 'background' }) });
    expect(html).toContain('rgba(255,255,255,.55)');
  });

  it('renders nothing photo-shaped when no photo was uploaded', () => {
    expect(render({ config: cfg({}, { photoPlacement: 'footer' }) })).not.toContain('object-cover');
  });
});
