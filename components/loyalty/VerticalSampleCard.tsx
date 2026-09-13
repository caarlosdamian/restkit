import { DEFAULT_LOYALTY, loyaltyConfig } from "@/lib/loyalty";
import LoyaltyCard from "@/components/loyalty/LoyaltyCard";
import type { Vertical } from "@/lib/verticals";

/**
 * One trade's loyalty card, drawn with the REAL card component and that
 * trade's own settings — a rendering of the actual product rather than a stock
 * photo or a hand-rolled mockup of one.
 *
 * Shared by the vertical landing pages (`/lealtad/[vertical]`, where it is the
 * hero) and the carousel on the home page. It lived inside the vertical page
 * until the home page needed the same card: two copies of this config would
 * have drifted the first time either changed, and the whole point is that both
 * surfaces show the same object.
 *
 * Sync on purpose, so a server component can render a dozen of these without
 * awaiting anything. `qrDataUrl` is deliberately not passed — a sample card has
 * no customer behind it, and LoyaltyCard drops the code block when it is absent.
 */
export default function VerticalSampleCard({ v }: { v: Vertical }) {
  const config = loyaltyConfig({
    settings: {
      loyalty: {
        ...DEFAULT_LOYALTY,
        mechanic: v.mechanic,
        sellos: {
          ...DEFAULT_LOYALTY.sellos,
          required: v.sample.required,
          rewardDescription: v.sample.reward,
          unitSingular: v.unit.one,
          unitPlural: v.unit.many,
        },
        cashback: { rate: v.sample.rate, threshold: 200 },
        card: {
          ...DEFAULT_LOYALTY.card,
          stampIcon: v.icon,
          // All three axes come from the catalogue: ground (light / brand /
          // dark) and where the photo sits. They are orthogonal by design —
          // see lib/card-colors.ts — so every combination is a real card an
          // owner can configure, not a mockup.
          ground: v.card.ground,
          stripImage: v.card.photo,
          photoPlacement: v.card.placement,
        },
      },
    },
  } as never);

  return (
    <LoyaltyCard
      businessName={`Tu ${v.yours.replace(/^tu /, "")}`}
      photo={v.card.photo}
      customerName={v.customer.one === "clienta" ? "Ana Sofía" : "Carlos Mendoza"}
      config={config}
      brandColor={v.accent}
      // Partway through, never at zero and never complete: an empty card shows
      // nothing working and a full one has no distance left to explain.
      currentVisits={Math.max(1, Math.floor(v.sample.required * 0.6))}
      cashbackBalance={340}
    />
  );
}
