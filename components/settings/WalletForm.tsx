"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Search, Upload, MapPin, Loader2, Stamp, Wallet, Bell, ExternalLink, Trash2 } from "lucide-react";
import { parsePin, mapsUrl, formatPin, type PinFailure } from "@/lib/geo-pin";
import {
  acceptAttr,
  uploadHint,
  ICON_TYPES,
  PHOTO_TYPES,
  LOGO_TYPES,
} from "@/lib/upload-limits";
import {
  STAMP_ICONS,
  STAMP_STROKE,
  CATEGORY_LABELS,
  findStampIcon,
  searchStampIcons,
  type StampCategory,
} from "@/lib/stamp-icons";
import { groundFor, readableInk } from "@/lib/card-colors";
import {
  DEFAULT_CARD_FIELDS,
  DEFAULT_CASHBACK_FIELDS,
  defaultCardFields,
  SLOT_LIMITS,
  fieldsForMechanic,
  type CardFieldConfig,
  type CardFieldId,
  type SlotId,
} from "@/lib/card-fields";
import {
  changeMessageFrom,
  fillTokens,
  VALUE_TOKEN,
  MAX_MESSAGE,
  MAX_RELEVANT_TEXT,
} from "@/lib/card-layout";
import { DEFAULT_LOYALTY } from "@/lib/loyalty";
import PassPreview, { type Platform } from "./PassPreview";
import type { CardGround, ILoyaltyConfig, PhotoPlacement, StampStyle } from "@/models/Business";

export interface WalletConfig {
  mechanic: "sellos" | "cashback";
  sellos: { required: number; rewardDescription: string; unitSingular: string; unitPlural: string };
  cashback: { rate: number; threshold: number };
  card: {
    ground: CardGround;
    stampStyle: StampStyle;
    stampIcon: string;
    fields: CardFieldConfig;
    photoPlacement: PhotoPlacement;
    customIconUrl?: string;
    stripImage?: string;
  };
  notifications: { stamp: string; rewardReady: string; cashback: string };
  location?: { latitude?: number; longitude?: number; relevantText?: string; maxDistance?: number };
}

interface Props {
  initial: WalletConfig;
  businessName: string;
  primaryColor: string;
  logo?: string;
}

/** Colour and logo live here rather than on the general settings page: they
 *  drive the card, and the owner needs to see the preview react as they change
 *  them. Both still save through PATCH /api/settings. */

const CATEGORIES = Object.keys(CATEGORY_LABELS) as StampCategory[];

/** 0 = leave it to iOS, which uses roughly 100m. */
const RADIUS_OPTIONS = [
  { label: "En la puerta (30 m)", metres: 30 },
  { label: "Media cuadra (75 m)", metres: 75 },
  { label: "La cuadra (150 m)", metres: 150 },
  { label: "Automático", metres: 0 },
];

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

export default function WalletForm({ initial, businessName, primaryColor, logo }: Props) {
  const [cfg, setCfg] = useState<WalletConfig>(initial);
  const [brand, setBrand] = useState({ primaryColor, logo });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StampCategory | "todos">("todos");
  const [previewRaw, setPreview] = useState(3);
  const [uploading, setUploading] = useState(false);
  const [localStorageWarning, setLocalWarning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  /** What went wrong setting the pin. Both paths used to fail in silence. */
  const [pinError, setPinError] = useState("");
  const [pasted, setPasted] = useState("");
  const [platform, setPlatform] = useState<Platform>("apple");
  const router = useRouter();

  const isCashback = cfg.mechanic === "cashback";
  const unitOne = cfg.sellos.unitSingular || "un sello";

  const icons = useMemo(() => {
    const base = query ? searchStampIcons(query) : STAMP_ICONS;
    return category === "todos" ? base : base.filter((i) => i.category === category);
  }, [query, category]);

  // Derived, not synced: lowering `required` clamps the slider on the next
  // render instead of scheduling a second one.
  const preview = Math.min(previewRaw, cfg.sellos.required);

  // Mirrors what lib/apple-pass.ts fills in per customer, so the preview is the
  // real sentence rather than an impression of it.
  const relevantSample = isCashback
    ? `$${(cfg.cashback.threshold + 28.5).toLocaleString("es-MX")}`
    : `${Math.max(1, preview)} de ${cfg.sellos.required}`;
  const relevantFallback = isCashback
    ? "Tienes {progreso} de saldo"
    : `Llevas {progreso} ${cfg.sellos.unitPlural}`;

  // The preview panels run the real lib/card-layout.ts, which wants a full
  // config — the form only holds the parts an owner edits.
  const previewConfig = useMemo(
    () => ({ ...cfg, cashback: { ...cfg.cashback } }) as unknown as ILoyaltyConfig,
    [cfg]
  );

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams({
      mechanic: cfg.mechanic,
      required: String(cfg.sellos.required),
      reward: cfg.sellos.rewardDescription,
      unitPlural: cfg.sellos.unitPlural,
      icon: cfg.card.stampIcon,
      ground: cfg.card.ground,
      stampStyle: cfg.card.stampStyle,
      rate: String(cfg.cashback.rate),
      color: brand.primaryColor.replace("#", ""),
      stamps: String(preview),
      balance: String(cfg.cashback.threshold + 28.5),
      threshold: String(cfg.cashback.threshold),
    });
    if (cfg.card.stripImage) p.set("bg", cfg.card.stripImage);
    p.set("placement", cfg.card.photoPlacement);
    if (cfg.card.customIconUrl) p.set("customIcon", cfg.card.customIconUrl);
    return `/api/passes/preview?${p.toString()}`;
  }, [cfg, brand.primaryColor, preview]);

  // Each URL is a fresh server-side render, so dragging the stamp slider used
  // to queue one per step and land the last of them seconds later. Settle
  // first, then render once.
  const previewSrc = useDebounced(previewUrl, 250);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { loyalty: cfg },
          branding: { primaryColor: brand.primaryColor, logo: brand.logo },
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File, field: "customIconUrl" | "stripImage" | "logo") {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "No se pudo subir la imagen");
        return;
      }
      if (res.ok) {
        if (field === "logo") setBrand({ ...brand, logo: data.url });
        else setCfg({ ...cfg, card: { ...cfg.card, [field]: data.url } });
        // A local URL can't be reached by Apple or Google — fine for designing,
        // useless on a real pass. Say so rather than let it fail silently later.
        setLocalWarning(data.storage === "local");
      }
    } finally {
      setUploading(false);
    }
  }

  /**
   * ⚠️ This pins the card to WHERE THE BROWSER IS RIGHT NOW, which is only the
   * business if the owner happens to be standing in it — and admin gets done at
   * home. It stays because it is the fastest path when they ARE on site, but it
   * is no longer the only one, and the copy says what it does.
   */
  function useMyLocation() {
    setPinError("");
    if (!navigator.geolocation) {
      setPinError("Este navegador no puede darnos tu ubicación. Pega la liga de Google Maps.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCfg({
          ...cfg,
          location: {
            ...cfg.location,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        });
        setLocating(false);
      },
      // Every one of these used to look identical to the button doing nothing.
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPinError(
            "El navegador bloqueó la ubicación. Permítela en la barra de direcciones, o pega la liga de Google Maps."
          );
        } else if (err.code === err.TIMEOUT) {
          setPinError("Tardó demasiado. Vuelve a intentar o pega la liga de Google Maps.");
        } else {
          setPinError("No pudimos obtener tu ubicación. Pega la liga de Google Maps.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const PIN_ERRORS: Record<PinFailure, string> = {
    SHORT_LINK:
      "Esa liga es corta (goo.gl) y no podemos abrirla desde aquí. Ábrela en el navegador y copia la liga larga que aparece arriba.",
    NO_COORDS:
      "No encontramos coordenadas ahí. Busca tu negocio en Google Maps, copia la liga de la barra de direcciones y pégala completa.",
    OUT_OF_RANGE: "Esas coordenadas no corresponden a un lugar real. Revisa la liga.",
  };

  /** Set the pin from a pasted Maps link or a bare "lat, lng" pair. */
  function applyPasted() {
    const result = parsePin(pasted);
    if (!result.ok) {
      setPinError(PIN_ERRORS[result.reason]);
      return;
    }
    setPinError("");
    setPasted("");
    setCfg({
      ...cfg,
      location: {
        ...cfg.location,
        latitude: result.pin.latitude,
        longitude: result.pin.longitude,
      },
    });
  }

  /** Remove the geofence entirely. Without this a wrong pin ships forever:
   *  passLocations() only bails when latitude is null. */
  function clearLocation() {
    setPinError("");
    setPasted("");
    setCfg({ ...cfg, location: undefined });
  }

  const input = inputCls;

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
      <div className="space-y-8 min-w-0">
        {/* ── Brand ── */}
        <Section title="Marca" desc="El color y el logo de la tarjeta.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Color principal">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer bg-white p-1"
                />
                <input
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  placeholder="#10b981"
                  className={`${input} font-mono`}
                />
              </div>
            </Field>
            <Field label="Logo" hint="PNG con fondo transparente se ve mejor.">
              <div className="flex items-center gap-2">
                {brand.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo}
                    alt=""
                    className="h-10 w-14 object-contain rounded-lg border border-gray-200 bg-white p-1"
                  />
                )}
                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer transition-colors">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {brand.logo ? "Cambiar" : "Subir logo"}
                  <input
                    type="file" accept={acceptAttr(LOGO_TYPES)} className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logo")}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {uploadHint(LOGO_TYPES)} · SVG o PNG se ven mejor
              </p>
            </Field>
          </div>
        </Section>

        {/* ── Mechanic ── */}
        <Section title="Mecánica" desc="Sólo una está activa a la vez.">
          <div className="grid grid-cols-2 gap-3">
            {(["sellos", "cashback"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setCfg({ ...cfg, mechanic: m, card: { ...cfg.card, fields: fieldsForNewMechanic(cfg, m) } })}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                  cfg.mechanic === m
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {m === "sellos" ? <Stamp size={18} /> : <Wallet size={18} />}
                <span className="text-sm font-bold text-gray-900">
                  {m === "sellos" ? "Sellos" : "Cashback"}
                </span>
                <span className="text-xs text-gray-500">
                  {m === "sellos"
                    ? "Junta sellos, gana un premio"
                    : "Devuelve un % en saldo"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Al cambiar de mecánica, el progreso existente se congela pero sigue siendo
            canjeable. Nadie pierde lo que ya juntó.
          </p>
        </Section>

        {/* ── Rules ── */}
        {isCashback ? (
          <Section title="Reglas del cashback" desc="Qué se acumula y cuándo se puede usar.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="% de devolución">
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={cfg.cashback.rate}
                  onChange={(e) =>
                    setCfg({ ...cfg, cashback: { ...cfg.cashback, rate: parseFloat(e.target.value) || 0 } })
                  }
                  className={input}
                />
              </Field>
              <Field label="Mínimo para usar el saldo" hint="El saldo se acumula hasta llegar aquí.">
                <input
                  type="number" min={0} step={10}
                  value={cfg.cashback.threshold}
                  onChange={(e) =>
                    setCfg({ ...cfg, cashback: { ...cfg.cashback, threshold: parseFloat(e.target.value) || 0 } })
                  }
                  className={input}
                />
              </Field>
            </div>
          </Section>
        ) : (
          <Section title="Reglas de los sellos" desc="Cuántos sellos y qué se llevan.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Unidad (singular)" hint='Ej. "visita", "compra", "sello"'>
                <input
                  value={cfg.sellos.unitSingular}
                  onChange={(e) => setCfg({ ...cfg, sellos: { ...cfg.sellos, unitSingular: e.target.value } })}
                  className={input}
                />
              </Field>
              <Field label="Unidad (plural)">
                <input
                  value={cfg.sellos.unitPlural}
                  onChange={(e) => setCfg({ ...cfg, sellos: { ...cfg.sellos, unitPlural: e.target.value } })}
                  className={input}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sellos para el premio">
                <input
                  type="number" min={1} max={30}
                  value={cfg.sellos.required}
                  onChange={(e) =>
                    setCfg({ ...cfg, sellos: { ...cfg.sellos, required: parseInt(e.target.value) || 10 } })
                  }
                  className={input}
                />
              </Field>
              <Field label="Premio">
                <input
                  value={cfg.sellos.rewardDescription}
                  onChange={(e) =>
                    setCfg({ ...cfg, sellos: { ...cfg.sellos, rewardDescription: e.target.value } })
                  }
                  placeholder="Un café gratis"
                  className={input}
                />
              </Field>
            </div>
          </Section>
        )}

        {/* ── Card style ── */}
        <Section
          title="Estilo de la tarjeta"
          desc="El fondo y la forma de los sellos. Cada combinación se dibuja arriba, tal cual."
        >
          <Field label="Fondo">
            <div className="grid grid-cols-3 gap-3">
              {GROUNDS.map(({ id, label, hint }) => (
                <button
                  key={id}
                  onClick={() => setCfg({ ...cfg, card: { ...cfg.card, ground: id } })}
                  className={`rounded-xl border-2 p-2 text-left transition-all ${
                    cfg.card.ground === id
                      ? "border-emerald-500 ring-2 ring-emerald-500/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <StampSample
                    ground={id}
                    stampStyle={cfg.card.stampStyle}
                    brandColor={brand.primaryColor}
                    iconId={cfg.card.stampIcon}
                  />
                  <p className="mt-1.5 text-xs font-bold text-gray-900">{label}</p>
                  <p className="text-[0.68rem] leading-tight text-gray-500">{hint}</p>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Forma del sello">
            <div className="grid grid-cols-3 gap-3">
              {STAMP_STYLES.map(({ id, label, hint }) => (
                <button
                  key={id}
                  onClick={() => setCfg({ ...cfg, card: { ...cfg.card, stampStyle: id } })}
                  className={`rounded-xl border-2 p-2 text-left transition-all ${
                    cfg.card.stampStyle === id
                      ? "border-emerald-500 ring-2 ring-emerald-500/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <StampSample
                    ground={cfg.card.ground}
                    stampStyle={id}
                    brandColor={brand.primaryColor}
                    iconId={cfg.card.stampIcon}
                  />
                  <p className="mt-1.5 text-xs font-bold text-gray-900">{label}</p>
                  <p className="text-[0.68rem] leading-tight text-gray-500">{hint}</p>
                </button>
              ))}
            </div>
          </Field>

          {cfg.card.stripImage && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Tienes una foto de fondo, así que manda ella: los sellos se tiñen para
              contrastar con la imagen y el fondo de arriba no se usa.
            </p>
          )}
        </Section>

        {/* ── Field slots ── */}
        <Section
          title="Qué dice la tarjeta"
          desc="Apple y Google usan plantillas fijas. Estos son los espacios que sí podemos controlar."
        >
          <SlotPicker
            slot="header"
            title="Encabezado"
            hint="Junto al logo. Es LO ÚNICO que se ve cuando la tarjeta está apilada detrás de otra en Wallet."
            cfg={cfg}
            setCfg={setCfg}
          />
          <SlotPicker
            slot="secondary"
            title="Fila principal"
            hint="Debajo de los sellos. Dos columnas."
            cfg={cfg}
            setCfg={setCfg}
          />
          <SlotPicker
            slot="auxiliary"
            title="Fila secundaria"
            hint="Opcional. Se omite si la dejas vacía."
            cfg={cfg}
            setCfg={setCfg}
          />

          <p className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
            El progreso siempre viaja en la tarjeta: es el único campo que hace
            que Apple mande la notificación al sellar. Si lo quitas de todos los
            espacios, vuelve al encabezado.
            <br />
            <span className="text-gray-400">
              Lo que ninguna plataforma deja controlar: el tamaño y la posición de
              la imagen, el orden de las filas, y la tipografía. El resto está aquí.
            </span>
          </p>
        </Section>

        {/* ── Icon catalogue ── */}
        {!isCashback && (
          <Section title="Ícono del sello" desc={`${STAMP_ICONS.length} íconos. Busca por giro o por nombre.`}>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="café, taco, uñas, gimnasio…"
                className={`${input} pl-10`}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["todos", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c as StampCategory | "todos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    category === c
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c === "todos" ? "Todos" : CATEGORY_LABELS[c as StampCategory]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-64 overflow-y-auto p-1">
              {icons.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      card: { ...cfg.card, stampIcon: icon.id, customIconUrl: undefined },
                    })
                  }
                  title={icon.label}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${
                    cfg.card.stampIcon === icon.id && !cfg.card.customIconUrl
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                       stroke={
                         cfg.card.stampIcon === icon.id && !cfg.card.customIconUrl
                           ? brand.primaryColor
                           : "#6b7280"
                       }
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon.d} />
                  </svg>
                </button>
              ))}
              {icons.length === 0 && (
                <p className="col-span-full text-xs text-gray-400 py-6 text-center">
                  Sin resultados para “{query}”.
                </p>
              )}
            </div>

            {/* ⚠️ An uploaded icon OVERRIDES the gallery in strip-render.ts, so it
                has to be visible and removable here. It was neither: once
                uploaded there was no control to clear it, and picking a gallery
                icon quietly did nothing to the card. */}
            {cfg.card.customIconUrl && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cfg.card.customIconUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg border border-emerald-200 bg-white object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-800">Estás usando tu propio ícono</p>
                  <p className="text-xs text-emerald-700">
                    Sustituye al del catálogo. Quítalo para volver a elegir uno de arriba.
                  </p>
                </div>
                <button
                  onClick={() => setCfg({ ...cfg, card: { ...cfg.card, customIconUrl: undefined } })}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                  Quitar
                </button>
              </div>
            )}

            <div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-900">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {cfg.card.customIconUrl ? "Cambiar mi ícono" : "Subir mi propio ícono"}
                <input
                  type="file" accept={acceptAttr(ICON_TYPES)} className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "customIconUrl")}
                />
              </label>
              {/* The transparency rule is the one an owner cannot guess and
                  cannot see until the card ships: the icon is drawn straight
                  onto the ground colour, so anything with a background arrives
                  as a white box around the mark. */}
              <p className="mt-1.5 text-xs text-gray-400">
                {uploadHint(ICON_TYPES)} · <strong className="font-semibold text-gray-500">con fondo transparente</strong>, o saldrá un cuadro blanco alrededor
              </p>
            </div>
          </Section>
        )}

        {uploadError && (
          <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800">
            {uploadError}
          </p>
        )}

        {localStorageWarning && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            Imagen guardada localmente. Sirve para diseñar, pero Apple y Google no
            pueden descargarla: configura <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> antes
            de emitir tarjetas reales.
          </p>
        )}

        {/* ── Card art ── */}
        <Section title="Foto de tu local" desc="Dónde aparece la depende de dónde la pongas.">
          <div className="flex items-center gap-3">
            {cfg.card.stripImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cfg.card.stripImage}
                alt=""
                className="h-16 w-24 shrink-0 rounded-xl border border-gray-200 object-cover"
              />
            )}
            <label className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm font-semibold text-gray-500 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer transition-colors">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {cfg.card.stripImage ? "Cambiar foto" : "Subir foto"}
              <input
                // ⚠️ Not `image/*`: that offers every HEIC on the machine — and
                // every photo an iPhone takes is HEIC — which the server then
                // refuses, for a reason the owner could not have predicted.
                type="file" accept={acceptAttr(PHOTO_TYPES)} className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "stripImage")}
              />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            {uploadHint(PHOTO_TYPES)} · la recortamos y reducimos sola
          </p>

          {cfg.card.stripImage && (
            <>
              <Field label="Dónde va la foto">
                <div className="grid grid-cols-3 gap-3">
                  {PLACEMENTS.map(({ id, label, hint }) => (
                    <button
                      key={id}
                      onClick={() => setCfg({ ...cfg, card: { ...cfg.card, photoPlacement: id } })}
                      className={`rounded-xl border-2 p-2 text-left transition-all ${
                        cfg.card.photoPlacement === id
                          ? "border-emerald-500 ring-2 ring-emerald-500/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <PlacementSketch placement={id} photo={cfg.card.stripImage!} />
                      <p className="mt-1.5 text-xs font-bold text-gray-900">{label}</p>
                      <p className="text-[0.68rem] leading-tight text-gray-500">{hint}</p>
                    </button>
                  ))}
                </div>
              </Field>

              {cfg.card.photoPlacement === "footer" && (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                  <strong>Apple no puede mostrarla así.</strong> Una tarjeta de
                  Apple Wallet tiene un solo espacio para imagen y los sellos ya
                  lo ocupan. En iPhone la foto no aparece; en Android y en la
                  página de tu cliente sí, como una banda abajo de la tarjeta.
                  Si la quieres en las dos, usa <strong>Al lado</strong> o{" "}
                  <strong>De fondo</strong>.
                </p>
              )}

              <button
                onClick={() => setCfg({ ...cfg, card: { ...cfg.card, stripImage: undefined } })}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Quitar foto
              </button>
            </>
          )}
        </Section>

        {/* ── What the push says ── */}
        <Section
          title="Mensaje de la notificación"
          desc="Lo que aparece en el teléfono del cliente cuando su tarjeta cambia."
        >
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs leading-snug text-gray-600">
            Escribe <code className="rounded bg-white px-1 py-0.5 font-mono text-[0.7rem] font-semibold text-gray-900">{VALUE_TOKEN}</code>{" "}
            donde quieras que aparezca el dato nuevo — los sellos que lleva, o su saldo.
            Si dejas un mensaje vacío se usa el de siempre:{" "}
            <strong>una tarjeta que se actualiza en silencio parece una tarjeta rota</strong>.
          </p>

          {isCashback ? (
            <MessageField
              label="Cuando cambia su saldo"
              value={cfg.notifications.cashback}
              onChange={(cashback) => setCfg({ ...cfg, notifications: { ...cfg.notifications, cashback } })}
              sample={`$${(cfg.cashback.threshold + 28.5).toLocaleString("es-MX")}`}
              fallback={DEFAULT_LOYALTY.notifications.cashback}
            />
          ) : (
            <>
              <MessageField
                label={`Cuando gana ${unitOne}`}
                value={cfg.notifications.stamp}
                onChange={(stamp) => setCfg({ ...cfg, notifications: { ...cfg.notifications, stamp } })}
                sample={`${Math.max(1, preview)} de ${cfg.sellos.required}`}
                fallback={DEFAULT_LOYALTY.notifications.stamp}
              />
              <MessageField
                label="Cuando ya puede reclamar su premio"
                value={cfg.notifications.rewardReady}
                onChange={(rewardReady) =>
                  setCfg({ ...cfg, notifications: { ...cfg.notifications, rewardReady } })
                }
                sample={cfg.sellos.rewardDescription}
                fallback={DEFAULT_LOYALTY.notifications.rewardReady}
              />
            </>
          )}
        </Section>

        {/* ── Geofence ── */}
        <Section
          title="Notificación por ubicación"
          desc="La tarjeta aparece en la pantalla de bloqueo cuando el cliente pasa cerca."
        >
          {/* Two ways in. The paste box is first because it is the one that
              works from wherever the owner actually is. */}
          <Field
            label="Pega la liga de tu negocio en Google Maps"
            hint="Búscalo en Google Maps, copia la liga de la barra de direcciones y pégala aquí. También sirve 19.4326, -99.1332."
          >
            <div className="flex gap-2">
              <input
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyPasted();
                  }
                }}
                placeholder="https://www.google.com/maps/place/..."
                className={input}
              />
              <button
                onClick={applyPasted}
                disabled={!pasted.trim()}
                className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Usar
              </button>
            </div>
          </Field>

          <div className="flex items-center gap-3">
            <button
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
              Usar mi ubicación actual
            </button>
            <p className="text-xs leading-snug text-gray-500">
              Sólo si estás <strong>en tu negocio</strong> ahora mismo.
            </p>
          </div>

          {pinError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-snug text-amber-800">
              {pinError}
            </p>
          )}

          {cfg.location?.latitude != null && (
            <>
              {/* ⚠️ Coordinates alone tell an owner nothing about whether the pin
                  is on their door or two streets over, and a wrong pin fails in
                  total silence — the card simply never appears. The link is the
                  only way to check. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="font-mono text-xs text-gray-600">
                  {formatPin(cfg.location.latitude, cfg.location.longitude ?? 0)}
                </p>
                <a
                  href={mapsUrl(cfg.location.latitude, cfg.location.longitude ?? 0)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 no-underline hover:text-emerald-700"
                >
                  <ExternalLink size={13} />
                  Verificar en el mapa
                </a>
                <button
                  onClick={clearLocation}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                  Quitar ubicación
                </button>
              </div>

              <Field
                label="Qué dice en la pantalla de bloqueo"
                hint={`Usa ${VALUE_TOKEN} para mostrar su avance. Es una sola línea corta.`}
              >
                <input
                  value={cfg.location.relevantText ?? ""}
                  onChange={(e) =>
                    setCfg({ ...cfg, location: { ...cfg.location, relevantText: e.target.value } })
                  }
                  maxLength={MAX_RELEVANT_TEXT + 20}
                  placeholder={relevantFallback}
                  className={input}
                />
                <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900">
                    <Wallet size={13} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400">
                      Al pasar cerca
                    </p>
                    <p className="text-xs font-medium text-gray-900 break-words">
                      {fillTokens(cfg.location.relevantText ?? "", relevantSample, relevantFallback)}
                    </p>
                  </div>
                </div>
              </Field>

              <Field
                label="A qué distancia aparece"
                hint="Más chico = aparece sólo si están prácticamente en la puerta."
              >
                <div className="flex flex-wrap gap-2">
                  {RADIUS_OPTIONS.map((option) => {
                    const active = (cfg.location?.maxDistance ?? 0) === option.metres;
                    return (
                      <button
                        key={option.label}
                        onClick={() =>
                          setCfg({
                            ...cfg,
                            location: {
                              ...cfg.location,
                              maxDistance: option.metres || undefined,
                            },
                          })
                        }
                        className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all ${
                          active
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs leading-snug text-gray-600">
                <strong>No es una notificación que se pueda descartar.</strong> iOS muestra la
                tarjeta mientras cree que te sirve ahí, y la quita al alejarte — deslizarla no
                apaga nada. Si estás dentro de tu propio local la vas a ver siempre; es normal.
              </p>
            </>
          )}
        </Section>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save size={16} />
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check size={15} /> Guardado
            </span>
          )}
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="lg:sticky lg:top-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Vista previa</p>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {(["apple", "google"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  platform === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p === "apple" ? "Apple" : "Google"}
              </button>
            ))}
          </div>
        </div>

        <PassPreview
          platform={platform}
          config={previewConfig}
          businessName={businessName}
          logo={brand.logo}
          brandColor={brand.primaryColor}
          stripSrc={previewSrc}
          photo={cfg.card.stripImage}
          customerName="Ana Pérez"
          stamps={preview}
          balance={cfg.cashback.threshold + 28.5}
        />

        {!isCashback && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Sellos</span>
              <span className="font-semibold text-gray-900">
                {preview} / {cfg.sellos.required}
              </span>
            </div>
            <input
              type="range" min={0} max={cfg.sellos.required} value={preview}
              onChange={(e) => setPreview(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <button
              onClick={() => setPreview(cfg.sellos.required)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Ver estado “premio listo”
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One slot's contents. Every choice is a field id from the shared catalogue,
 * so what the owner picks here is exactly what lib/card-layout.ts resolves —
 * the picker cannot offer something the pass builders don't understand.
 */
/**
 * Switching mechanic re-points the slots at that mechanic's defaults, but only
 * for an owner who never edited them — a custom layout is theirs to keep, and
 * silently rewriting it would be the more surprising behaviour.
 */
function fieldsForNewMechanic(cfg: WalletConfig, next: "sellos" | "cashback"): CardFieldConfig {
  const current = cfg.card.fields ?? defaultCardFields(cfg.mechanic);
  const untouched =
    JSON.stringify(current) === JSON.stringify(DEFAULT_CARD_FIELDS) ||
    JSON.stringify(current) === JSON.stringify(DEFAULT_CASHBACK_FIELDS);
  return untouched ? defaultCardFields(next) : current;
}

function SlotPicker({
  slot,
  title,
  hint,
  cfg,
  setCfg,
}: {
  slot: SlotId;
  title: string;
  hint: string;
  cfg: WalletConfig;
  setCfg: (c: WalletConfig) => void;
}) {
  const limit = SLOT_LIMITS[slot];
  const fields = cfg.card.fields ?? defaultCardFields(cfg.mechanic);
  const chosen = fields[slot] ?? [];
  const available = fieldsForMechanic(cfg.mechanic);

  const setSlot = (next: CardFieldId[]) =>
    setCfg({ ...cfg, card: { ...cfg.card, fields: { ...fields, [slot]: next } } });

  const toggle = (id: CardFieldId) => {
    if (chosen.includes(id)) return setSlot(chosen.filter((c) => c !== id));
    // At the limit the newest choice pushes out the oldest, so the control
    // never just goes dead under the cursor with no explanation.
    setSlot([...chosen, id].slice(-limit));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
        <p className="text-[0.68rem] font-medium text-gray-400">
          {chosen.length} / {limit}
        </p>
      </div>
      <p className="mt-0.5 mb-2 text-[0.7rem] leading-snug text-gray-400">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {available.map((f) => {
          const on = chosen.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                on
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PLACEMENTS: { id: PhotoPlacement; label: string; hint: string }[] = [
  { id: "background", label: "De fondo", hint: "Detrás de los sellos." },
  { id: "side", label: "Al lado", hint: "Junto a los sellos." },
  { id: "footer", label: "Abajo", hint: "Banda propia. No sale en iPhone." },
];

/** A miniature of where the photo lands, drawn with the owner's own photo. */
/**
 * One notification message, with the phone's own rendering underneath it.
 *
 * The preview matters more than it looks: `{progreso}` is an abstraction, and
 * an owner cannot tell whether "Llevas {progreso}" reads well until they see
 * "Llevas 3 de 10". It also shows the fallback the moment the box is empty, so
 * "blank means silent" never has to be discovered.
 */
function MessageField({
  label,
  value,
  onChange,
  sample,
  fallback,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sample: string;
  fallback: string;
}) {
  const effective = value.trim() || fallback;
  // Same conversion the pass builder does, then Apple's substitution — so this
  // is the sentence the customer gets, not an approximation of it.
  const preview = changeMessageFrom(effective, fallback).replace(/%@/g, sample).replace(/%%/g, "%");
  const over = value.length > MAX_MESSAGE;

  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_MESSAGE + 40}
        placeholder={fallback}
        className={inputCls}
      />
      <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900">
          <Bell size={13} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400">
            Así lo ve tu cliente
          </p>
          <p className="text-xs font-medium text-gray-900 break-words">{preview}</p>
        </div>
      </div>
      {!value.trim() && (
        <p className="mt-1 text-xs text-gray-400">Vacío: se usa el mensaje predeterminado.</p>
      )}
      {over && (
        <p className="mt-1 text-xs font-medium text-amber-600">
          Se va a recortar: una notificación no muestra más de {MAX_MESSAGE} caracteres.
        </p>
      )}
    </Field>
  );
}

/** Value that only changes once the input has been still for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

function PlacementSketch({ placement, photo }: { placement: PhotoPlacement; photo: string }) {
  const img = "absolute object-cover";
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg bg-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        className={
          placement === "background"
            ? `${img} inset-0 h-full w-full`
            : placement === "side"
              ? `${img} inset-y-0 left-0 h-full w-[36%]`
              : `${img} inset-x-0 bottom-0 h-[38%] w-full`
        }
      />
      <div
        className={`absolute bg-white ${
          placement === "background"
            ? "inset-0 opacity-55"
            : placement === "side"
              ? "inset-y-0 right-0 w-[64%]"
              : "inset-x-0 top-0 h-[62%]"
        }`}
      />
      <div
        className={`absolute flex items-center gap-[3px] ${
          placement === "side"
            ? "inset-y-0 right-0 w-[64%] justify-center"
            : placement === "footer"
              ? "inset-x-0 top-0 h-[62%] justify-center"
              : "inset-0 justify-center"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-gray-500" />
        ))}
      </div>
    </div>
  );
}

const GROUNDS: { id: CardGround; label: string; hint: string }[] = [
  { id: "light", label: "Claro", hint: "Tarjeta blanca, sellos de color." },
  { id: "brand", label: "Marca", hint: "Todo en tu color." },
  { id: "dark", label: "Oscuro", hint: "Fondo profundo de tu tono." },
];

const STAMP_STYLES: { id: StampStyle; label: string; hint: string }[] = [
  { id: "filled", label: "Relleno", hint: "Se lee desde lejos." },
  { id: "outline", label: "Contorno", hint: "Más ligero, con aro." },
  { id: "plain", label: "Simple", hint: "Sólo el ícono." },
];

/**
 * A two-stamp miniature — one ganado, one pendiente — drawn from the same
 * colour module the server renders with, so the chip an owner clicks is the
 * treatment they get rather than an illustration of it.
 */
function StampSample({
  ground,
  stampStyle,
  brandColor,
  iconId,
}: {
  ground: CardGround;
  stampStyle: StampStyle;
  brandColor: string;
  iconId: string;
}) {
  const bg = groundFor(ground, brandColor);
  const ink = readableInk(brandColor, bg);
  const d = findStampIcon(iconId).d;

  const stamp = (cx: number, earned: boolean) => {
    const r = 12;
    const size = stampStyle === "plain" ? 19 : r * 1.15;
    const t = `translate(${cx - size / 2} ${18 - size / 2}) scale(${size / 24})`;
    const glyph = (stroke: string, opacity = 1) => (
      <g transform={t} opacity={opacity}>
        <path d={d} fill="none" stroke={stroke} strokeWidth={STAMP_STROKE}
              strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
    if (stampStyle === "filled") {
      return (
        <g key={cx}>
          <circle cx={cx} cy={18} r={r} fill={ink} opacity={earned ? 1 : 0.12} />
          {earned ? glyph(bg) : glyph(ink, 0.38)}
        </g>
      );
    }
    if (stampStyle === "outline") {
      return (
        <g key={cx}>
          <circle cx={cx} cy={18} r={r} fill="none" stroke={ink} strokeWidth={1.7}
                  opacity={earned ? 0.85 : 0.28} />
          {glyph(ink, earned ? 1 : 0.32)}
        </g>
      );
    }
    return <g key={cx}>{glyph(ink, earned ? 1 : 0.34)}</g>;
  };

  return (
    <svg viewBox="0 0 78 36" className="w-full rounded-lg" role="presentation">
      <rect width="78" height="36" fill={bg} />
      {stamp(24, true)}
      {stamp(54, false)}
    </svg>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
