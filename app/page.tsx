import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import PricingSection from "@/components/landing/PricingSection";
import SiteNav from "@/components/landing/SiteNav";
import SiteFooter from "@/components/landing/SiteFooter";
import LoyaltyCardCarousel from "@/components/landing/LoyaltyCardCarousel";
import CardDemo from "@/components/landing/CardDemo";
import VerticalSampleCard from "@/components/loyalty/VerticalSampleCard";
import { VERTICALS } from "@/lib/verticals";
import {
  BarChart3, QrCode, Bell, ArrowRight,
  ChevronRight, ShoppingCart, Monitor, Package, FileText,
  Gift, Check, Zap, Shield, Globe, Users,
  TrendingUp, Clock, Star, CheckCircle2, Layers,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user?.role as string | undefined;
  // Managers land on the dashboard; staff go straight to the POS terminal.
  const panelHref = role === "OWNER" || role === "ADMIN" ? "/dashboard" : "/pos";

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <SiteNav isAuthenticated={!!session} panelHref={panelHref} />
      <Hero />
      <LoyaltySpotlight />
      <SocialProof />
      <Modules />
      <AnalyticsPreview />
      <MexicoFirst />
      <PricingSection />
      <CtaBanner />
      <SiteFooter />
    </div>
  );
}

/* ─── HERO ─── */
function Hero() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28 border-b border-gray-100">
      {/* subtle grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0fdf4_1px,transparent_1px),linear-gradient(to_bottom,#f0fdf4_1px,transparent_1px)] bg-[size:48px_48px] opacity-60 pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full mb-6">
              <Zap size={12} /> El sistema operativo para restaurantes
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 mb-5">
              Administra tu restaurante{" "}
              <span className="text-emerald-500">desde un solo lugar</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-[500px]">
              POS, cocina, inventario, analíticas y fidelización digital en Apple y Google Wallet — todo integrado, sin complicaciones, hecho para México.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm no-underline">
                Comenzar gratis <ArrowRight size={17} />
              </Link>
              <CardDemo />
            </div>
            <div className="mt-8 flex flex-wrap gap-5">
              {["Sin contrato anual", "Soporte en español", "Datos fiscales en el ticket"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — dashboard mockup */}
          <div className="relative flex justify-center">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const orders = [
    { table: "Mesa 4", items: "Tacos x3, Agua", status: "cooking", time: "8 min" },
    { table: "Mesa 7", items: "Pizza x1, Refresco x2", status: "ready", time: "0 min" },
    { table: "Mesa 1", items: "Hamburguesa x2", status: "new", time: "—" },
  ];
  const statusStyles: Record<string, string> = {
    new: "bg-blue-50 text-blue-600",
    cooking: "bg-amber-50 text-amber-600",
    ready: "bg-emerald-50 text-emerald-600",
  };
  const statusLabels: Record<string, string> = { new: "Nueva", cooking: "Cocinando", ready: "Lista" };

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/60 overflow-hidden bg-white">
      {/* Mock header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M10 16L16 10L22 16L16 22Z" fill="white" /></svg>
          </div>
          <span className="text-xs font-bold text-gray-700">RestKit · Tacos El Norte</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 border-b border-gray-100">
        {[
          { label: "Ventas hoy", value: "$4,280" },
          { label: "Órdenes", value: "38" },
          { label: "Mesa llena", value: "91%" },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className="text-[0.7rem] text-gray-400 font-medium">{s.label}</p>
            <p className="text-base font-extrabold text-gray-900 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="p-4 space-y-2.5">
        <p className="text-[0.7rem] font-bold uppercase tracking-wider text-gray-400">Órdenes activas</p>
        {orders.map((o) => (
          <div key={o.table} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800">{o.table}</p>
              <p className="text-[0.7rem] text-gray-400 truncate">{o.items}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {o.status === "cooking" && (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-600"><Clock size={10} /> {o.time}</span>
              )}
              <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusStyles[o.status]}`}>
                {statusLabels[o.status]}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-500 mt-1">
        <span className="text-xs font-semibold text-emerald-100">Mesa 7 · sello agregado al cobrar</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">Ver tarjeta <ArrowRight size={11} /></span>
      </div>
    </div>
  );
}

/* ─── SOCIAL PROOF ─── */
function SocialProof() {
  const stats = [
    { value: "14 días", label: "De prueba, sin tarjeta" },
    { value: "$249", label: "Al mes, plan Lite en MXN" },
    { value: "2", label: "Wallets: Apple y Google" },
    { value: "0", label: "Instalaciones o servidor local" },
  ];
  return (
    <section className="py-14 bg-gray-50 border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-center text-xs font-bold tracking-widest uppercase text-gray-400 mb-10">
          Todo incluido desde el primer día
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold tracking-tight text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── MODULES ─── */
function Modules() {
  // Every bullet here has to point at something that ships today. The two
  // modules that used to sit at the end of this grid — CFDI and delivery — are
  // marked "Próximamente" in the dashboard sidebar, which is where they belong
  // until they exist.
  const modules = [
    {
      icon: ShoppingCart,
      tag: "POS & Pagos",
      title: "Punto de venta móvil",
      desc: "Toma órdenes desde cualquier dispositivo, mándalas a cocina y cobra en efectivo, tarjeta o transferencia. Sin caja registradora física.",
      bullets: ["Órdenes por mesa", "Efectivo, tarjeta o transferencia", "Ticket de 80 mm"],
      color: "emerald",
    },
    {
      icon: Monitor,
      tag: "Cocina",
      title: "Pantalla de cocina (KDS)",
      desc: "Envía las comandas directo al monitor de cocina. Cada ticket lleva su cronómetro y se marca como listo con un toque.",
      bullets: ["Cronómetro por comanda", "Listo con un toque", "Comanda impresa"],
      color: "blue",
    },
    {
      icon: Package,
      tag: "Inventario",
      title: "Control de ingredientes",
      desc: "Descuenta insumos automáticamente al vender. Define recetas por producto, fija alertas de stock mínimo y registra la merma.",
      bullets: ["Recetas por producto", "Alertas de stock", "Registro de merma"],
      color: "violet",
    },
    {
      icon: Gift,
      tag: "Fidelización",
      title: "Sellos o cashback, sin app",
      desc: "El sello se pone solo al cobrar — nadie tiene que acordarse. La tarjeta vive en Apple y Google Wallet y se actualiza sola.",
      bullets: ["Apple y Google Wallet", "Sellos o cashback", "QR de auto-inscripción"],
      color: "rose",
    },
    {
      icon: BarChart3,
      tag: "Analíticas",
      title: "Ventas y clientes de un vistazo",
      desc: "Ventas del día, ticket promedio, qué mesero vendió más y qué tanto regresan tus clientes con tarjeta — desde tu celular.",
      bullets: ["Ventas por mesero", "Historial de pedidos", "Exporta a CSV"],
      color: "amber",
    },
    {
      icon: FileText,
      tag: "Caja",
      title: "Corte de caja por turno",
      desc: "Abre y cierra la caja con fondo inicial. Al cerrar te dice cuánto debería haber, cuánto hay y de cuánto es la diferencia.",
      bullets: ["Fondo y cierre", "Esperado vs. real", "Reimprime cualquier ticket"],
      color: "cyan",
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    blue:    { bg: "bg-blue-50",    text: "text-blue-600",    badge: "bg-blue-50 text-blue-600 border-blue-100" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-600",  badge: "bg-violet-50 text-violet-600 border-violet-100" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-600",   badge: "bg-amber-50 text-amber-600 border-amber-100" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-600",    badge: "bg-rose-50 text-rose-600 border-rose-100" },
    cyan:    { bg: "bg-cyan-50",    text: "text-cyan-600",    badge: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  };

  return (
    <section className="py-24" id="modulos">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="mb-12">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Módulos</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-3">
            Todo lo que tu restaurante necesita
          </h2>
          <p className="text-base text-gray-500 max-w-[560px]">
            Un ecosistema completo en lugar de 6 herramientas distintas. Desde la orden en la mesa hasta el corte de caja, todo conectado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => {
            const c = colorMap[m.color];
            return (
              <div key={m.title} className="group rounded-2xl border border-gray-200 bg-white p-7 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center mb-4`}>
                  <m.icon size={22} />
                </div>
                <span className={`inline-flex text-[0.7rem] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full mb-3 ${c.badge}`}>
                  {m.tag}
                </span>
                <h3 className="text-base font-bold text-gray-900 mb-2">{m.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{m.desc}</p>
                <ul className="space-y-1.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-gray-500">
                      <Check size={13} className="text-emerald-500 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── LOYALTY SPOTLIGHT ─── */
function LoyaltySpotlight() {
  // The real card, once per trade, rendered on the server and handed to the
  // carousel. The mockup that used to sit here was hand-drawn HTML of a card
  // that does not exist — hardcoded stamps, a taco and two fake wallet buttons.
  // Twelve renders of the actual component are both more honest and a better
  // argument: an owner sees their own trade in the row, in its own colour.
  const slides = VERTICALS.map((v) => ({
    slug: v.slug,
    label: v.plural.charAt(0).toUpperCase() + v.plural.slice(1),
    mechanic: v.mechanic === "cashback" ? "Cashback" : "Sellos",
    card: <VerticalSampleCard v={v} />,
  }));

  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100" id="fidelizacion">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start mb-12">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Fidelización incluida</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-4">
              Tarjetas de lealtad en Apple y Google Wallet
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-6">
              Sin apps extra, sin tarjetas físicas. Tus clientes guardan su tarjeta directo en su wallet, y cada visita la actualiza sola.
            </p>
            <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm no-underline text-sm">
              Crear mi programa <ArrowRight size={16} />
            </Link>
          </div>

          <ul className="space-y-3 lg:pt-10">
            {[
              "QR único por cliente — escaneas y registras la visita",
              "Notificaciones push cuando están cerca del premio",
              "Compatible con iPhone y Android desde el día 1",
              "Integrado con el POS — sin doble captura",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Full-bleed: the row is meant to run past the edge, so it reads as
          scrollable before anyone touches it. */}
      <div className="max-w-[1200px] mx-auto">
        <p className="px-6 mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">
          Sellos o cashback · fondo claro, oscuro o en tu color · con la foto de tu local
        </p>
        <LoyaltyCardCarousel slides={slides} />
      </div>
    </section>
  );
}

/* ─── ANALYTICS ─── */
function AnalyticsPreview() {
  const reports = [
    { icon: TrendingUp, label: "Ventas de los últimos 7 días" },
    { icon: Users, label: "Ventas por mesero" },
    { icon: Package, label: "Stock bajo" },
    { icon: Star, label: "Clientes frecuentes" },
    { icon: QrCode, label: "Ticket promedio" },
    { icon: Bell, label: "Pedidos cancelados" },
  ];
  return (
    <section className="py-24" id="analytics">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — report cards mockup */}
          <div className="grid grid-cols-2 gap-3">
            {reports.map((r, i) => (
              <div key={r.label} className={`rounded-2xl border border-gray-200 bg-white p-5 ${i === 0 ? "col-span-2" : ""}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <r.icon size={16} />
                  </div>
                  <p className="text-xs font-semibold text-gray-600">{r.label}</p>
                </div>
                {i === 0 ? (
                  <div className="flex items-end gap-1.5 h-10">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, j) => (
                      <div key={j} className="flex-1 bg-emerald-500 rounded-t-sm opacity-80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                ) : (
                  <p className="text-2xl font-extrabold tracking-tight text-gray-900">
                    {["$18,420", "3 insumos", "128", "$247", "1.2%"][i - 1]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Analíticas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-4">
              Tus números, desde tu celular
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-6">
              Decisiones en tiempo real sin esperar al cierre. Consulta ventas, ticket promedio, qué mesero vendió más y qué tanto regresan tus clientes con tarjeta — donde estés.
            </p>
            <ul className="space-y-3">
              {[
                "Filtra por hoy, 7 días o 30 días",
                "Ventas y propinas por mesero",
                "Avisos de stock bajo en el panel",
                "Exporta tu programa de lealtad a CSV",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── MEXICO FIRST ─── */
function MexicoFirst() {
  const items = [
    { icon: FileText, title: "Datos fiscales en el ticket", desc: "Razón social, RFC y domicilio fiscal impresos en cada ticket de 80 mm. Configúralos una vez y listo." },
    { icon: Shield, title: "Sin contrato ni permanencia", desc: "14 días de prueba sin tarjeta. Después, mes a mes en pesos — cancelas desde el panel cuando quieras." },
    { icon: Globe, title: "Soporte en español", desc: "Equipo de soporte 100% en español, en tu zona horaria. Sin bots, sin traducciones raras." },
    { icon: Layers, title: "Sin instalaciones", desc: "Todo en la nube. Sin servidor local, sin actualizaciones manuales, sin técnico de visita." },
  ];
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Hecho para México</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-3">
            No más software del siglo pasado
          </h2>
          <p className="text-base text-gray-500 max-w-[540px] mx-auto">
            Los sistemas de punto de venta en México llevan décadas sin innovar. RestKit es moderno, en la nube y pensado para el restaurantero de hoy.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <item.icon size={20} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1.5">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA BANNER ─── */
function CtaBanner() {
  return (
    <section className="py-24 border-t border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6 text-center flex flex-col items-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} /> 14 días gratis, sin tarjeta
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4 max-w-[600px]">
          Tu restaurante moderno empieza hoy
        </h2>
        <p className="text-base text-gray-500 mb-8 max-w-[480px]">
          Configura tu menú, tus mesas y tu programa de lealtad hoy mismo. Sin tarjeta, sin instalaciones, sin técnico de visita.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-sm no-underline">
            Comenzar prueba gratis <ArrowRight size={17} />
          </Link>
          <a href="#modulos" className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-7 py-3.5 rounded-xl transition-all no-underline">
            Ver todos los módulos <ChevronRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
