import Link from "next/link";
import {
  CreditCard, Smartphone, BarChart3, QrCode, Target, Bell,
  Store, UserPlus, ScanLine, Gift, Check, ArrowRight,
  RefreshCw, Shield, Zap, ChevronRight,
  LayoutDashboard, Users, Settings, Home,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Nav />
      <Hero />
      <Stats />
      <HowItWorks />
      <PassTypes />
      <Features />
      <Platform />
      <Testimonials />
      <CtaBanner />
      <Footer />
    </div>
  );
}

/* ─── NAV ─── */
function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline whitespace-nowrap">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#10b981" />
            <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
          </svg>
          RestKit
        </Link>
        <nav className="hidden md:flex gap-8 flex-1">
          <a href="#how" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Cómo funciona</a>
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Funciones</a>
          <a href="#platform" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Plataforma</a>
          <a href="#pricing" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Precios</a>
        </nav>
        <div className="flex gap-3 items-center">
          <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all no-underline">Iniciar sesión</Link>
          <Link href="/registro" className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-500-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm no-underline">Comenzar gratis</Link>
        </div>
      </div>
    </header>
  );
}

/* ─── HERO ─── */
function Hero() {
  return (
    <section className="py-20 border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="lg:text-left text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Tu solución de fidelización digital</p>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 mb-5">
            Tarjetas de lealtad directamente en{" "}
            <span className="text-emerald-500">Apple y Google Wallet</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-[500px] lg:mx-0 mx-auto">
            Crea, distribuye y gestiona programas de fidelización digitales para tu restaurante o cafetería. Sin tarjetas físicas, sin apps adicionales.
          </p>
          <div className="flex gap-3 flex-wrap lg:justify-start justify-center">
            <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-500-dark text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-sm no-underline">Prueba gratuita <ArrowRight size={18} /></Link>
            <a href="#how" className="inline-flex items-center gap-2 text-emerald-500 border border-gray-200 hover:border-emerald-500 hover:bg-emerald-500/5 font-semibold px-6 py-3 rounded-lg transition-all no-underline">Ver demostración</a>
          </div>
        </div>
        <div className="relative flex justify-center">
          <WalletCard />
          <div className="hidden sm:flex absolute top-[-8px] left-[-32px] items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 shadow-md whitespace-nowrap animate-float-a">
            <RefreshCw size={14} className="text-emerald-500" /> Actualización en tiempo real
          </div>
          <div className="hidden sm:flex absolute bottom-[-8px] right-[-32px] items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 shadow-md whitespace-nowrap animate-float-b">
            <Bell size={14} className="text-emerald-500" /> Notificación push enviada
          </div>
        </div>
      </div>
    </section>
  );
}

function WalletCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-7 w-[310px] shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><CreditCard size={20} /></div>
        <div>
          <div className="font-bold text-sm text-gray-900">La Cafetería Urbana</div>
          <div className="text-xs text-gray-500">Tarjeta de lealtad</div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`aspect-square rounded-full border-2 flex items-center justify-center text-emerald-500 transition-all ${i < 7 ? "bg-emerald-500/10 border-emerald-500" : "border-gray-200"}`}>
            {i < 7 && <Check size={14} strokeWidth={3} />}
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: "70%" }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>7 de 10 visitas</span>
        <span className="text-emerald-500 font-semibold">1 café gratis</span>
      </div>
    </div>
  );
}

/* ─── STATS ─── */
function Stats() {
  const stats = [
    { value: "500+", label: "Negocios activos" },
    { value: "92%", label: "Tasa de retención" },
    { value: "<5 min", label: "Tiempo de onboarding" },
    { value: "50K+", label: "Tarjetas emitidas" },
  ];
  return (
    <section className="py-16 bg-gray-50 border-b border-gray-200 text-center">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Resultados comprobados</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-10">Rendimiento en el que puedes confiar</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">{s.value}</span>
              <span className="text-sm text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─── */
function HowItWorks() {
  const steps = [
    { icon: Store, title: "Crea tu negocio", desc: "Regístrate y configura tu programa de fidelización. Define la recompensa y el número de visitas necesarias." },
    { icon: UserPlus, title: "Clientes se registran", desc: "Comparte un QR único. Tus clientes lo escanean y reciben su tarjeta digital al instante en su wallet." },
    { icon: ScanLine, title: "Registra visitas", desc: "En cada compra, escanea el QR de la tarjeta del cliente. El sello se registra automáticamente." },
    { icon: Gift, title: "Entrega recompensas", desc: "Al completar el programa, el cliente recibe su recompensa. Sin complicaciones, sin fricción." },
  ];
  return (
    <section className="py-20" id="how">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Cómo funciona</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-3 max-w-[650px]">Crea, distribuye y gestiona tarjetas digitales sin esfuerzo</h2>
        <p className="text-base text-gray-500 leading-relaxed mb-12 max-w-[600px]">Crea tarjetas de fidelización totalmente personalizadas y gestiona cada paso, desde la creación hasta las actualizaciones en tiempo real.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-white border border-gray-200 rounded-xl p-7 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="text-xs font-bold tracking-widest text-emerald-500 mb-3 font-mono">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-emerald-500 mb-4"><s.icon size={24} /></div>
              <h3 className="text-[0.95rem] font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PASS TYPES ─── */
function PassTypes() {
  const types = [
    { icon: CreditCard, title: "Tarjeta de sellos", sub: "Programas de fidelización", desc: "Ofrece recompensas por compras recurrentes. Cada visita cuenta y se registra automáticamente en la tarjeta digital del cliente." },
    { icon: Gift, title: "Cupones y ofertas", sub: "Promociones especiales", desc: "Distribuye cupones de descuento directamente al wallet. Ideales para atraer nuevos clientes o reactivar inactivos." },
    { icon: Shield, title: "Membresías", sub: "Acceso exclusivo", desc: "Tarjetas de membresía VIP con beneficios exclusivos. Perfecto para programas de acceso premium." },
  ];
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-200">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Tipos de tarjeta</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-10">Diseñadas para cada necesidad</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {types.map((t) => (
            <div key={t.title} className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4"><t.icon size={24} /></div>
              <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider mb-1">{t.sub}</p>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES ─── */
function Features() {
  const features = [
    { icon: Smartphone, title: "Apple & Google Wallet", desc: "Tarjetas compatibles con ambas plataformas. Tus clientes siempre llevan su tarjeta encima." },
    { icon: BarChart3, title: "Analíticas avanzadas", desc: "Métricas detalladas de visitas, retención y rendimiento de tus programas de fidelización." },
    { icon: QrCode, title: "Escaneo QR", desc: "Sistema de escaneo rápido y seguro para registrar visitas en segundos." },
    { icon: Bell, title: "Notificaciones push", desc: "Envía alertas personalizadas cuando un cliente está cerca de su recompensa." },
    { icon: Target, title: "Reglas flexibles", desc: "Configura programas con diferentes números de visitas, recompensas y fechas de expiración." },
    { icon: Zap, title: "Integración API", desc: "API REST completa para integrar RestKit con tus sistemas existentes." },
  ];
  return (
    <section className="py-20" id="features">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Funciones</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-10">Todo lo que necesitas en una sola plataforma</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-7 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4"><f.icon size={22} /></div>
              <h3 className="text-[0.92rem] font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PLATFORM ─── */
function Platform() {
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-200" id="platform">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">La plataforma RestKit</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-3">Construye a tu manera</h2>
        <p className="text-base text-gray-500 leading-relaxed mb-10 max-w-[600px]">Usa el Dashboard intuitivo o integra vía API para control total y máxima flexibilidad.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-10">
            <span className="inline-block text-xs font-bold tracking-wider uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-md mb-5">Dashboard</span>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Todo lo que necesitas, en un solo lugar</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">Gestiona cada parte del ciclo de vida de tus tarjetas desde una interfaz intuitiva. Crea plantillas, realiza operaciones masivas, monitorea analíticas y administra todo el flujo sin necesidad de código.</p>
            <Link href="/registro" className="inline-flex items-center gap-1.5 text-emerald-500 border border-gray-200 hover:border-emerald-500 font-semibold text-sm px-4 py-2 rounded-lg transition-all no-underline">Ver cómo funciona <ChevronRight size={16} /></Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-10">
            <span className="inline-block text-xs font-bold tracking-wider uppercase text-purple-600 bg-purple-600/10 px-3 py-1 rounded-md mb-5">API</span>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Hecho por developers, para developers</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">Integra RestKit en tus sistemas para crear, actualizar y gestionar tarjetas a escala. Automatiza registros, dispara actualizaciones en tiempo real y sincroniza datos de clientes a través de nuestra API REST.</p>
            <Link href="/registro" className="inline-flex items-center gap-1.5 text-emerald-500 border border-gray-200 hover:border-emerald-500 font-semibold text-sm px-4 py-2 rounded-lg transition-all no-underline">Ver documentación <ChevronRight size={16} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ─── */
function Testimonials() {
  const items = [
    { name: "María López", role: "Dueña, Café Aroma", quote: "RestKit transformó cómo manejamos la fidelización. Nuestros clientes aman tener su tarjeta siempre disponible en el móvil." },
    { name: "Carlos Mendoza", role: "Gerente, Tacos El Patrón", quote: "Desde que implementamos RestKit, las visitas recurrentes aumentaron un 34%. La plataforma es increíblemente fácil de usar." },
    { name: "Ana García", role: "Fundadora, Juice Bar Co.", quote: "La integración con Apple Wallet fue un game changer. Ya no tenemos que lidiar con tarjetas físicas perdidas o dañadas." },
  ];
  return (
    <section className="py-20">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500 mb-3">Testimonios</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-10">Lo que dicen nuestros clientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <blockquote key={t.name} className="bg-gray-50 border border-gray-200 rounded-xl p-7 m-0">
              <p className="text-sm text-gray-900 leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
              <footer className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">{t.name[0]}</div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
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
    <section className="py-20 bg-gray-50 border-y border-gray-200" id="pricing">
      <div className="max-w-[1200px] mx-auto px-6 text-center flex flex-col items-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-4">Comienza tu prueba gratuita hoy</h2>
        <p className="text-base text-gray-500 leading-relaxed mb-8 max-w-[520px]">Diseña, prueba y entrega tu primera tarjeta digital en Apple o Google Wallet en minutos, usando nuestro Dashboard o API.</p>
        <Link href="/registro" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-500-dark text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-sm no-underline">Comenzar prueba gratuita <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="border-t border-gray-200 pt-14">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 pb-12">
        <div>
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline mb-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#10b981" /><path d="M10 16L16 10L22 16L16 22Z" fill="white" /></svg>
            RestKit
          </Link>
          <p className="text-sm text-gray-500 leading-relaxed max-w-[260px]">Fidelización digital para restaurantes y cafeterías.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Producto</h4>
          <a href="#how" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Cómo funciona</a>
          <a href="#features" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Funciones</a>
          <a href="#platform" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Plataforma</a>
          <a href="#pricing" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Precios</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Recursos</h4>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Documentación</a>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">API Reference</a>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Blog</a>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Soporte</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Legal</h4>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Privacidad</a>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Términos de uso</a>
          <a href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">Cookies</a>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 border-t border-gray-200 py-6">
        <p className="text-xs text-gray-500">© 2025 RestKit. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
