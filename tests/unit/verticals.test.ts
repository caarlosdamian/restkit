import { describe, it, expect } from 'vitest';
import { VERTICALS, getVertical, verticalLinkLabel } from '@/lib/verticals';
import { STAMP_ICONS } from '@/lib/stamp-icons';
import { contrastRatio } from '@/lib/card-colors';
import sitemap from '@/app/sitemap';

describe('the pages are actually different from each other', () => {
  // The failure mode of programmatic SEO: twelve pages whose only difference
  // is the noun. Google calls that thin content and it earns nothing.
  const unique = <T>(xs: T[]) => new Set(xs.map((x) => JSON.stringify(x))).size;

  it('gives every vertical its own headline, tagline and pull quote', () => {
    expect(unique(VERTICALS.map((v) => v.title))).toBe(VERTICALS.length);
    expect(unique(VERTICALS.map((v) => v.tagline))).toBe(VERTICALS.length);
    expect(unique(VERTICALS.map((v) => v.pullQuote))).toBe(VERTICALS.length);
  });

  it('writes a real argument, not a sentence with a noun swapped', () => {
    for (const v of VERTICALS) {
      expect(v.problem.length).toBeGreaterThanOrEqual(2);
      expect(v.problem.join(' ').length).toBeGreaterThan(500);
    }
    expect(unique(VERTICALS.map((v) => v.problem))).toBe(VERTICALS.length);
  });

  it('gives every vertical its own reward ideas', () => {
    expect(unique(VERTICALS.map((v) => v.rewardIdeas))).toBe(VERTICALS.length);
    for (const v of VERTICALS) expect(v.rewardIdeas).toHaveLength(4);
  });

  it('answers at least one question specific to the trade', () => {
    for (const v of VERTICALS) expect(v.faq.length).toBeGreaterThanOrEqual(2);
    // No question text repeated across verticals.
    const all = VERTICALS.flatMap((v) => v.faq.map((f) => f.q));
    expect(new Set(all).size).toBe(all.length);
  });

  it('does not lead every page with the same mechanic', () => {
    // A gym is not a taquería. If these all matched, the pages would be a
    // template with the noun swapped after all.
    const mechanics = new Set(VERTICALS.map((v) => v.mechanic));
    expect(mechanics.size).toBe(2);
  });

  it('calls the customer what the trade calls them', () => {
    const nouns = new Set(VERTICALS.map((v) => v.customer.many));
    expect(nouns.size).toBeGreaterThan(2);
    expect(nouns).toContain('comensales');
    expect(nouns).toContain('pacientes');
  });
});

describe('the data is usable by the page', () => {
  it('has a unique, url-safe slug for each', () => {
    const slugs = VERTICALS.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('points at an icon that exists in the catalogue', () => {
    // A bad id silently falls back, so the page would ship the wrong mark.
    const ids = new Set(STAMP_ICONS.map((i) => i.id));
    for (const v of VERTICALS) expect(ids.has(v.icon)).toBe(true);
  });

  it('picks an accent the card can actually print on', () => {
    // The sample card paints the ground in this colour; white text on it has
    // to read, or the hero ships unreadable.
    for (const v of VERTICALS) {
      expect(v.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrastRatio(v.accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps meta descriptions inside what a search result shows', () => {
    for (const v of VERTICALS) {
      expect(v.metaDescription.length).toBeGreaterThan(80);
      expect(v.metaDescription.length).toBeLessThanOrEqual(165);
    }
  });

  it('resolves a slug, and refuses one that does not exist', () => {
    expect(getVertical('barberias')?.plural).toBe('barberías');
    expect(getVertical('no-existe')).toBeUndefined();
  });

  it('labels a link with the phrase the page targets', () => {
    expect(verticalLinkLabel(getVertical('spas')!)).toBe('Programa de lealtad para spas');
  });
});

describe('sitemap', () => {
  it('lists every vertical page so a crawler finds all of them', () => {
    const urls = sitemap().map((e) => e.url);
    for (const v of VERTICALS) {
      expect(urls.some((u) => u.endsWith(`/lealtad/${v.slug}`))).toBe(true);
    }
    expect(urls.length).toBe(VERTICALS.length + 2);
  });

  it('keeps customer- and staff-scoped routes out of it', () => {
    const urls = sitemap().map((e) => e.url).join(' ');
    for (const path of ['/c/', '/j/', '/scan', '/dashboard', '/pos']) {
      expect(urls).not.toContain(path);
    }
  });
});
