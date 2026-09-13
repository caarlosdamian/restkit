"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, X, Check, Lock, Play, Bell, Plus } from "lucide-react";
import LoyaltyCard from "@/components/loyalty/LoyaltyCard";
import { DEMO_BUSINESSES, demoBusiness, demoConfig, type DemoBusiness } from "@/lib/card-demo";
import { fillTokens, VALUE_TOKEN } from "@/lib/card-layout";
import { stampState, formatMXN } from "@/lib/loyalty";
import type { LoyaltyMechanic } from "@/models/Business";

/**
 * "Arma tu tarjeta" — the landing page's demo.
 *
 * Four steps and a finished card. Every value is fixed (see lib/card-demo.ts):
 * the two choices that ARE offered — which business, and stamps versus
 * cashback — are the two that change what a card fundamentally is. Everything
 * else is shown locked, because a builder that lets a stranger type their
 * restaurant's name before signing up collects nothing and teaches nothing,
 * while a walkthrough that shows the real card in five clicks does.
 *
 * ⚠️ The last step is the REAL `LoyaltyCard`, from a real `loyaltyConfig()` —
 * the same component `/c/[token]` serves to an actual customer. A mockup here
 * would drift from the product the first time either changed, and the whole
 * argument of this section is "this is the thing you get".
 */

const STEPS = ["Tu negocio", "Cómo suma", "Los datos", "El aviso", "Tu tarjeta"] as const;

export default function CardDemo() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [businessId, setBusinessId] = useState(DEMO_BUSINESSES[0].id);
  const [mechanic, setMechanic] = useState<LoyaltyMechanic>(DEMO_BUSINESSES[0].mechanic);
  const dialog = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const demo = demoBusiness(businessId);
  const config = demoConfig(demo, mechanic);
  const isCashback = mechanic === "cashback";

  const close = useCallback(() => {
    setOpen(false);
    // Put the reader back where they were, not at the top of the document.
    lastFocused.current?.focus();
  }, []);

  function start() {
    lastFocused.current = document.activeElement as HTMLElement;
    setStep(0);
    setBusinessId(DEMO_BUSINESSES[0].id);
    setMechanic(DEMO_BUSINESSES[0].mechanic);
    setOpen(true);
  }

  /** Choosing a business also adopts its natural mechanic — a taquería leads
   *  with cashback and a café with stamps, which is the point of having two. */
  function chooseBusiness(d: DemoBusiness) {
    setBusinessId(d.id);
    setMechanic(d.mechanic);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // A modal that leaves the page scrolling behind it reads as broken on a phone.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  const progress = isCashback
    ? formatMXN(demo.cashbackBalance)
    : `${stampState(demo.currentVisits, demo.required).stamps} de ${demo.required}`;

  return (
    <>
      <button
        onClick={start}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-700 transition-all hover:border-emerald-500 hover:bg-emerald-50"
      >
        <Play size={15} />
        Ver cómo se arma
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            ref={dialog}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Demo: arma tu tarjeta de lealtad"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl"
          >
            {/* Header + progress */}
            <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Demo · paso {step + 1} de {STEPS.length}
                </p>
                <h2 className="truncate text-lg font-extrabold tracking-tight text-gray-900">
                  {STEPS[step]}
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Cerrar el demo"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-1 px-6 pt-4">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-emerald-500" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {step === 0 && <StepBusiness chosen={demo} onChoose={chooseBusiness} />}
              {step === 1 && <StepMechanic demo={demo} mechanic={mechanic} onPick={setMechanic} />}
              {step === 2 && <StepData demo={demo} isCashback={isCashback} />}
              {step === 3 && <StepNotice demo={demo} isCashback={isCashback} progress={progress} />}
              {step === 4 && (
                <StepCard demo={demo} config={config} isCashback={isCashback} />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-gray-100 px-6 py-4">
              {step > 0 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
                >
                  <ArrowLeft size={15} />
                  Atrás
                </button>
              ) : (
                <span />
              )}
              <div className="flex-1" />
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Siguiente
                  <ArrowRight size={15} />
                </button>
              ) : (
                <Link
                  href="/registro"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-emerald-600"
                >
                  Comenzar ahora
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────────── 1 · the business */

function StepBusiness({
  chosen,
  onChoose,
}: {
  chosen: DemoBusiness;
  onChoose: (d: DemoBusiness) => void;
}) {
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        Elige un negocio de ejemplo. Los dos usan el mismo producto — lo que cambia es cómo
        premian.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {DEMO_BUSINESSES.map((d) => {
          const active = d.id === chosen.id;
          return (
            <button
              key={d.id}
              onClick={() => onChoose(d)}
              className={`rounded-2xl border-2 p-4 text-left transition-all ${
                active
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold text-white"
                  style={{ backgroundColor: d.accent }}
                >
                  {d.name.charAt(0)}
                </span>
                {active && <Check size={16} className="text-emerald-600" />}
              </div>
              <p className="text-sm font-bold text-gray-900">{d.name}</p>
              <p className="text-xs text-gray-400">{d.trade}</p>
            </button>
          );
        })}

        {/* The empty slot: what the reader is actually here to fill, and the
            one thing the demo deliberately will not do for them. */}
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-4 text-center">
          <Plus size={18} className="mb-2 text-gray-300" />
          <p className="text-sm font-bold text-gray-400">El tuyo</p>
          <p className="text-xs text-gray-400">Al crear tu cuenta</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── 2 · the mechanic */

function StepMechanic({
  demo,
  mechanic,
  onPick,
}: {
  demo: DemoBusiness;
  mechanic: LoyaltyMechanic;
  onPick: (m: LoyaltyMechanic) => void;
}) {
  const options: Array<{ id: LoyaltyMechanic; title: string; desc: string; figure: string }> = [
    {
      id: "sellos",
      title: "Sellos",
      desc: `Junta ${demo.required} y se lleva: ${demo.reward.toLowerCase()}. Funciona cuando el ticket es parecido siempre.`,
      figure: `${demo.required} → premio`,
    },
    {
      id: "cashback",
      title: "Cashback",
      desc: `Le devuelves ${demo.rate}% de cada cuenta como saldo, y ese saldo sólo se gasta contigo. Mejor cuando el ticket varía.`,
      figure: `${demo.rate}% de vuelta`,
    },
  ];

  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        Un programa, dos formas de premiar. Eliges una — la misma tarjeta se adapta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = o.id === mechanic;
          return (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className={`rounded-2xl border-2 p-5 text-left transition-all ${
                active
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-extrabold text-gray-900">{o.title}</p>
                {active && <Check size={16} className="text-emerald-600" />}
              </div>
              <p
                className="mb-2 text-xl font-extrabold tracking-tight"
                style={{ color: active ? demo.accent : "#9ca3af" }}
              >
                {o.figure}
              </p>
              <p className="text-xs leading-relaxed text-gray-500">{o.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────── 3 · the settings, locked */

function StepData({ demo, isCashback }: { demo: DemoBusiness; isCashback: boolean }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: "Logo",
      value: (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold text-white"
          style={{ backgroundColor: demo.accent }}
        >
          {demo.name.charAt(0)}
        </span>
      ),
    },
    { label: "Nombre del negocio", value: demo.name },
    isCashback
      ? { label: "Porcentaje de vuelta", value: `${demo.rate}%` }
      : { label: "Sellos para el premio", value: `${demo.required}` },
    { label: "Premio", value: demo.reward },
    {
      label: "Color de la marca",
      value: (
        <span className="flex items-center gap-2">
          <span
            className="h-5 w-5 rounded-md border border-black/10"
            style={{ backgroundColor: demo.accent }}
          />
          <span className="font-mono text-xs text-gray-500">{demo.accent}</span>
        </span>
      ),
    },
  ];

  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        Esto es todo lo que se configura. En tu cuenta lo llenas tú; aquí está fijo.
      </p>
      <div className="overflow-hidden rounded-2xl border border-gray-200">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between gap-4 bg-gray-50/60 px-4 py-3 ${
              i > 0 ? "border-t border-gray-100" : ""
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {r.label}
            </span>
            <span className="text-sm font-semibold text-gray-900">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400">
        <Lock size={12} />
        En el demo no se edita
      </p>
    </div>
  );
}

/* ───────────────────────────────── 4 · the push */

function StepNotice({
  demo,
  isCashback,
  progress,
}: {
  demo: DemoBusiness;
  isCashback: boolean;
  progress: string;
}) {
  // The real default templates, filled by the real token substitution — the
  // same path `lib/card-layout.ts` takes to build a pass's changeMessage.
  const template = isCashback ? "Tu saldo ahora es {progreso}." : "Registro actualizado: {progreso}";
  const filled = fillTokens(template, progress, progress);

  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        Cada vez que suma, su teléfono se lo dice. No hay que abrir ninguna app.
      </p>

      {/* Lock-screen notification, the shape iOS actually draws. */}
      <div className="mx-auto max-w-sm rounded-3xl bg-gray-900 p-5">
        <p className="mb-4 text-center text-[0.65rem] font-semibold uppercase tracking-widest text-white/40">
          Pantalla de bloqueo
        </p>
        <div className="flex items-start gap-3 rounded-2xl bg-white/95 p-3.5 shadow-lg">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: demo.accent }}
          >
            <Bell size={16} className="text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900">{demo.name}</p>
            <p className="text-xs leading-snug text-gray-700">{filled}</p>
          </div>
          <span className="ml-auto shrink-0 text-[0.6rem] text-gray-400">ahora</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Tú escribes el mensaje. <code className="font-mono">{VALUE_TOKEN}</code> se cambia por su
        avance: <strong className="font-semibold text-gray-600">{progress}</strong>.
      </p>
    </div>
  );
}

/* ───────────────────────────────── 5 · the card */

function StepCard({
  demo,
  config,
  isCashback,
}: {
  demo: DemoBusiness;
  config: ReturnType<typeof demoConfig>;
  isCashback: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-5 max-w-md text-center text-sm leading-relaxed text-gray-500">
        Lista. Tu cliente la guarda en Apple Wallet o Google Wallet y se actualiza sola en cada
        visita.
      </p>
      <div className="w-full max-w-[330px]">
        {/* The real component — not a picture of one. */}
        <LoyaltyCard
          businessName={demo.name}
          customerName={demo.holder}
          config={config}
          brandColor={demo.accent}
          currentVisits={demo.currentVisits}
          cashbackBalance={demo.cashbackBalance}
        />
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        {isCashback
          ? `Saldo acumulado por sus visitas, al ${demo.rate}% de cada cuenta.`
          : `Va en ${demo.currentVisits} de ${demo.required} para ${demo.reward.toLowerCase()}.`}
      </p>
    </div>
  );
}
