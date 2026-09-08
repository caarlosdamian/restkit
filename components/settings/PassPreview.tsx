"use client";

import { useMemo } from "react";
import { groundFor, readableInk, relLuminance } from "@/lib/card-colors";
import { buildCardLayout, type CardField } from "@/lib/card-layout";
import type { ILoyaltyConfig } from "@/models/Business";

/**
 * The pass as each wallet will actually build it.
 *
 * The old preview was a generic phone-ish chrome wrapped around the strip,
 * which hid every layout decision that matters — an owner could not see that
 * their "titular" sits in a two-up row on Apple and in a text module on
 * Android, or that a header field is the only thing a stacked pass shows.
 *
 * Both panels read the SAME lib/card-layout.ts the builders do, so a slot the
 * owner fills here lands in the same place on the real pass.
 */

export type Platform = "apple" | "google";

interface Props {
  platform: Platform;
  config: ILoyaltyConfig;
  businessName: string;
  logo?: string;
  brandColor: string;
  /** The strip PNG from the real renderer. */
  stripSrc: string;
  customerName: string;
  stamps: number;
  balance: number;
  /** Only rendered under `footer` placement — otherwise it is already in the
   *  strip, and Apple has nowhere to put it at all. */
  photo?: string;
}

export default function PassPreview(props: Props) {
  const { config, brandColor } = props;
  const ground = groundFor(config.card.ground, brandColor);
  const onDark = relLuminance(ground) < 0.4;
  const ink = readableInk(brandColor, ground);
  const text = onDark ? "#ffffff" : "#141a21";
  const label = onDark ? "rgba(255,255,255,.66)" : "rgba(20,26,33,.55)";
  const divider = onDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.09)";

  const layout = useMemo(
    () =>
      buildCardLayout(
        {
          businessName: props.businessName,
          config,
          customer: {
            name: props.customerName,
            phone: "55 1234 5678",
            createdAt: new Date(),
            stats: {
              totalVisits: props.stamps,
              currentVisits: props.stamps,
              cashbackBalance: props.balance,
            },
          },
          hasStrip: true,
        },
        config.card.fields
      ),
    [config, props.businessName, props.customerName, props.stamps, props.balance]
  );

  const shared = { text, label, divider, ground, ink };

  return props.platform === "apple" ? (
    <ApplePass {...props} {...shared} layout={layout} />
  ) : (
    <GooglePass {...props} {...shared} layout={layout} />
  );
}

/* ---------------------------------------------------------------- apple */

function ApplePass({
  businessName,
  logo,
  stripSrc,
  layout,
  config,
  photo,
  ground,
  text,
  label,
  divider,
}: Props & Chrome & { layout: ReturnType<typeof buildCardLayout> }) {
  const footerPhoto = Boolean(photo) && config.card.photoPlacement === 'footer';
  return (
    <Frame caption="Apple Wallet · storeCard">
      <div className="overflow-hidden rounded-[1.15rem]" style={{ backgroundColor: ground, color: text }}>
        {/* Header row. Everything below the strip disappears when the pass is
            stacked behind another in Wallet — this row is all that survives. */}
        <div className="flex items-center justify-between gap-3 px-3.5 pt-3 pb-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-[1.15rem] max-w-[7rem] object-contain" />
          ) : (
            <span className="truncate text-[0.7rem] font-bold">{businessName}</span>
          )}
          {layout.header[0] && <FieldCell field={layout.header[0]} label={label} align="right" />}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stripSrc} alt="Vista previa de la tarjeta" className="block w-full" />

        {layout.secondary.length > 0 && (
          <Row fields={layout.secondary} label={label} />
        )}
        {layout.auxiliary.length > 0 && (
          <div style={{ borderTop: `1px solid ${divider}` }}>
            <Row fields={layout.auxiliary} label={label} />
          </div>
        )}

        <div className="flex justify-center px-3.5 pb-3.5 pt-1">
          <QrPlate />
        </div>
      </div>

      {footerPhoto && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[0.65rem] leading-snug text-amber-800">
          La foto no aparece aquí: una tarjeta de Apple tiene un solo espacio
          para imagen y los sellos ya lo ocupan.
        </p>
      )}
    </Frame>
  );
}

/* --------------------------------------------------------------- google */

function GooglePass({
  businessName,
  logo,
  stripSrc,
  layout,
  config,
  ground,
  text,
  label,
  divider,
  stamps,
  balance,
  photo,
}: Props & Chrome & { layout: ReturnType<typeof buildCardLayout> }) {
  const isCashback = config.mechanic === "cashback";
  const points = isCashback
    ? { label: "Saldo", value: `$${balance.toLocaleString("es-MX")}` }
    : { label: cap(config.sellos.unitPlural), value: `${stamps} / ${config.sellos.required}` };

  return (
    <Frame caption="Google Wallet · loyaltyObject">
      <div className="overflow-hidden rounded-[1.15rem]" style={{ backgroundColor: ground, color: text }}>
        <div className="flex items-center gap-2 px-3.5 pt-3.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-5 w-5 rounded-full object-contain" />
          ) : (
            <span className="h-5 w-5 rounded-full" style={{ backgroundColor: `${text}22` }} />
          )}
          <span className="truncate text-[0.7rem] font-semibold">{businessName}</span>
        </div>

        <div className="px-3.5 pb-3 pt-3">
          <p className="text-[0.52rem] font-bold uppercase tracking-widest" style={{ color: label }}>
            {points.label}
          </p>
          <p className="text-xl font-bold tabular-nums">{points.value}</p>
        </div>

        {/* The hero is the same strip the iPhone gets — Google has no stamps
            widget either, and text alone was the whole Android experience. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stripSrc} alt="" className="block w-full" />

        <div className="flex justify-center px-3.5 py-3.5">
          <QrPlate />
        </div>

        {photo && config.card.photoPlacement === 'footer' && (
          // Google's image module — a band of its own, which is the placement
          // Apple has no slot for.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="block h-20 w-full object-cover" />
        )}

        <div className="space-y-2 px-3.5 pb-4" style={{ borderTop: `1px solid ${divider}` }}>
          {layout.secondary
            .filter((f) => f.key !== "progress")
            .map((f) => (
              <div key={f.key} className="pt-2.5">
                <p
                  className="text-[0.52rem] font-bold uppercase tracking-widest"
                  style={{ color: label }}
                >
                  {f.label}
                </p>
                <p className="truncate text-xs font-semibold">{f.value}</p>
              </div>
            ))}
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------- parts */

interface Chrome {
  ground: string;
  text: string;
  label: string;
  divider: string;
  ink: string;
}

function Frame({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="rounded-[1.4rem] bg-gray-900 p-2 shadow-lg">{children}</div>
      <p className="text-center text-[0.65rem] font-medium text-gray-400">{caption}</p>
    </div>
  );
}

function Row({ fields, label }: { fields: CardField[]; label: string }) {
  return (
    <div className="flex gap-4 px-3.5 py-2.5">
      {fields.map((f, i) => (
        <div key={f.key} className={`min-w-0 flex-1 ${i > 0 ? "text-right" : ""}`}>
          <FieldCell field={f} label={label} align={i > 0 ? "right" : "left"} />
        </div>
      ))}
    </div>
  );
}

function FieldCell({
  field,
  label,
  align,
}: {
  field: CardField;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p
        className="truncate text-[0.52rem] font-bold uppercase tracking-widest"
        style={{ color: label }}
      >
        {field.label}
      </p>
      <p className="truncate text-[0.72rem] font-semibold">{field.value}</p>
    </div>
  );
}

/**
 * Stands in for the barcode. Deliberately not a real QR: what an owner is
 * judging here is where the code sits and how much room it takes, and a
 * scannable-looking code that led nowhere would be worse than an obvious
 * placeholder.
 */
function QrPlate() {
  const modules = useMemo(() => {
    // Seeded so the pattern is stable across renders rather than flickering.
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const cells: boolean[] = [];
    for (let i = 0; i < 441; i++) cells.push(rand() > 0.5);
    return cells;
  }, []);

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#111827" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#ffffff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111827" />
    </g>
  );

  return (
    <div className="rounded-lg bg-white p-1.5">
      <svg viewBox="0 0 21 21" className="h-16 w-16" role="img" aria-label="Código QR (ejemplo)">
        <rect width="21" height="21" fill="#ffffff" />
        {modules.map((on, i) => {
          const x = i % 21;
          const y = Math.floor(i / 21);
          const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
          if (!on || inFinder) return null;
          return <rect key={i} x={x} y={y} width={1} height={1} fill="#111827" />;
        })}
        {finder(0, 0)}
        {finder(14, 0)}
        {finder(0, 14)}
      </svg>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
