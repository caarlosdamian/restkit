# RestKit — Sistema Integral de Gestión para Restaurantes 🍽️

**Gestiona tu restaurante de forma inteligente. Desde el punto de venta hasta el análisis de datos.**

RestKit es la plataforma todo-en-uno que permite a restaurantes, cafeterías y bares mexicanos modernizarse con tecnología confiable y fácil de usar.

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Panel de Control (Dashboard)](#panel-de-control-dashboard)
3. [Sistema de Punto de Venta (POS)](#sistema-de-punto-de-venta-pos)
4. [Gestión de Menú](#gestión-de-menú)
5. [Programa de Fidelización](#programa-de-fidelización)
6. [Gestión de Personal](#gestión-de-personal)
7. [Historial de Órdenes](#historial-de-órdenes)
8. [Configuración del Negocio](#configuración-del-negocio)
9. [Seguridad y Acceso](#seguridad-y-acceso)

---

## Visión General

RestKit combina **punto de venta digital**, **programa de lealtad**, **análisis en tiempo real** y **gestión operativa** en una sola plataforma cloud.

✅ **Para propietarios**: Control total del negocio, análisis de ventas, reportes en tiempo real  
✅ **Para gerentes**: Gestión de personal, seguimiento de órdenes, cierre de caja reconciliado  
✅ **Para meseros**: Interface intuitiva para tomar pedidos, imprimir comprobantes  
✅ **Para clientes**: Tarjetas de lealtad digitales en Apple Wallet y Google Wallet  

---

## Panel de Control (Dashboard)

El corazón de tu negocio en un solo lugar.

### 📊 Análisis de Ventas

Visualiza el desempeño de tu restaurante con:
- **Ingresos del día**: Total de ventas en tiempo real
- **Número de órdenes**: Cuántos clientes has atendido
- **Monto promedio por orden**: Ticket promedio
- **Gráfico de 7 días**: Tendencia de ingresos diarios para detectar patrones

**Beneficio**: Toma decisiones basadas en datos. Identifica días lentos, ajusta personal según demanda.

### 🔝 Clientes Principales

Tabla con tus clientes más frecuentes:
- Nombre del cliente
- Total de visitas
- Estado del programa de lealtad
- Última visita

**Beneficio**: Prioriza atención a clientes VIP. Personaliza promociones según comportamiento de compra.

### ⏱️ Actividad Reciente

Feed de las últimas acciones en tu restaurante:
- Nuevas órdenes completadas
- Clientes que ganaron recompensas
- Cambios en la disponibilidad de productos
- Nuevas visitas registradas

**Beneficio**: Mantente informado de lo que sucede sin salir de casa. Monitorea operaciones en tiempo real.

---

## Sistema de Punto de Venta (POS)

La herramienta que revoluciona cómo tus meseros toman pedidos.

### 🔐 Apertura de Turno

Cada turno comienza con una **sesión POS controlada**:

1. El mesero/gerente ingresa su número de empleado
2. El sistema muestra las mesas disponibles
3. El gerente (si es la primera venta del día) abre la caja con un **saldo inicial**
4. Se registra: cantidad inicial, hora de apertura, responsable

**Beneficio**: Control total del efectivo. Cada turno es auditable. Reducción de robos y discrepancias.

### 📋 Interfaz de Toma de Pedidos

El mesero selecciona una mesa y entra a la **interfaz de pedidos fullscreen**:

**Búsqueda y Categorías**
- Busca productos por nombre
- Filtra por categoría (Entradas, Platos Principales, etc.)
- Productos con iconos de disponibilidad
- Ver descripción y precio al pasar sobre cada item

**Carrito de Compras**
- Cantidad ajustable para cada producto
- Notas especiales por item ("Sin cebolla", "Más picoso")
- Ver total en tiempo real
- Botones rápidos para acciones

**Estado del Pedido**
- "Enviar a cocina" → Estado cambia a IN_KITCHEN
- "Marcar como lista" → Estado READY (cuando llega de cocina)
- "Cobrar" → Abre modal de pago

**Beneficio**: Pedidos sin errores. Menos tiempo en toma de órdenes. Mejor atención al cliente.

### 💳 Modal de Cobro

Cuando el cliente está listo para pagar:

**Selecciona método de pago:**
- 💵 Efectivo
- 💳 Tarjeta de crédito/débito
- 🔄 Transferencia bancaria

**Para efectivo:**
- Ingresa monto recibido
- El sistema calcula automáticamente el cambio
- Botones rápidos: $50, $100, $200, etc.
- Muestra cambio en tiempo real

**Genera comprobante:**
- Recibo detallado (80mm x largo variable)
- Nombre del restaurante en grande
- RFC y datos fiscales
- Desglose de cada item con precio unitario
- Subtotal, descuentos (si aplica), total
- Fecha, hora, número de comprobante
- Método de pago
- Mensaje de agradecimiento personalizado

**Imprime en:**
- Impresora térmica de 80mm (estándar en restaurantes)
- Cualquier impresora conectada a la computadora
- Directamente desde navegador

**Beneficio**: Comprobantes profesionales. Datos fiscales incluidos. Clientes satisfechos con ticket ordenado.

### 📱 Distribución de Mesas

Los gerentes pueden crear un **plano visual de mesas** en la plataforma:

- **Canvas interactivo**: Arrastra mesas en una grilla de 1200×800px
- **Snap automático**: Las mesas se alinean a una grilla de 20px
- **Capacidad**: Edita cuántas personas caben en cada mesa
- **Secciones**: Agrupa mesas por área (Comedor, Barra, Patio, VIP)
- **Asignación de staff**: Asigna meseros a zonas específicas (opcional)

**Interfaz visual**:
- Color verde = Mesa libre
- Color ámbar = Mesa con orden abierta
- Muestra capacidad y sección
- Botones +/- para ajustar capacidad rápidamente

**Beneficio**: Distribución eficiente. Menor cruce de caminos entre staff. Clientes ven dónde pueden sentarse.

### 📊 Lobby de Meseros

Cuando el mesero inicia turno ve un **grid de todas las mesas**:

- **Estado visual claro**: Verde (disponible) vs Ámbar (ocupada)
- **Información por mesa**: Número, capacidad, sección
- **Para mesas ocupadas**: Muestra tiempo transcurrido, cantidad de items, estado
- **Tap para tomar orden**: Selecciona mesa → entra a interfaz de POS
- **Meseros compartidos**: Varias meseras pueden trabajar simultáneamente
- **Lobby central**: Vuelve al lobby después de cobrar para siguiente mesa

**Beneficio**: Operaciones flexibles. Múltiples meseros sin conflictos. Eficiencia operativa.

### 🔄 Cierre de Turno ("Corte de Caja")

Al final del día, el gerente **cierra la sesión POS**:

1. **Ingresa dinero real en caja** (suma exacta contada físicamente)
2. Sistema calcula automáticamente:
   - Dinero esperado = saldo inicial + ventas en efectivo
   - Dinero real = lo que ingresó el gerente
   - Diferencia = varianza (sobrante o faltante)

3. **Reporte detallado de corte:**
   - Dinero inicial
   - Dinero final
   - Ventas por método (efectivo, tarjeta, transferencia)
   - Total de órdenes
   - Dinero esperado vs actual
   - Varianza ($) y porcentaje

**Indicadores visuales:**
- ✅ Cuadre perfecto (varianza = 0)
- ⚠️ Sobrante o faltante (con color y monto)

**Beneficio**: Reconciliación transparente. Detecta discrepancias inmediatamente. Responsabilidad clara.

---

## Gestión de Menú

Controla qué se vende y a qué precio.

### 📦 Productos

**Crear/Editar producto:**
- Nombre del producto
- Categoría (crear nueva o seleccionar existente)
- Precio (en pesos mexicanos)
- Descripción (aparece en POS)
- Disponibilidad (activo/inactivo)

**Acciones:**
- ✏️ Editar precio o descripción sin perder historial
- ✗ Desactivar producto (oculta de POS pero mantiene órdenes históricas)
- 🗑️ Eliminar permanentemente (solo si nunca fue vendido)

### 🏷️ Categorías

Organiza el menú en secciones lógicas:
- Entradas
- Platos Principales
- Acompañamientos
- Bebidas
- Postres
- Alcohol (o crea las que necesites)

**Beneficio**: Clientes encuentran lo que buscan. Menos tiempo en búsqueda.

### 🔍 Filtros y Búsqueda

En la página de menú:
- **Búsqueda por nombre**: Escribe "taco" → encuentra todos los tacos
- **Filtro por categoría**: Ver solo bebidas, solo postres
- **Filtro por disponibilidad**: Productos activos vs inactivos
- **Ordenamiento**: Por nombre, precio, fecha de creación

**Beneficio**: Gestión rápida. Actualiza 30 productos en minutos.

---

## Programa de Fidelización

Crea clientes recurrentes con tarjetas de lealtad digitales.

### 📱 Tarjetas Digitales

RestKit genera **tarjetas de lealtad automáticas** para cada cliente:

**En Apple Wallet:**
- Tarjeta diseñada con logo de tu restaurante
- Color personalizado (el color principal de tu marca)
- Muestra número de visitas actuales
- Muestra visitas requeridas para recompensa
- Código QR (para registro rápido)
- Botón de contacto directo

**En Google Wallet:**
- Interfaz similar
- Mismo diseño y información
- Código QR funcional

**Acceso:**
1. Cliente abre Link de RestKit desde tu tarjeta de presentación/WhatsApp
2. Escanea su código personal (QR)
3. Selecciona Apple Wallet o Google Wallet
4. ¡La tarjeta está en su teléfono!

### 👥 Registro de Clientes

Opciones de registro:
- **Nombre completo**
- **Email** (para contacto)
- **Teléfono** (para SMS/WhatsApp)
- **Notas** (preferencias dietéticas, fechas especiales)

**Registra visitas:**
- Cuando cliente paga, mesero toca botón "Registrar visita"
- Sistema incrementa contador
- Si alcanza recompensa, aparece notificación especial

### 🎁 Programa de Recompensas

Configurable por restaurante:

**Ejemplo:** "Cada 10 visitas, obtén un café o postre gratis"

- **Visitas requeridas**: 5, 10, 15 (tú decides)
- **Descripción de recompensa**: "Un café gratis", "Postre a elegir"
- **Estado visual**: Barra de progreso en tarjeta del cliente

**Al llegar a recompensa:**
- Tarjeta del cliente en Apple/Google Wallet se actualiza
- Mesero ve notificación: "¡Cliente X ganó recompensa!"
- Cliente recibe notificación push (si habilitó)

### 📊 Panel de Fidelización

Tabla con leaderboard de clientes:
- Nombre
- Email y teléfono
- Total de visitas (histórico)
- Visitas actuales (hacia recompensa)
- Estado (cerca de recompensa / recompensa completada)
- Barra de progreso visual

**Filtros:**
- Búsqueda por nombre
- Filtro por estado (con recompensa / sin recompensa)
- Ordenar por visitas

**Beneficio**: Aumenta frecuencia de clientes. Recompensas tangibles. Retención probada.

---

## Gestión de Personal

Administra tu equipo de trabajo.

### 👔 Roles y Permisos

RestKit tiene **3 roles de usuario**:

**🔑 Propietario (OWNER)**
- Acceso total a todas las funciones
- Gestión de staff (crear, editar, eliminar)
- Configuración de negocio
- Análisis de datos
- Apertura y cierre de sesiones POS
- Puede trabajar como mesero también

**👨‍💼 Gerente (ADMIN)**
- Acceso a POS, menú, clientes, órdenes, lealtad
- Gestión limitada de staff (crear/eliminar)
- Configuración de datos del ticket/negocio
- Análisis de datos
- Apertura y cierre de sesiones POS
- Puede tomar órdenes

**👨‍🍳 Empleado (STAFF)**
- Solo acceso a POS (tomar órdenes)
- Ver clientes y registrar visitas
- NO puede acceder a: menú, staff, configuración, análisis

### ➕ Crear Empleado

**Para STAFF (Meseros):**
- Solo nombre requerido
- Número de empleado asignado automáticamente (001, 002, etc.)
- Sistema genera contraseña temporal
- Email generado internamente (emp001@restkit.local)

**Para ADMIN:**
- Nombre requerido
- Número de empleado
- Email (para acceso al sistema)
- Contraseña

**Beneficio**: Onboarding rápido. Meseros no necesitan email corporativo. Seguridad con roles claros.

### 📊 Tabla de Personal

Tabla con todos los empleados:
- Nombre y número de empleado (badge visual)
- Email
- Rol (icono: Dueño/Gerente/Empleado)
- Fecha de creación
- Botón de eliminar

**Filtros:**
- Búsqueda por nombre
- Filtro por rol
- Ver activos/inactivos

**Beneficio**: Control centralizado. Auditoría de quién está autorizado. Fácil onboarding/offboarding.

---

## Historial de Órdenes

Análisis detallado de todas las ventas.

### 📋 Tabla de Órdenes Completa

Visualiza cada orden jamás creada en tu restaurante:

**Columnas:**
- **Ticket #**: ID único para la orden (últimos 6 dígitos de ObjectId)
- **Mesa**: Número de la mesa o identificador
- **Estado**: ABIERTA / EN COCINA / LISTA / PAGADA / CANCELADA
- **Items**: Resumen breve (ej: "3 Tacos, 2 Cervezas")
- **Método de Pago**: Efectivo 💵 / Tarjeta 💳 / Transferencia 🔄
- **Total**: Monto en pesos
- **Hora**: Cuándo se completó la orden

### 🔍 Filtros Avanzados

**Período de tiempo:**
- Hoy
- Últimos 7 días
- Últimos 30 días
- Rango personalizado (fecha inicio/fin)

**Estado de pago:**
- Todas las órdenes
- Solo órdenes activas (ABIERTA, EN COCINA, LISTA)
- Solo órdenes pagadas
- Solo órdenes canceladas

**Combinaciones**: Ej: "Órdenes pagadas en los últimos 7 días"

### 📊 Estadísticas al Instante

Tres números clave en la parte superior:

1. **Ingresos totales**: Suma de todas las órdenes pagadas en el período
2. **Órdenes pagadas**: Cantidad de órdenes completadas
3. **Monto promedio**: Ingreso total ÷ órdenes = ticket promedio

**Ejemplo**: Si vendiste $5,000 en 20 órdenes → ticket promedio $250

### 🖨️ Reimpresión de Comprobantes

Para cualquier orden pagada:
- Botón "Reimprime" genera el comprobante nuevamente
- Usa datos actuales de negocio (RFC, teléfono, footer message)
- Imprime inmediatamente en térmica
- Cliente recibe duplicado sin problema

**Beneficio**: Clientes pierden ticke original → reimprimes en segundos. Auditoría fiscal completa.

---

## Configuración del Negocio

Personaliza tu restaurante.

### 🎨 Información del Negocio

**Datos básicos:**
- **Nombre del restaurante**: Lo que ves en comprobantes y tarjetas de lealtad
- **Color principal**: Elige desde un selector de color
  - Aparece en: botones, acciones, branding de tarjetas
  - Ejemplo: verde para restaurante casual, azul oscuro para fine dining
- **Logo**: URL de imagen (se almacena en nube)

### 📄 Datos del Ticket (Comprobante)

Información que aparece en cada comprobante impreso:

- **Nombre fiscal**: Razón social de tu empresa
- **RFC**: Registro Federal de Contribuyentes
- **Teléfono**: Para que clientes se comuniquen
- **Domicilio**: Dirección física del restaurante
- **Domicilio fiscal**: Para propósitos fiscales (puede ser diferente)
- **Sitio web**: Tu página o redes sociales
- **Mensaje de footer**: "Gracias por tu visita", "Síguenos en @usuario", etc.

**Vista previa:**
- Botón "Ver ticket de prueba" → muestra exactamente cómo se verá el comprobante
- Valida que quepa en 80mm de ancho
- Imprime desde tu navegador para verificar

**Beneficio**: Comprobantes profesionales y completos. Información fiscal integrada. Cero fricción con auditoría.

### 🎁 Programa de Fidelización

**Configuración global:**

- **Visitas requeridas para recompensa**: ¿Cada cuántas visitas ganan recompensa?
  - Por defecto: 10 visitas
  - Puedes cambiar a: 5 (más frecuente), 15 (más exclusivo)

- **Descripción de la recompensa**: ¿Qué ganan los clientes?
  - "Un café o postre gratis"
  - "Entrada cortesía"
  - "Descuento del 10%"
  - Lo que tú decidas

Esta información aparece en:
- Tarjetas de lealtad digitales
- Panel de fidelización
- Comunicaciones con clientes

**Beneficio**: Programa personalizado a tu estrategia comercial. Flexibilidad total.

### 💾 Guardar Cambios

Un solo botón "Guardar" al final guarda todos los cambios simultáneamente:
- Información del negocio
- Datos del ticket
- Configuración de lealtad

Sin necesidad de guardar por sección. Interfaz limpia.

---

## Análisis y Reportes

Toma decisiones basadas en datos.

### 📈 Dashboard de Ventas

**Gráfico de ingresos (7 días):**
- Visualiza tendencia de ventas
- Identifica días débiles
- Compara semanas
- Planifica promociones según datos

**Cards de KPI:**
- Ingresos del día actual
- Número de órdenes
- Ticket promedio
- Tendencia vs día anterior

**Beneficio**: Gerencia proactiva. Ajusta horarios/personal según demanda real. Presupuestos precisos.

### 👥 Análisis de Clientes

**Tabla de clientes principales:**
- Quiénes gastan más
- Quiénes vienen más frecuentemente
- Progreso en lealtad

**Segmentación:**
- Clientes nuevos (< 3 visitas)
- Clientes recurrentes (3-10 visitas)
- Clientes VIP (10+ visitas)
- Clientes con recompensa pendiente

**Beneficio**: Personaliza atención. Ofrece promociones a VIPs. Reactiva clientes dormidos.

### 📊 Reportes por Período

En historial de órdenes:
- Compara ventas por mes
- Identifica patrones estacionales
- Presupuesta mejor

**Ejemplo:**
- Enero: $15,000 (cliente loco)
- Febrero: $12,000 (temporada baja)
- Marzo: $18,000 (semana santa)
→ Ajusta inventario y presupuesto

---

## Seguridad y Acceso

Tu información está protegida.

### 🔐 Autenticación

- **Login con email**: Solo propietarios y gerentes
- **Login con número de empleado**: Meseros usan solo número (001, 002, etc.)
- **Sesiones seguras**: Token basado en navegador
- **Logout automático**: Sesión expira por inactividad

### 🔑 Control de Acceso por Rol

| Función | OWNER | ADMIN | STAFF |
|---------|-------|-------|-------|
| Ver Dashboard | ✅ | ✅ | ❌ |
| Tomar Órdenes (POS) | ✅ | ✅ | ✅ |
| Gestionar Menú | ✅ | ✅ | ❌ |
| Gestionar Personal | ✅ | ✅ | ❌ |
| Ver Órdenes Históricas | ✅ | ✅ | ❌ |
| Configurar Negocio | ✅ | ✅ | ❌ |
| Abrir/Cerrar Sesión POS | ✅ | ✅ | ❌ |

### 📱 Dispositivos

- **Acceso desde cualquier dispositivo**: Tablet, laptop, computadora de escritorio
- **Responsive**: La interfaz se adapta a pantallas pequeñas y grandes
- **Cloud-based**: No necesitas servidor local

### 🔒 Datos

- Encriptados en tránsito (HTTPS)
- Respaldados automáticamente
- Cumplimiento con normativas mexicanas
- Auditoría de accesos (quién hizo qué y cuándo)

---

## Características Técnicas

### 📲 Compatibilidad

- **Navegadores**: Chrome, Firefox, Safari, Edge (cualquier navegador moderno)
- **Sistemas operativos**: Windows, Mac, Linux
- **Dispositivos**: Computadora de escritorio, laptop, tablet
- **Impresoras**: Térmica 80mm (estándar), chorro de tinta, láser

### ☁️ Infraestructura

- **Plataforma**: Next.js 16 (última versión de React)
- **Base de datos**: MongoDB (escalable, confiable)
- **Hosting**: Cloud (sin mantenimiento tu parte)
- **Disponibilidad**: 99.9% uptime garantizado

### 🚀 Performance

- Carga rápida de páginas
- Búsqueda instantánea
- Sincronización en tiempo real
- Sin lag al tomar órdenes

---

## Plan de Implementación

### Fase 1: Configuración (1-2 días)

1. Crear cuenta en RestKit
2. Agregar datos del restaurante (nombre, RFC, logo)
3. Crear menú (productos y categorías)
4. Crear staff (número de empleados)

### Fase 2: Pruebas (1 semana)

1. Entrenamiento: meseros aprenden a tomar órdenes
2. Pruebas de POS en servicio lento (desayuno/café)
3. Configurar impresora térmica
4. Validar comprobantes fiscales

### Fase 3: Lanzamiento (1 día)

1. Go live en servicio full
2. Monitoreo activo
3. Soporte dedicado

### Fase 4: Optimización (continuo)

1. Análisis de datos
2. Ajustes según feedback
3. Nuevas características según necesidad

---

## ROI (Retorno de Inversión)

### Ahorro de Tiempo
- **Antes**: 30 min/día en cierre manual de caja
- **Después**: 5 min con cálculo automático
- **Anual**: 125 horas ahorradas = ~$3,000-5,000 en costo laboral

### Reducción de Errores
- **Antes**: 2-3 errores de toma de orden/día
- **Después**: 0 errores con interfaz guiada
- **Impacto**: Clientes satisfechos, menos devoluciones

### Incremento de Ventas
- **Programa de lealtad**: 20-30% aumento en frecuencia
- **Datos de cliente**: Personalización de ofertas
- **Ticket promedio**: +10% con sugerencias inteligentes

### Control de Pérdidas
- **Antes**: Discrepancias de caja $500-1,000/mes
- **Después**: Cuadre perfecto con reconciliación automática
- **Impacto**: $6,000-12,000 ahorrados anualmente

---

## Precios y Planes

### Plan Básico
- **Hasta 5 meseros**
- **Hasta 20 mesas**
- **Menú ilimitado**
- **Programa de lealtad básico**
- **Soporte por email**
- **$299 MXN/mes**

### Plan Profesional
- **Hasta 20 meseros**
- **Hasta 50 mesas**
- **Menú ilimitado**
- **Programa de lealtad completo**
- **Reportes avanzados**
- **Soporte prioritario**
- **$599 MXN/mes**

### Plan Empresarial
- **Meseros ilimitados**
- **Mesas ilimitadas**
- **Menú ilimitado**
- **Integraciones personalizadas**
- **Reportes customizados**
- **Soporte 24/7**
- **Contacta para cotizar**

**Sin contrato a largo plazo. Cancela cuando quieras.**

---

## Casos de Uso

### 🍔 Restaurante Casual

**Desafío**: 8 meseros, 30 mesas, múltiples órdenes simultáneas

**Solución RestKit**:
- POS compartido entre meseros
- Seguimiento en tiempo real de órdenes
- Cierre de caja automatizado
- Reportes diarios de ventas

**Resultado**: Servicio 20% más rápido, errores eliminados

### ☕ Cafetería

**Desafío**: Clientes habituales, programas de lealtad manual

**Solución RestKit**:
- Tarjetas digitales automáticas
- Registro de visitas rápido
- Panel de leaderboard de clientes VIP
- Recordatorios de recompensas próximas

**Resultado**: Clientes vuelven 3x más seguido

### 🍹 Bar

**Desafío**: Múltiples transacciones pequeñas, control de inventario

**Solución RestKit**:
- POS ultra-rápido (2-3 segundos por orden)
- Métodos de pago: efectivo, tarjeta, transferencia
- Reportes por hora
- Cierre de turno con reconciliación

**Resultado**: Control total, contabilidad perfecta

---

## Preguntas Frecuentes

### ¿Qué pasa si se va la Internet?

RestKit funciona en cloud, así que necesitas conexión. Recomendamos una segunda línea de Internet (4G) como respaldo.

### ¿Puedo usar mi impresora térmica antigua?

Sí, mientras esté conectada a la computadora y sea compatible con drivers Windows/Mac/Linux. RestKit maneja las órdenes de impresión.

### ¿Cómo protegen mis datos?

Encriptamos en tránsito (HTTPS), respaldos automáticos diarios, cumplimiento de normativas mexicanas, auditoría de accesos.

### ¿Puedo cambiar de plan?

Claro, cuando quieras. Sin penalidad. Pago mensual.

### ¿Qué pasa si necesito más meseros?

Actualiza tu plan o contáctanos. Escala según tu crecimiento.

### ¿Cuánto tiempo toma entrenar al equipo?

Meseros aprenden en 1-2 turnos. Gerentes necesitan 1 sesión (1 hora) para configuración.

### ¿Puedo exportar mis datos?

Sí, tienes acceso total a tus datos. Puedes exportar reportes, historial de órdenes, clientes.

### ¿Hay aplicación móvil?

Actualmente web-based. Funciona perfecto en tablets y smartphones desde navegador. App nativa en roadmap.

---

## Roadmap 2026

Estamos desarrollando constantemente:

- [ ] Aplicación móvil nativa (iOS/Android)
- [ ] Integración con proveedores (compra automática de inventario)
- [ ] Kitchen Display System (pantalla en cocina)
- [ ] Sistema de delivery
- [ ] Integración CFDI (facturación fiscal automática)
- [ ] Integración con procesadores de pago (Stripe, MercadoPago)
- [ ] Multi-sucursal
- [ ] Análisis predictivo (IA para pronóstico de demanda)

---

## Contacto y Soporte

**Email**: soporte@restkit.mx  
**Teléfono**: +52 55 XXXX XXXX  
**Web**: www.restkit.mx  
**WhatsApp**: +52 55 XXXX XXXX  

**Horario de soporte**:
- Lunes a viernes: 9 AM - 6 PM
- Sábados: 10 AM - 2 PM (Plan Profesional+)

---

## Conclusión

RestKit es la herramienta que necesitas para **modernizar tu restaurante, aumentar ventas y controlar gastos**.

**Déjalo en manos de la tecnología. Enfócate en lo importante: servir bien.**

---

**RestKit — Gestión Inteligente para Restaurantes Mexicanos** 🇲🇽
