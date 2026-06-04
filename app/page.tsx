import Link from "next/link";
import {
  CreditCard, Smartphone, BarChart3, QrCode, Bell, ArrowRight,
  ChevronRight, ShoppingCart, Monitor, Package, FileText,
  Truck, Gift, Check, Zap, Shield, Globe, Users,
  TrendingUp, Clock, Star, CheckCircle2, Layers,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <Nav />
      <Hero />
      <SocialProof />
      <Modules />
      <LoyaltySpotlight />
      <AnalyticsPreview />
      <MexicoFirst />
      <Pricing />
      <Testimonials />
      <CtaBanner />
      <Footer />
    </div>
  );
}

/* ─── NAV ─── */
function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline whitespace-nowrap shrink-0">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#10b981" />
            <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
          </svg>
          RestKit
        </Link>
        <nav className="hidden md:flex gap-7 flex-1">
          <a href="#modulos" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Módulos</a>
          <a href="#analytics" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Analíticas</a>
          <a href="#fidelizacion" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Fidelización</a>
          <a href="#precios" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Precios</a>
        </nav>
        <div className="flex gap-3 items-center shrink-0">
          <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all no-underline">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm no-underline">
            Prueba gratis
          </Link>
        </div>
      </div>
    </header>
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
              POS, cocina, inventario, analíticas, facturación SAT y fidelización digital — todo integrado, sin complicaciones, hecho para México.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm no-underline">
                Comenzar gratis <ArrowRight size={17} />
              </Link>
              <a href="#modulos" className="inline-flex items-center gap-2 border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700 font-semibold px-6 py-3 rounded-xl transition-all no-underline">
                Ver módulos
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-5">
              {["Sin contrato anual", "Soporte en español", "Facturación CFDI 4.0"].map((t) => (
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
        <span className="text-xs font-semibold text-emerald-100">Próxima factura CFDI lista</span>
        <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">Enviar →</span>
      </div>
    </div>
  );
}

/* ─── SOCIAL PROOF ─── */
function SocialProof() {
  const stats = [
    { value: "1,200+", label: "Restaurantes activos" },
    { value: "$2.4M", label: "Procesados al mes" },
    { value: "99.9%", label: "Uptime garantizado" },
    { value: "< 5 min", label: "Para empezar a vender" },
  ];
  return (
    <section className="py-14 bg-gray-50 border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-center text-xs font-bold tracking-widest uppercase text-gray-400 mb-10">
          Confiado por restaurantes en todo México
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
  const modules = [
    {
      icon: ShoppingCart,
      tag: "POS & Pagos",
      title: "Punto de venta móvil",
      desc: "Toma órdenes desde cualquier dispositivo, divide cuentas y acepta pagos integrados. Sin caja registradora física, sin complicaciones.",
      bullets: ["División de cuenta", "Pagos con tarjeta", "Modo sin internet"],
      color: "emerald",
    },
    {
      icon: Monitor,
      tag: "Cocina",
      title: "Pantalla de cocina (KDS)",
      desc: "Envía órdenes directo a los monitores de cocina o barra. Controla tiempos de preparación y elimina cuellos de botella.",
      bullets: ["Alertas de tiempo", "Por estación", "Historial de prep"],
      color: "blue",
    },
    {
      icon: Package,
      tag: "Inventario",
      title: "Control de ingredientes",
      desc: "Descuenta insumos automáticamente al vender. Define recetas, fija alertas de stock mínimo y reduce el desperdicio.",
      bullets: ["Recetas inteligentes", "Alertas de stock", "Reportes de merma"],
      color: "violet",
    },
    {
      icon: BarChart3,
      tag: "Analíticas",
      title: "Reportes en tiempo real",
      desc: "Más de 25 reportes personalizables: ventas, cancelaciones, rendimiento por empleado e inventario — desde tu celular.",
      bullets: ["25+ reportes", "Por turno o fecha", "Exporta a Excel"],
      color: "amber",
    },
    {
      icon: FileText,
      tag: "Facturación",
      title: "CFDI 4.0 automático",
      desc: "Genera y envía facturas fiscales al correo del cliente en segundos. Compatible con SAT, sin complementos adicionales.",
      bullets: ["CFDI 4.0", "Timbrado al instante", "Envío por email"],
      color: "rose",
    },
    {
      icon: Truck,
      tag: "Delivery",
      title: "Pedidos y entrega",
      desc: "Integra órdenes de apps de terceros, menú digital por QR y kiosco de autoservicio en un solo panel.",
      bullets: ["Menú QR digital", "Integración delivery", "Kiosco self-service"],
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
            Un ecosistema completo en lugar de 6 herramientas distintas. Desde el POS hasta la factura, todo conectado.
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
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100" id="fidelizacion">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Fidelización incluida</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-4">
              Tarjetas de lealtad en Apple y Google Wallet
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-6">
              Sin apps extra, sin tarjetas físicas. Tus clientes guardan su tarjeta de sellos directo en su wallet. Cada visita actualiza la tarjeta en tiempo real.
            </p>
            <ul className="space-y-3 mb-8">
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
            <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm no-underline text-sm">
              Crear mi programa <ArrowRight size={16} />
            </Link>
          </div>

          {/* Wallet card preview */}
          <div className="flex justify-center">
            <div className="bg-white border border-gray-200 rounded-2xl p-7 w-[300px] shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Gift size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">Tacos El Norte</p>
                  <p className="text-xs text-gray-400">Tarjeta de lealtad</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className={`aspect-square rounded-full border-2 flex items-center justify-center text-emerald-500 ${i < 7 ? "bg-emerald-500/10 border-emerald-500" : "border-gray-200"}`}>
                    {i < 7 && <Check size={13} strokeWidth={3} />}
                  </div>
                ))}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "70%" }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>7 de 10 visitas</span>
                <span className="text-emerald-600 font-semibold">1 taco gratis</span>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="flex-1 bg-black text-white text-[0.65rem] font-semibold rounded-lg py-1.5 text-center">Apple Wallet</div>
                <div className="flex-1 border border-gray-200 text-gray-700 text-[0.65rem] font-semibold rounded-lg py-1.5 text-center">Google Wallet</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── ANALYTICS ─── */
function AnalyticsPreview() {
  const reports = [
    { icon: TrendingUp, label: "Ventas por hora" },
    { icon: Users, label: "Rendimiento por mesero" },
    { icon: Package, label: "Rotación de inventario" },
    { icon: Star, label: "Productos top" },
    { icon: QrCode, label: "Órdenes por canal" },
    { icon: Bell, label: "Cancelaciones" },
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
                    {["$18,420", "4.8 / 5", "92%", "Tacos x3", "Delivery 34%", "1.2%"][i - 1]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Analíticas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-4">
              25+ reportes desde tu celular
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-6">
              Decisiones en tiempo real sin esperar al cierre. Consulta ventas, desempeño por turno, productos más vendidos y alertas de inventario — donde estés.
            </p>
            <ul className="space-y-3">
              {[
                "Reportes por turno, día, semana o mes",
                "Alertas automáticas de bajo inventario",
                "Comparativo con períodos anteriores",
                "Exportación a Excel o PDF",
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
    { icon: FileText, title: "CFDI 4.0 incluido", desc: "Facturación fiscal automática. Timbrado ante SAT en segundos, sin pagar módulos extra." },
    { icon: Shield, title: "Datos en México", desc: "Tu información almacenada en servidores mexicanos. Cumplimos con la Ley Federal de Protección de Datos." },
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

/* ─── PRICING ─── */
function Pricing() {
  const plans = [
    {
      name: "Básico",
      price: "$599",
      period: "/mes",
      desc: "Ideal para cafeterías y negocios pequeños.",
      features: ["POS en 1 dispositivo", "Menú QR digital", "Fidelización (wallet)", "Facturación CFDI", "Soporte por email"],
      cta: "Comenzar gratis",
      highlight: false,
    },
    {
      name: "Profesional",
      price: "$1,299",
      period: "/mes",
      desc: "Para restaurantes que necesitan más control.",
      features: ["POS ilimitado", "KDS cocina + barra", "Inventario y recetas", "25+ reportes", "Soporte prioritario", "Delivery integrado"],
      cta: "Comenzar gratis",
      highlight: true,
    },
    {
      name: "Empresa",
      price: "A medida",
      period: "",
      desc: "Para cadenas y franquicias con múltiples sucursales.",
      features: ["Sucursales ilimitadas", "API & webhooks", "Manager central", "Reportes consolidados", "Onboarding dedicado", "SLA garantizado"],
      cta: "Hablar con ventas",
      highlight: false,
    },
  ];

  return (
    <section className="py-24" id="precios">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Precios</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-3">
            Transparente, sin sorpresas
          </h2>
          <p className="text-base text-gray-500">14 días de prueba gratis. Sin tarjeta de crédito.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-8 relative ${p.highlight ? "border-emerald-500 shadow-lg shadow-emerald-500/10 bg-white" : "border-gray-200 bg-white"}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[0.7rem] font-bold px-3 py-1 rounded-full">
                  Más popular
                </span>
              )}
              <p className="text-sm font-bold text-gray-900 mb-1">{p.name}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold tracking-tight text-gray-900">{p.price}</span>
                <span className="text-sm text-gray-400 mb-1">{p.period}</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">{p.desc}</p>
              <ul className="space-y-2.5 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check size={14} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/registro"
                className={`block w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-colors no-underline ${
                  p.highlight
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ─── */
function Testimonials() {
  const items = [
    { name: "Roberto Salinas", role: "Dueño, Tacos El Norte · CDMX", quote: "Cambié de SoftRestaurant a RestKit y nunca lo lamenté. El sistema es más rápido, más barato y el soporte responde el mismo día." },
    { name: "Daniela Orozco", role: "Gerente, Café Aroma · Guadalajara", quote: "La pantalla de cocina redujo los errores en un 60%. Antes mis cocineros perdían comandas; ahora todo está en la pantalla al instante." },
    { name: "Jorge Mena", role: "Fundador, Pizza Molino · Monterrey", quote: "El módulo de inventario solo ya valió la inversión. Sé exactamente cuánta harina me queda sin tener que contar a mano cada noche." },
  ];
  return (
    <section className="py-20 bg-gray-50 border-t border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Testimonios</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2">
            Restauranteros reales, resultados reales
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <blockquote key={t.name} className="bg-white border border-gray-200 rounded-2xl p-7 m-0">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
              <footer className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </footer>
            </blockquote>
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
          Únete a más de 1,200 restaurantes en México que ya dejaron atrás el software del siglo pasado.
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
function Footer() {
  return (
    <footer className="border-t border-gray-100 pt-14 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 pb-12">
        <div>
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline mb-3">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <p className="text-sm text-gray-400 leading-relaxed max-w-[240px]">
            El sistema operativo para restaurantes mexicanos modernos.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Plataforma</h4>
          {["POS & Pagos", "KDS Cocina", "Inventario", "Analíticas", "Facturación CFDI", "Fidelización"].map((l) => (
            <a key={l} href="#modulos" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Empresa</h4>
          {["Nosotros", "Blog", "Soporte", "API Docs", "Contacto"].map((l) => (
            <a key={l} href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Legal</h4>
          {["Privacidad", "Términos de uso", "Cookies", "CFDI & SAT"].map((l) => (
            <a key={l} href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 border-t border-gray-200 py-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">© 2026 RestKit. Todos los derechos reservados.</p>
        <p className="text-xs text-gray-400">Hecho con ♥ en México 🇲🇽</p>
      </div>
    </footer>
  );
}
