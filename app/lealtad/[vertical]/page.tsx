import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, QrCode, Palette, Wallet, Repeat } from "lucide-react";
import { VERTICALS, getVertical, type Vertical } from "@/lib/verticals";
import VerticalSampleCard from "@/components/loyalty/VerticalSampleCard";
import PricingSection from "@/components/landing/PricingSection";
import SiteNav from "@/components/landing/SiteNav";
import SiteFooter from "@/components/landing/SiteFooter";

/** Built at deploy time — these pages exist to be crawled, so none of them
 *  should wait on a render. */
export function generateStaticParams() {
  return VERTICALS.map((v) => ({ vertical: v.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}): Promise<Metadata> {
  const { vertical } = await params;
  const v = getVertical(vertical);
  if (!v) return {};

  const url = `/lealtad/${v.slug}`;
  return {
    title: v.title,
    description: v.metaDescription,
    // Twelve pages about one product are exactly the shape a crawler mistakes
    // for duplicates, so each one states its own canonical.
    alternates: { canonical: url },
    openGraph: {
      title: v.title,
      description: v.metaDescription,
      url,
      type: "website",
      locale: "es_MX",
    },
  };
}

/**
 * Statically generated. Reading the session here would opt the whole page into
 * per-request rendering — and these pages exist to be crawled and served from
 * the edge, so the nav renders in its signed-out state. Someone already logged
 * in who lands on a marketing page still gets working links.
 */
export default async function VerticalPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const v = getVertical(vertical);
  if (!v) notFound();

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <SiteNav isAuthenticated={false} panelHref="/dashboard" />
      <Hero v={v} />
      <Problem v={v} />
      <HowItWorks v={v} />
      <RewardIdeas v={v} />
      <PricingSection />
      <Faq v={v} />
      <Cta v={v} />
      <SiteFooter excludeVertical={v.slug} />
      <FaqSchema v={v} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── hero */

function Hero({ v }: { v: Vertical }) {
  return (
    <section className="border-b border-gray-100 py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Para {v.plural}
          </span>
          <h1 className="mb-4 mt-3 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl">
            {v.title}
          </h1>
          <p className="mb-6 text-xl font-medium text-gray-700">{v.tagline}</p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-emerald-600"
            >
              Crear mi tarjeta gratis <ArrowRight size={15} />
            </Link>
            <Link
              href="/#fidelizacion"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-6 py-3.5 text-sm font-semibold text-gray-700 no-underline transition-colors hover:bg-gray-50"
            >
              Ver cómo funciona
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            14 días gratis · Sin tarjeta de crédito · Sin apps que instalar
          </p>
        </div>

        <div className="mx-auto w-full max-w-[340px]">
          <VerticalSampleCard v={v} />
          <p className="mt-3 text-center text-xs text-gray-400">
            Así ve su tarjeta tu cliente
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── problem */

function Problem({ v }: { v: Vertical }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[720px] px-6">
        {v.problem.map((p, i) => (
          <p
            key={i}
            className={
              i === 0
                ? "mb-5 text-xl font-semibold leading-relaxed tracking-tight text-gray-900"
                : "mb-5 text-base leading-relaxed text-gray-600"
            }
          >
            {p}
          </p>
        ))}

        <blockquote className="mt-10 border-l-4 border-emerald-400 pl-6">
          <p className="text-lg font-semibold leading-snug tracking-tight text-gray-900">
            “{v.pullQuote}”
          </p>
        </blockquote>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── how it works */

function HowItWorks({ v }: { v: Vertical }) {
  const isCashback = v.mechanic === "cashback";
  const steps = [
    {
      icon: Palette,
      title: "Diseña tu tarjeta",
      body: `Tus colores, tu logo y hasta una foto de ${v.yours}. Eliges ${
        isCashback
          ? "qué porcentaje devuelves"
          : `cuántos ${v.unit.many} pide el premio y qué se llevan`
      }. Sin diseñador y sin esperar a nadie.`,
    },
    {
      icon: QrCode,
      title: `${v.customer.one === "clienta" ? "Tu clienta" : `Tu ${v.customer.one}`} escanea el QR`,
      body: "Un código impreso en el mostrador. Lo escanea con la cámara, deja su teléfono y la tarjeta se guarda en su wallet. No descarga ninguna app.",
    },
    {
      icon: Wallet,
      title: isCashback ? "Devuelves un % al cobrar" : `Sellas al cobrar`,
      body: isCashback
        ? "Si cobras con el punto de venta de RestKit, el saldo se suma solo. Si usas otra caja, se escanea la tarjeta desde cualquier celular."
        : `Si cobras con el punto de venta de RestKit, el sello se pone solo. Si usas otra caja, se escanea la tarjeta desde cualquier celular.`,
    },
    {
      icon: Repeat,
      title: isCashback ? "Vuelve a gastar su saldo contigo" : "Vuelve por su premio",
      body: isCashback
        ? `Ese saldo sólo se usa en ${v.yours}. Es una razón concreta para volver, no un descuento que regalaste.`
        : `${v.customer.many.charAt(0).toUpperCase() + v.customer.many.slice(1)} con la tarjeta a medio llenar vuelven más: falta poco y se ve.`,
    },
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50 py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Cómo funciona
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            De cero a premiar {v.customer.many} en una tarde
          </h2>
        </div>

        <ol className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <s.icon size={18} />
                </span>
                <span className="font-mono text-xs font-bold text-gray-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-gray-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────── reward ideas */

function RewardIdeas({ v }: { v: Vertical }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[820px] px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
          Ideas de recompensa para {v.yours}
        </h2>
        <p className="mb-8 mt-2 text-base text-gray-500">
          Tú eliges el premio. Estas son las que mejor funcionan en {v.plural}.
        </p>
        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {v.rewardIdeas.map((idea) => (
            <li
              key={idea}
              className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
            >
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              <span className="text-sm font-medium text-gray-700">{idea}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────── faq */

/** Shared across every vertical; the per-vertical ones come first. */
function commonFaq(v: Vertical) {
  return [
    {
      q: `¿${v.customer.many.charAt(0).toUpperCase() + v.customer.many.slice(1)} necesitan descargar una app?`,
      a: "No. La tarjeta se guarda en Apple Wallet o Google Wallet, que ya vienen en el teléfono. Escanean tu código y quedan inscritos.",
    },
    {
      q: "¿Necesito comprar alguna terminal o lector?",
      a: "No. Se registra desde el punto de venta de RestKit, o escaneando la tarjeta con la cámara de cualquier celular o tablet que ya tengas.",
    },
    {
      q: "¿Cuánto tarda en estar listo?",
      a: `Una tarde. Diseñas la tarjeta con los colores de ${v.yours}, defines el premio, imprimes el código para el mostrador y empiezas el mismo día.`,
    },
  ];
}

function Faq({ v }: { v: Vertical }) {
  const items = [...v.faq, ...commonFaq(v)];
  return (
    <section className="border-t border-gray-100 bg-gray-50 py-20">
      <div className="mx-auto max-w-[720px] px-6">
        <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-gray-900">
          Preguntas frecuentes
        </h2>
        <div className="space-y-3">
          {items.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-gray-200 bg-white p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer list-none text-sm font-bold text-gray-900">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Structured data, so the questions can surface as rich results. Built from
 *  the same array the page renders — they cannot disagree. */
function FaqSchema({ v }: { v: Vertical }) {
  const items = [...v.faq, ...commonFaq(v)];
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────── cta */

function Cta({ v }: { v: Vertical }) {
  return (
    <section className="border-t border-gray-100 py-20">
      <div className="mx-auto flex max-w-[720px] flex-col items-center px-6 text-center">
        <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Empieza a premiar a tus {v.customer.many} hoy
        </h2>
        <p className="mb-7 max-w-[520px] text-base text-gray-500">
          Diseña tu tarjeta, define tu premio e imprime tu código. 14 días gratis,
          sin tarjeta de crédito.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-7 py-4 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-emerald-600"
        >
          Crear mi tarjeta gratis <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
