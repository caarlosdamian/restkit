import { stampState, formatMXN } from '@/lib/loyalty';
import { groundFor, readableInk, relLuminance, saturation, LOW_SATURATION } from '@/lib/card-colors';
import { findStampIcon, STAMP_STROKE } from '@/lib/stamp-icons';
import type { ILoyaltyConfig } from '@/models/Business';

/**
 * The loyalty card as a web page, for /c/[token] — where a customer lands from
 * the QR on their ticket, usually before they have saved anything to a wallet.
 *
 * It draws from the same colour module as lib/strip-render.ts, so this page and
 * the pass that gets installed a tap later are recognisably the same object. It
 * is deliberately NOT the strip PNG: that image is sized for Apple's 375×123
 * box and would be a blurry letterbox on a phone screen.
 *
 * ONE template with optional blocks, not a layout per mechanic. Comparing a
 * competitor's stamp cards against their cashback ones, nothing about the frame
 * changes — the stamps block is simply absent, so the name and the code grow
 * into the space it left. Two hard-coded layouts would drift apart the first
 * time either changed.
 *
 * Block order: brand bar › title › figures (stamps OR balance) › holder ›
 * code › photo.
 */

interface Props {
  businessName: string;
  logo?: string;
  /** Photo of the place. Where it lands comes from `config.card.photoPlacement`. */
  photo?: string;
  customerName: string;
  config: ILoyaltyConfig;
  brandColor: string;
  currentVisits: number;
  cashbackBalance: number;
  /**
   * Pre-rendered because qrDataUrl is async and this component is not. The
   * wallet pass has carried a barcode all along; the web card was the one
   * surface without it, which made the two look like different products.
   */
  qrDataUrl?: string;
}

export default function LoyaltyCard({
  businessName,
  logo,
  photo,
  customerName,
  config,
  brandColor,
  currentVisits,
  cashbackBalance,
  qrDataUrl,
}: Props) {
  const ground = groundFor(config.card.ground, brandColor);
  const onDark = relLuminance(ground) < 0.4;
  const ink = readableInk(brandColor, ground);
  const text = onDark ? '#ffffff' : '#141a21';
  const rule = onDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)';

  const isCashback = config.mechanic === 'cashback';
  const placement = config.card.photoPlacement;
  const showPhoto = Boolean(photo);

  // The name appears exactly once. With a logo the top band is a letterhead —
  // the mark alone — and the name carries the title below it; without one the
  // band has to carry the name itself and the title is dropped. Competitors
  // print it in both places, an inch apart, which is a flaw to skip rather than
  // a detail to copy.
  const showTitle = Boolean(logo);

  const figures = isCashback ? (
    <CashbackFigures config={config} balance={cashbackBalance} ink={ink} text={text} />
  ) : (
    <Stamps
      config={config}
      currentVisits={currentVisits}
      brandColor={brandColor}
      ink={ink}
      ground={ground}
      text={text}
    />
  );

  return (
    <div
      className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5"
      style={{ backgroundColor: ground, color: text }}
    >
      {/* Brand bar — a tint of the ground rather than a new colour, so the card
          reads as one object instead of two stacked ones. */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ backgroundColor: onDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)' }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={businessName} className="h-6 max-w-[11rem] object-contain" />
        ) : (
          <p className="truncate text-sm font-bold tracking-tight">{businessName}</p>
        )}
      </div>

      <div className="px-5 pb-6 pt-4">
        {showTitle && (
          <h1 className="mb-3 truncate text-xl font-extrabold tracking-tight">{businessName}</h1>
        )}

        {showPhoto && placement === 'side' ? (
          <div className="flex items-stretch gap-4">
            <div className="w-[34%] shrink-0 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">{figures}</div>
          </div>
        ) : showPhoto && placement === 'background' ? (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* The same veil the renderer lays down, so a busy photo never
                takes the stamps with it. */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: onDark ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.55)' }}
            />
            <div className="relative p-3">{figures}</div>
          </div>
        ) : (
          figures
        )}

        <div
          className="mt-5 flex items-end justify-between gap-4 border-t pt-4"
          style={{ borderColor: rule }}
        >
          <div className="min-w-0">
            <Label>Titular</Label>
            <p className="truncate text-sm font-semibold">{customerName}</p>
          </div>
          {/* No second column under cashback: the rate is already the right-hand
              figure above, and "5% de cada compra" beneath "DEVUELVE 5%" is the
              same fact twice. The stamps carry no such figure, so the reward
              belongs here. */}
          {!isCashback && (
            <div className="min-w-0 text-right">
              <Label>Premio</Label>
              <p className="truncate text-sm font-semibold">
                {config.sellos.rewardDescription}
              </p>
            </div>
          )}
        </div>

        {qrDataUrl && (
          <div className="mt-5 flex justify-center">
            <div className="rounded-2xl bg-white p-2.5 shadow-sm">
              {/* Bigger where there is no stamps block above competing for the
                  card's vertical space. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Código de tu tarjeta"
                className={isCashback ? 'h-44 w-44' : 'h-32 w-32'}
              />
            </div>
          </div>
        )}
      </div>

      {showPhoto && placement === 'footer' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="block h-36 w-full object-cover" />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6rem] font-bold uppercase tracking-widest opacity-60">{children}</p>
  );
}

/* ---------------------------------------------------------------- sellos */

function Stamps({
  config,
  currentVisits,
  brandColor,
  ink,
  ground,
  text,
}: {
  config: ILoyaltyConfig;
  currentVisits: number;
  brandColor: string;
  ink: string;
  ground: string;
  text: string;
}) {
  const required = config.sellos.required;
  const state = stampState(currentVisits, required);
  const style = config.card.stampStyle;
  const d = findStampIcon(config.card.stampIcon).d;
  // A grey brand cannot distinguish earned from pending by colour alone, so
  // under `plain` — the only style with no disc or ring of its own — pending
  // gets a ring instead of a paler grey nobody can tell apart.
  const flatBrand = saturation(brandColor) < LOW_SATURATION;

  // Match the strip's row rule so the web card and the pass wrap identically.
  const cols =
    required <= 6 ? required : required <= 12 ? Math.ceil(required / 2) : Math.ceil(required / 3);

  const left = Math.max(0, required - state.stamps);
  const unit = left === 1 ? config.sellos.unitSingular : config.sellos.unitPlural;

  return (
    <>
      <div
        className="grid justify-items-center gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: required }, (_, i) => (
          <Stamp
            key={i}
            earned={i < state.stamps}
            style={style}
            ink={ink}
            ground={ground}
            d={d}
            flatBrand={flatBrand}
          />
        ))}
      </div>

      <p
        className="mt-4 text-center text-sm"
        style={{ color: state.cardFull ? ink : text, fontWeight: state.cardFull ? 700 : 500 }}
      >
        {state.cardFull
          ? `★ ¡Premio listo! · ${config.sellos.rewardDescription}`
          : `${left === 1 ? 'Te falta' : 'Te faltan'} ${left} ${unit} para tu premio`}
      </p>
      {state.rewardsPending > 1 && (
        <p className="mt-1 text-center text-xs opacity-70">
          Tienes {state.rewardsPending} premios sin canjear.
        </p>
      )}
    </>
  );
}

function Stamp({
  earned,
  style,
  ink,
  ground,
  d,
  flatBrand,
}: {
  earned: boolean;
  style: ILoyaltyConfig['card']['stampStyle'];
  ink: string;
  ground: string;
  d: string;
  flatBrand: boolean;
}) {
  const size = style === 'plain' ? 20 : 15;
  const off = (32 - size) / 2;
  const glyph = (stroke: string, opacity = 1) => (
    <g transform={`translate(${off} ${off}) scale(${size / 24})`} opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={STAMP_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );

  return (
    <svg viewBox="0 0 32 32" className="w-full max-w-[2.4rem]" role="presentation">
      {style === 'filled' && (
        <circle cx={16} cy={16} r={15} fill={ink} opacity={earned ? 1 : 0.12} />
      )}
      {style === 'outline' && (
        <circle
          cx={16} cy={16} r={14.2} fill="none" stroke={ink}
          strokeWidth={1.7} opacity={earned ? 0.85 : 0.28}
        />
      )}
      {style === 'plain' && !earned && flatBrand && (
        <circle cx={16} cy={16} r={14.2} fill="none" stroke={ink} strokeWidth={1.6} opacity={0.55} />
      )}

      {style === 'filled'
        ? earned
          ? glyph(ground)
          : glyph(ink, 0.38)
        : style === 'outline'
          ? glyph(ink, earned ? 1 : 0.32)
          : earned
            ? glyph(ink)
            : flatBrand
              ? null
              : glyph(ink, 0.34)}
    </svg>
  );
}

/* -------------------------------------------------------------- cashback */

function CashbackFigures({
  config,
  balance,
  ink,
  text,
}: {
  config: ILoyaltyConfig;
  balance: number;
  ink: string;
  text: string;
}) {
  const threshold = config.cashback.threshold;
  const short = Math.max(0, threshold - balance);
  const ready = short <= 0;
  const pct = threshold > 0 ? Math.min(100, (balance / threshold) * 100) : 100;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Saldo</Label>
          <p className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums">
            {formatMXN(balance)}
          </p>
        </div>
        <div className="text-right">
          <Label>Devuelve</Label>
          <p className="mt-0.5 text-3xl font-extrabold tabular-nums" style={{ color: ink }}>
            {config.cashback.rate}%
          </p>
        </div>
      </div>

      {/* The bar and the shortfall are ours, not theirs: a balance alone never
          tells a customer how close they are to being able to spend it. */}
      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: `${text}29` }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ink }} />
      </div>
      <p className="mt-2 text-sm" style={{ fontWeight: ready ? 700 : 500, opacity: ready ? 1 : 0.75 }}>
        {ready ? 'Tu saldo está listo para usarse' : `Te faltan ${formatMXN(short)} para usarlo`}
      </p>
    </>
  );
}
