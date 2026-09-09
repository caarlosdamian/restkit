import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { renderStrip, ImageRenderUnavailableError } from '@/lib/strip-render';
import { loyaltyConfig, DEFAULT_LOYALTY } from '@/lib/loyalty';
import type { CardGround, LoyaltyMechanic, PhotoPlacement, StampStyle } from '@/models/Business';

/**
 * The strip exactly as it will ship, rendered by the same code the pass uses.
 * The card chrome around it in the dashboard is CSS; this is the part that
 * could drift, so it comes from the real renderer instead of a lookalike.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return new Response(null, { status: 401 });

  const q = new URL(req.url).searchParams;
  const mechanic = (q.get('mechanic') === 'cashback' ? 'cashback' : 'sellos') as LoyaltyMechanic;
  const ground = (['light', 'brand', 'dark'].includes(q.get('ground') ?? '')
    ? q.get('ground')
    : DEFAULT_LOYALTY.card.ground) as CardGround;
  const stampStyle = (['plain', 'filled', 'outline'].includes(q.get('stampStyle') ?? '')
    ? q.get('stampStyle')
    : DEFAULT_LOYALTY.card.stampStyle) as StampStyle;
  const photoPlacement = (['background', 'side', 'footer'].includes(q.get('placement') ?? '')
    ? q.get('placement')
    : DEFAULT_LOYALTY.card.photoPlacement) as PhotoPlacement;

  const config = loyaltyConfig({
    settings: {
      loyalty: {
        ...DEFAULT_LOYALTY,
        mechanic,
        sellos: {
          ...DEFAULT_LOYALTY.sellos,
          required: Math.min(30, Math.max(1, Number(q.get('required') ?? 10))),
          rewardDescription: q.get('reward') || DEFAULT_LOYALTY.sellos.rewardDescription,
          unitPlural: q.get('unitPlural') || DEFAULT_LOYALTY.sellos.unitPlural,
        },
        cashback: {
          ...DEFAULT_LOYALTY.cashback,
          rate: Number(q.get('rate') ?? DEFAULT_LOYALTY.cashback.rate),
          threshold: Number(q.get('threshold') ?? 100),
        },
        card: {
          ...DEFAULT_LOYALTY.card,
          ground,
          stampStyle,
          photoPlacement,
          stampIcon: q.get('icon') || 'star',
          stripImage: q.get('bg') || undefined,
          customIconUrl: q.get('customIcon') || undefined,
        },
      },
    },
  } as never);

  let png: Buffer;
  try {
    png = await renderStrip({
      currentVisits: Math.max(0, Number(q.get('stamps') ?? 0)),
      cashbackBalance: Number(q.get('balance') ?? 0),
      config,
      brandColor: `#${(q.get('color') || '10b981').replace('#', '')}`,
      backgroundUrl: config.card.stripImage,
      customIconUrl: config.card.customIconUrl,
      scale: 2,
    });
  } catch (err) {
    // This lands inside an <img>, so an HTML error page shows the owner a
    // broken-image icon and nothing else. Say what happened in a header the
    // form can read, and log the cause where a deployment can be diagnosed.
    const unavailable = err instanceof ImageRenderUnavailableError;
    console.error('Strip preview failed:', err);
    return new Response(null, {
      status: unavailable ? 503 : 500,
      headers: { 'X-Render-Error': unavailable ? err.code : 'RENDER_FAILED' },
    });
  }

  return new Response(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      // The owner is dragging sliders — never serve a stale frame.
      'Cache-Control': 'no-store',
    },
  });
}
