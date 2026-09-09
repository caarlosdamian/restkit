import Customer from '@/models/Customer';
import { businessRepository } from '@/repositories/business.repository';
import { loyaltyConfig } from '@/lib/loyalty';
import { renderStrip, ImageRenderUnavailableError } from '@/lib/strip-render';
import dbConnect from '@/lib/db';

/**
 * The customer's stamp card as a public PNG.
 *
 * Google Wallet has no stamps widget and no way to embed an image in the pass
 * file — it fetches `heroImage` from a URL of ours. So this is what puts the
 * same card an iPhone gets onto an Android phone, instead of the bare "3 / 10"
 * text that was the whole Android experience before.
 *
 * Unauthenticated on purpose: Google's fetchers carry no session, and the
 * publicToken IS the credential (20 random bytes, never an ObjectId). It
 * exposes exactly what the customer's own pass already shows them.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  await dbConnect();
  const customer = await Customer.findOne({ publicToken: token }).select('stats businessId');
  if (!customer) return new Response(null, { status: 404 });

  const business = await businessRepository.findById(customer.businessId.toString());
  if (!business) return new Response(null, { status: 404 });

  const config = loyaltyConfig(business);

  let png: Buffer;
  try {
    png = await renderStrip({
      currentVisits: customer.stats.currentVisits,
      cashbackBalance: customer.stats.cashbackBalance ?? 0,
      config,
      brandColor: business.branding?.primaryColor || '#4f46e5',
      backgroundUrl: config.card.stripImage,
      customIconUrl: config.card.customIconUrl,
      // Google's hero slot is 1032×336; the strip's box is the same 3:1, so @3x
      // lands almost exactly on it without a second layout.
      scale: 3,
    });
  } catch (err) {
    // Never cached: Google keeps whatever it fetches, and an error frozen
    // against this URL would outlive the deployment that caused it.
    const unavailable = err instanceof ImageRenderUnavailableError;
    console.error('Strip render failed:', err);
    return new Response(null, {
      status: unavailable ? 503 : 500,
      headers: {
        'Cache-Control': 'no-store',
        'X-Render-Error': unavailable ? err.code : 'RENDER_FAILED',
      },
    });
  }

  return new Response(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      // Google caches what it fetches, which is why the caller versions this
      // URL by stamp count — a new count is a new URL, so the card can never
      // show a stale number. Within one count the image really is immutable.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
