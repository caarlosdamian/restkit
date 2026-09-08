import type { LoyaltyMechanic } from '@/models/Business';

/**
 * The vertical landing pages.
 *
 * Programmatic SEO has one failure mode that matters: twelve pages whose only
 * difference is the noun. Google calls that thin content and it earns nothing.
 * So this shape deliberately has no "insert vertical here" slots — every field
 * that carries meaning (`problem`, `rewardIdeas`, `faq`, the mechanic each
 * page leads with, even what a customer is CALLED) is written per vertical.
 * A new entry that reads like a copy of another one is not worth adding.
 */

export interface Vertical {
  /** URL segment. Keyword-first, since the page targets that exact search. */
  slug: string;
  /** Plural, lowercase — reads inside "Programa de lealtad para ___". */
  plural: string;
  /** With its article: "tu restaurante", "tu salón". */
  yours: string;
  /** What this business calls the people it serves. */
  customer: { one: string; many: string };
  /** Which mechanic the page leads with — a gym is not a taquería. */
  mechanic: LoyaltyMechanic;
  /** What one accrual is called here: a visit, a cut, a wash. */
  unit: { one: string; many: string };
  title: string;
  tagline: string;
  /** 2–3 paragraphs. The real argument for THIS trade. */
  problem: string[];
  pullQuote: string;
  /** Four, specific. Generic ones tell an owner nothing. */
  rewardIdeas: string[];
  faq: { q: string; a: string }[];
  /** From lib/stamp-icons.ts. */
  icon: string;
  accent: string;
  /** Sample card shown on the page. */
  sample: { required: number; reward: string; rate: number };
  /** <meta description>. Under ~155 chars. */
  metaDescription: string;
}

export const VERTICALS: Vertical[] = [
  {
    slug: 'restaurantes',
    plural: 'restaurantes',
    yours: 'tu restaurante',
    customer: { one: 'comensal', many: 'comensales' },
    mechanic: 'cashback',
    unit: { one: 'visita', many: 'visitas' },
    title: 'Lealtad con cashback para restaurantes',
    tagline: 'Devuelve saldo hoy, llena tus mesas mañana.',
    problem: [
      'Llenar mesas una vez es fácil: una promoción, una reseña buena, un fin de semana largo. Lo difícil es que esa misma mesa vuelva el mes que entra. Un comensal que regresa cada quincena vale muchísimo más que tres que te descubren y no vuelven, y cuesta una fracción traerlo de nuevo.',
      'El cashback funciona en restaurantes porque el ticket es alto y variable. Un porcentaje de una cuenta de $800 es un saldo que se siente, y ese saldo sólo se gasta contigo. No es un descuento que regalas hoy: es una razón concreta para que reserven la próxima vez.',
      'Con RestKit el saldo se suma solo al cerrar la cuenta en el punto de venta — tu mesero no tiene que acordarse de nada ni abrir otra app. Y si no usas nuestro POS, se escanea el código de la tarjeta desde cualquier celular.',
    ],
    pullQuote: 'El saldo que devuelves hoy es la mesa que reservas para mañana.',
    rewardIdeas: [
      '8% de cada cuenta de vuelta como saldo',
      'Saldo doble de lunes a miércoles, para nivelar la semana',
      'Bono de bienvenida que se usa a partir de la segunda visita',
      'Postre de cortesía al llegar a cierto saldo acumulado',
    ],
    faq: [
      {
        q: '¿El saldo se suma solo o lo tiene que capturar el mesero?',
        a: 'Si cobras con el POS de RestKit, se suma solo al marcar la cuenta como pagada: el mesero no hace nada extra. Si usas otra caja, se escanea el código de la tarjeta del comensal desde cualquier celular y se registra ahí.',
      },
      {
        q: '¿Qué pasa con las cuentas divididas?',
        a: 'El saldo se acumula sobre lo que efectivamente cobró esa cuenta. Si dividen, cada quien acumula sobre su parte, con su propia tarjeta.',
      },
    ],
    icon: 'utensils',
    accent: '#b3202c',
    sample: { required: 10, reward: 'Una entrada de cortesía', rate: 8 },
    metaDescription:
      'Programa de lealtad con cashback para restaurantes: devuelve un % de cada cuenta como saldo en Apple Wallet y Google Wallet. Sin apps ni plásticos.',
  },
  {
    slug: 'cafeterias',
    plural: 'cafeterías',
    yours: 'tu cafetería',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'sellos',
    unit: { one: 'café', many: 'cafés' },
    title: 'Tarjeta de sellos digital para cafeterías',
    tagline: 'El décimo café gratis, sin la tarjetita que siempre se pierde.',
    problem: [
      'La tarjeta de sellos de cartón lleva décadas funcionando en cafeterías por una razón: el ticket es bajo y la visita es frecuente, así que juntar diez se siente alcanzable. El problema nunca fue la mecánica — fue el cartón. Se moja, se pierde en la cartera, y el cliente llega sin ella justo el día que iba por su premio.',
      'Una tarjeta digital resuelve exactamente eso y nada más: la misma mecánica, en el teléfono que el cliente ya trae. Se llena sola al pagar, no se pierde, y tú por fin sabes cuántas van y cuántas se cobraron.',
      'Además puedes ver algo que el cartón nunca te dijo: quién lleva ocho sellos y no ha vuelto en tres semanas.',
    ],
    pullQuote: 'La mecánica del cartón nunca falló. El cartón, sí.',
    rewardIdeas: [
      'El décimo café de la casa',
      'Un sello extra antes de las 9 de la mañana',
      'Sello doble en la bebida de temporada',
      'Cambia sellos por un grano para llevar',
    ],
    faq: [
      {
        q: '¿Cuántos sellos conviene pedir?',
        a: 'Entre 8 y 10 para un café diario. Menos de 6 regala margen sin crear hábito; más de 12 se siente inalcanzable y la gente abandona la tarjeta a la mitad.',
      },
      {
        q: '¿Puedo poner un mínimo de consumo por sello?',
        a: 'Sí. Hay un mínimo de ticket opcional, para que un americano chico no cuente igual que un desayuno completo si no quieres.',
      },
    ],
    icon: 'coffee',
    accent: '#6f4e37',
    sample: { required: 10, reward: 'Un café gratis', rate: 5 },
    metaDescription:
      'Tarjeta de sellos digital para cafeterías, en Apple Wallet y Google Wallet. Se llena sola al pagar y no se pierde. Prueba gratis.',
  },
  {
    slug: 'barberias',
    plural: 'barberías',
    yours: 'tu barbería',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'sellos',
    unit: { one: 'corte', many: 'cortes' },
    title: 'Programa de lealtad para barberías',
    tagline: 'Que el décimo corte lo hagas tú, no la barbería de enfrente.',
    problem: [
      'Un hombre se corta el pelo cada tres o cuatro semanas, toda su vida. Eso son unos quince cortes al año durante décadas — y la decisión de dónde casi nunca es el precio: es la costumbre y el barbero que ya sabe cómo lo quiere.',
      'El riesgo real de una barbería no es perder un corte. Es que el cliente pruebe la de enfrente una vez, le guste, y se lleve los quince del año. Una tarjeta con el corte gratis a la vista hace que ese experimento cueste algo.',
      'Y como cada corte queda registrado con el barbero que lo hizo, sabes quién trae de vuelta a su gente y quién no.',
    ],
    pullQuote: 'No pierdes un corte. Pierdes los quince del año.',
    rewardIdeas: [
      'El décimo corte gratis',
      'Barba de cortesía al llegar a la mitad de la tarjeta',
      'Sello doble entre semana, cuando la silla está vacía',
      'Producto de cortesía al completar la segunda tarjeta',
    ],
    faq: [
      {
        q: '¿Sirve si cada barbero tiene su clientela?',
        a: 'Sí. Cada corte queda atribuido al barbero que lo hizo, así que puedes ver el reporte por persona y usarlo para comisiones sin llevar una libreta aparte.',
      },
      {
        q: '¿Y si el cliente agenda por WhatsApp?',
        a: 'No cambia nada. La tarjeta se sella al cobrar, no al agendar, así que sigue funcionando con la agenda que ya usas.',
      },
    ],
    icon: 'scissors',
    accent: '#1e3a5f',
    sample: { required: 10, reward: 'Un corte gratis', rate: 5 },
    metaDescription:
      'Programa de lealtad para barberías: tarjeta de sellos digital en Apple Wallet y Google Wallet, con reporte por barbero. Prueba gratis.',
  },
  {
    slug: 'salones-de-belleza',
    plural: 'salones de belleza',
    yours: 'tu salón',
    customer: { one: 'clienta', many: 'clientas' },
    mechanic: 'cashback',
    unit: { one: 'servicio', many: 'servicios' },
    title: 'Programa de lealtad para salones de belleza',
    tagline: 'Un tinte cuesta lo que diez cortes. Trátalo distinto.',
    problem: [
      'En un salón el ticket no se parece de una visita a otra: un peinado son trescientos pesos y un balayage son tres mil. Una tarjeta de sellos que cuenta visitas premia igual a las dos, y termina regalando margen a quien menos gasta.',
      'El cashback resuelve eso solo, porque devuelve un porcentaje: quien deja más, acumula más. Y como el saldo sólo se gasta contigo, financia el siguiente servicio en lugar de salir de tu caja.',
      'También ordena la conversación difícil: ya no ofreces descuentos sueltos para retener a alguien. Tiene un saldo esperándola y una razón para agendar de nuevo.',
    ],
    pullQuote: 'Contar visitas premia a quien menos gasta.',
    rewardIdeas: [
      '10% de cada servicio de vuelta como saldo',
      'Saldo doble en servicios de color',
      'Bono al reagendar antes de salir del salón',
      'Tratamiento de cortesía al llegar a cierto saldo',
    ],
    faq: [
      {
        q: '¿Por qué cashback y no sellos?',
        a: 'Porque tus tickets son muy distintos entre sí. Los sellos premian la frecuencia; el cashback premia el gasto. Si tu servicio caro es el que quieres repetir, el cashback es el que corresponde. De todos modos puedes cambiar de mecánica cuando quieras.',
      },
      {
        q: '¿Puedo usarlo también para productos?',
        a: 'Sí. El saldo se acumula sobre lo que se cobró, sin distinguir entre servicio y producto de retail.',
      },
    ],
    icon: 'sparkles',
    accent: '#a8194e',
    sample: { required: 8, reward: 'Un tratamiento de cortesía', rate: 10 },
    metaDescription:
      'Programa de lealtad con cashback para salones de belleza: devuelve un % de cada servicio como saldo, en Apple Wallet y Google Wallet.',
  },
  {
    slug: 'spas',
    plural: 'spas',
    yours: 'tu spa',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'cashback',
    unit: { one: 'sesión', many: 'sesiones' },
    title: 'Programa de lealtad para spas',
    tagline: 'Convierte el masaje de regalo en el hábito de cada mes.',
    problem: [
      'A un spa llega mucha gente una sola vez: un cumpleaños, un certificado de regalo, un antojo. La experiencia les encanta, lo dicen al salir, y no vuelven en ocho meses. No es falta de gusto — es que nada les recordó volver.',
      'Un saldo acumulado sí recuerda. Vive en la cartera del teléfono, y cuando pasan cerca de tu local aparece en la pantalla de bloqueo con lo que tienen guardado. Es la diferencia entre "algún día regreso" y agendar.',
      'Y como el ticket de un spa es alto, el porcentaje que devuelves se convierte rápido en algo que vale la pena venir a gastar.',
    ],
    pullQuote: 'No fue falta de gusto. Fue falta de recordatorio.',
    rewardIdeas: [
      '10% de cada sesión de vuelta como saldo',
      'Saldo extra al agendar la siguiente cita antes de irse',
      'Bono de cumpleaños que caduca en el mes',
      'Sesión de cortesía al completar cierto saldo',
    ],
    faq: [
      {
        q: '¿Cómo le aviso a alguien que tiene saldo sin ser molesto?',
        a: 'La tarjeta puede aparecer en la pantalla de bloqueo cuando el cliente pasa cerca del spa. No es una notificación que interrumpe: es un recordatorio en el momento en que sí puede actuar.',
      },
      {
        q: '¿Funciona con certificados de regalo?',
        a: 'Sí, y conviene: quien recibe el certificado se inscribe al usarlo, y sale con saldo. Ahí es donde una visita de regalo se vuelve un cliente.',
      },
    ],
    icon: 'leaf',
    accent: '#2f6f5e',
    sample: { required: 6, reward: 'Una sesión de cortesía', rate: 10 },
    metaDescription:
      'Programa de lealtad para spas con cashback y avisos por ubicación. Tarjeta digital en Apple Wallet y Google Wallet, sin apps.',
  },
  {
    slug: 'gimnasios',
    plural: 'gimnasios',
    yours: 'tu gimnasio',
    customer: { one: 'socio', many: 'socios' },
    mechanic: 'sellos',
    unit: { one: 'visita', many: 'visitas' },
    title: 'Programa de lealtad para gimnasios',
    tagline: 'La mensualidad la pagan una vez. La constancia se premia cada día.',
    problem: [
      'El negocio de un gimnasio no se pierde el día que alguien cancela: se pierde las tres semanas que dejó de venir antes de cancelar. Para cuando llega la baja, la decisión ya estaba tomada.',
      'Premiar la asistencia ataca justo esa ventana. Una tarjeta que se llena con cada visita le da a un socio una razón chica para venir hoy — y a ti una señal temprana: quién venía tres veces por semana y lleva diez días sin aparecer.',
      'Es el mismo dato que ya tienes en la puerta, pero convertido en algo que el socio también ve.',
    ],
    pullQuote: 'La baja no empieza el día que cancelan. Empieza tres semanas antes.',
    rewardIdeas: [
      '12 visitas en el mes y la siguiente mensualidad lleva descuento',
      'Sello doble en clases de horario vacío',
      'Batido de cortesía al completar la tarjeta',
      'Bono por traer a alguien que se inscriba',
    ],
    faq: [
      {
        q: '¿Sirve si cobro mensualidad y no por visita?',
        a: 'Sí, y ahí es donde más sirve. La tarjeta no cobra: cuenta asistencias. Se registra en recepción al entrar, y lo que premias es la constancia, que es exactamente lo que evita la baja.',
      },
      {
        q: '¿Cómo se registra la visita si no hay una venta?',
        a: 'Se escanea el código de la tarjeta del socio desde cualquier celular o tablet en recepción. No hace falta comprar hardware.',
      },
    ],
    icon: 'dumbbell',
    accent: '#1f2937',
    sample: { required: 12, reward: 'Descuento en tu mensualidad', rate: 5 },
    metaDescription:
      'Programa de lealtad para gimnasios: premia la asistencia con una tarjeta digital en Apple Wallet y Google Wallet y detecta bajas antes de que pasen.',
  },
  {
    slug: 'nutriologos',
    plural: 'nutriólogos',
    yours: 'tu consultorio',
    customer: { one: 'paciente', many: 'pacientes' },
    mechanic: 'sellos',
    unit: { one: 'consulta', many: 'consultas' },
    title: 'Programa de lealtad para nutriólogos',
    tagline: 'El resultado llega en la sexta consulta. El problema es llegar a ella.',
    problem: [
      'Casi ningún plan de nutrición falla por el plan. Falla porque el paciente deja de venir en la tercera o cuarta consulta, justo antes de que los resultados se vuelvan visibles y el hábito se sostenga solo.',
      'Una tarjeta de seguimiento hace visible ese camino. El paciente ve cuántas consultas lleva y cuántas faltan para cerrar su proceso, y tú tienes una razón natural para hablar de continuidad sin que suene a venta.',
      'No sustituye tu trabajo clínico: le pone un marcador visible a la parte que se abandona. Y como cada consulta queda registrada con su fecha, ves de un vistazo quién lleva tres semanas sin agendar y todavía está a tiempo de retomar, en lugar de enterarte cuando ya pasaron seis meses.',
    ],
    pullQuote: 'El plan casi nunca falla. La cuarta consulta, sí.',
    rewardIdeas: [
      'La sexta consulta de seguimiento sin costo',
      'Medición de composición corporal de cortesía a mitad del plan',
      'Guía de recetas al completar el proceso',
      'Consulta de mantenimiento gratis a los tres meses',
    ],
    faq: [
      {
        q: '¿Es apropiado premiar consultas de salud?',
        a: 'Lo que se premia es la adherencia al seguimiento, no consumir de más. Un paciente que completa su proceso obtiene el resultado por el que pagó; el incentivo apunta al mismo lado que tu trabajo.',
      },
      {
        q: '¿Qué datos del paciente se guardan?',
        a: 'Nombre y teléfono, y el conteo de consultas. Nada clínico. La tarjeta identifica a la persona en tu agenda, no es un expediente.',
      },
    ],
    icon: 'salad',
    accent: '#3f7d3f',
    sample: { required: 6, reward: 'Consulta de seguimiento gratis', rate: 5 },
    metaDescription:
      'Programa de lealtad para nutriólogos: tarjeta digital de seguimiento que ayuda a que el paciente complete su proceso. Apple y Google Wallet.',
  },
  {
    slug: 'autolavados',
    plural: 'autolavados',
    yours: 'tu autolavado',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'sellos',
    unit: { one: 'lavada', many: 'lavadas' },
    title: 'Programa de lealtad para autolavados',
    tagline: 'Que la costumbre sea tu rampa, no la de la esquina.',
    problem: [
      'Un autolavado compite casi sólo por conveniencia. El coche se ensucia con la misma frecuencia para todos, y el cliente entra al que le queda de paso ese día. Sin nada que lo ancle, cambia de lugar sin pensarlo.',
      'Una tarjeta con la lavada gratis a la vista convierte ese "el que me quede de paso" en "me faltan dos". Es de los giros donde una mecánica de sellos rinde más, porque la visita es frecuente, el ticket es parejo y la decisión es de hábito.',
      'Y al ser digital, no se queda en la guantera del otro coche.',
    ],
    pullQuote: 'Se ensucia igual para todos. Gana el que ya es costumbre.',
    rewardIdeas: [
      'La octava lavada gratis',
      'Sello doble entre semana, cuando hay rampa libre',
      'Encerado de cortesía a la mitad de la tarjeta',
      'Aspirado gratis al inscribirse',
    ],
    faq: [
      {
        q: '¿Puedo dar sellos distintos según el servicio?',
        a: 'La tarjeta de sellos da uno por visita, con un mínimo de consumo opcional para que un servicio básico no cuente igual que uno completo. Si tus precios varían mucho, el cashback se ajusta mejor.',
      },
      {
        q: '¿Necesito internet en la rampa?',
        a: 'Sí, se registra desde un celular o tablet con conexión. No hace falta ninguna terminal especial.',
      },
    ],
    icon: 'car',
    accent: '#0e5a8a',
    sample: { required: 8, reward: 'Una lavada gratis', rate: 5 },
    metaDescription:
      'Programa de lealtad para autolavados: tarjeta de sellos digital en Apple Wallet y Google Wallet. La lavada gratis siempre a la vista.',
  },
  {
    slug: 'veterinarias',
    plural: 'veterinarias',
    yours: 'tu veterinaria',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'cashback',
    unit: { one: 'visita', many: 'visitas' },
    title: 'Programa de lealtad para veterinarias',
    tagline: 'El alimento lo compran cada mes. Que lo compren contigo.',
    problem: [
      'Una veterinaria vive de dos ingresos muy distintos: la consulta, que es esporádica y cara, y el alimento y los accesorios, que se compran cada mes y se van completos a la tienda en línea que estaba más a la mano.',
      'El cashback pelea justo por esa compra recurrente. Un porcentaje de cada bolsa de alimento vuelve como saldo que sólo se gasta contigo, y eso compite de frente con el precio de internet sin que tengas que bajar el tuyo.',
      'De paso, la tarjeta te da un dato que casi ninguna veterinaria tiene: quién compra alimento cada mes y quién dejó de hacerlo.',
    ],
    pullQuote: 'La consulta es esporádica. El alimento es cada mes.',
    rewardIdeas: [
      '7% de cada compra de vuelta como saldo',
      'Saldo doble en alimento y prevención',
      'Baño de cortesía al llegar a cierto saldo',
      'Bono de bienvenida al registrar a la mascota',
    ],
    faq: [
      {
        q: '¿Puedo separar el saldo de consulta y el de tienda?',
        a: 'El saldo es uno solo por cliente, sobre todo lo que te compra. En la práctica eso conviene: la consulta financia la compra de alimento y viceversa, que es justo lo que quieres.',
      },
      {
        q: '¿Sirve para recordar vacunas?',
        a: 'La tarjeta puede aparecer en la pantalla de bloqueo cuando el cliente pasa cerca de la clínica. Para el calendario clínico como tal necesitas tu propio sistema.',
      },
    ],
    icon: 'paw',
    accent: '#7a4b1f',
    sample: { required: 8, reward: 'Un baño de cortesía', rate: 7 },
    metaDescription:
      'Programa de lealtad con cashback para veterinarias: recupera la compra de alimento con saldo que sólo se gasta contigo. Apple y Google Wallet.',
  },
  {
    slug: 'panaderias',
    plural: 'panaderías',
    yours: 'tu panadería',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'sellos',
    unit: { one: 'compra', many: 'compras' },
    title: 'Tarjeta de sellos digital para panaderías',
    tagline: 'El pan de cada día merece una tarjeta que no se llene de harina.',
    problem: [
      'Una panadería de barrio ya tiene lo más difícil: gente que pasa casi diario. Lo que casi nunca tiene es una forma de saber quiénes son, y una razón para que pasen por tu puerta y no por la de la otra cuadra cuando van con prisa.',
      'Una tarjeta de sellos encaja bien aquí porque la visita es diaria y el ticket es chico: diez compras se juntan en dos semanas, así que el premio se siente cerca desde el primer día.',
      'Y como se llena al cobrar, no hay nada que capturar ni tarjetitas que reponer cuando se acaban.',
    ],
    pullQuote: 'Ya pasan diario. Lo que falta es saber quiénes son.',
    rewardIdeas: [
      'La décima compra, una pieza de cortesía',
      'Sello doble en la última hora del día',
      'Pan dulce gratis en tu cumpleaños',
      'Bolsa de bolillo de cortesía al completar dos tarjetas',
    ],
    faq: [
      {
        q: '¿Funciona si cobro rápido y con fila?',
        a: 'Sí. Si cobras con el POS de RestKit el sello se pone solo al marcar la venta. Si no, se escanea el código del cliente, que toma un segundo y no detiene la fila.',
      },
      {
        q: '¿Puedo pedir una compra mínima?',
        a: 'Sí, hay un mínimo de ticket opcional, para que una pieza suelta no valga lo mismo que una compra completa.',
      },
    ],
    icon: 'croissant',
    accent: '#8a5a1e',
    sample: { required: 10, reward: 'Una pieza de cortesía', rate: 5 },
    metaDescription:
      'Tarjeta de sellos digital para panaderías, en Apple Wallet y Google Wallet. Se llena al cobrar y nunca se pierde. Prueba gratis.',
  },
  {
    slug: 'heladerias',
    plural: 'heladerías',
    yours: 'tu heladería',
    customer: { one: 'cliente', many: 'clientes' },
    mechanic: 'sellos',
    unit: { one: 'nieve', many: 'nieves' },
    title: 'Programa de lealtad para heladerías',
    tagline: 'Que el invierno no te borre la clientela del verano.',
    problem: [
      'Una heladería vive un problema que casi ningún otro giro tiene: seis meses buenos y seis meses flojos. En agosto hay fila y en enero no, y la clientela que construiste en verano simplemente desaparece del mapa.',
      'Una tarjeta a medio llenar es de las pocas cosas que sobrevive esa pausa. Sigue en el teléfono del cliente, y cuando vuelve el calor él ya tiene siete sellos y una razón para volver contigo y no con el de enfrente.',
      'También puedes usarla al revés: sellos dobles en temporada baja, para mover el mes que normalmente no se mueve.',
    ],
    pullQuote: 'Una tarjeta a medio llenar sobrevive al invierno.',
    rewardIdeas: [
      'La décima nieve gratis',
      'Sello doble de lunes a jueves en temporada baja',
      'Topping de cortesía a la mitad de la tarjeta',
      'Nieve gratis en tu cumpleaños',
    ],
    faq: [
      {
        q: '¿Los sellos caducan en temporada baja?',
        a: 'No caducan por defecto, y ahí está la gracia: la tarjeta a medio llenar es justo lo que trae de vuelta al cliente cuando vuelve el calor.',
      },
      {
        q: '¿Puedo dar sellos dobles sólo algunos días?',
        a: 'Ajustas la tarjeta cuando quieras desde el panel; el cambio le llega solo a los clientes que ya la tienen guardada, sin volver a inscribirlos.',
      },
    ],
    icon: 'ice-cream',
    accent: '#b8306a',
    sample: { required: 10, reward: 'Una nieve gratis', rate: 5 },
    metaDescription:
      'Programa de lealtad para heladerías: tarjeta de sellos digital que sobrevive la temporada baja. Apple Wallet y Google Wallet, sin apps.',
  },
  {
    slug: 'nail-spa',
    plural: 'estudios de uñas',
    yours: 'tu estudio',
    customer: { one: 'clienta', many: 'clientas' },
    mechanic: 'sellos',
    unit: { one: 'servicio', many: 'servicios' },
    title: 'Programa de lealtad para nail spa',
    tagline: 'El retoque es cada tres semanas. Asegúralo desde hoy.',
    problem: [
      'Un nail spa tiene una ventaja que pocos giros tienen: la fecha del siguiente servicio es casi predecible. El gel aguanta tres semanas y el retoque va a pasar sí o sí. La única pregunta es contigo o con alguien más.',
      'Una tarjeta de sellos aprovecha exactamente eso. Con una frecuencia tan pareja, ocho servicios se juntan en medio año y el premio siempre se ve alcanzable, así que cambiar de estudio empieza a costar algo.',
      'Y si tu estudio maneja precios muy distintos entre manicure sencillo y diseño completo, puedes cambiar a cashback en un clic sin que nadie pierda lo que ya juntó.',
    ],
    pullQuote: 'El retoque va a pasar. La pregunta es con quién.',
    rewardIdeas: [
      'El octavo servicio gratis',
      'Diseño de cortesía a la mitad de la tarjeta',
      'Sello doble al reagendar antes de salir',
      'Retiro de gel sin costo al completar la tarjeta',
    ],
    faq: [
      {
        q: '¿Sellos o cashback para un nail spa?',
        a: 'Sellos si tus servicios cuestan parecido, porque premian volver. Cashback si vas de un manicure sencillo a un diseño de varios miles, porque premia el gasto. Se cambia desde el panel y el progreso acumulado se respeta.',
      },
      {
        q: '¿Puedo tener la foto de mi estudio en la tarjeta?',
        a: 'Sí. Puedes poner una foto detrás de los sellos, al lado, o como banda propia, además de tu color y tu logo.',
      },
    ],
    icon: 'gem',
    accent: '#7c3aed',
    sample: { required: 8, reward: 'Un servicio gratis', rate: 8 },
    metaDescription:
      'Programa de lealtad para nail spa: tarjeta de sellos o cashback en Apple Wallet y Google Wallet, con tu color, tu logo y tu foto.',
  },
];

export function getVertical(slug: string): Vertical | undefined {
  return VERTICALS.find((v) => v.slug === slug);
}

/** "Programa de lealtad para cafeterías" — the phrase these pages target. */
export function verticalLinkLabel(v: Vertical): string {
  return `Programa de lealtad para ${v.plural}`;
}
