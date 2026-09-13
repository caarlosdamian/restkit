/**
 * The stamp icon catalogue.
 *
 * Paths are lifted from lucide (ISC, already a dependency) and stored as raw
 * `d` attributes so the same source draws both the picker in the browser and
 * the PNG strip on the server — one shape, no drift between preview and card.
 *
 * Lucide draws at stroke-width 2 for a 24px box. At stamp size that reads as a
 * thin scratch, so the renderer strokes these at STAMP_STROKE instead.
 */

export const STAMP_STROKE = 2.6;

export type StampCategory =
  | 'bebidas'
  | 'comida'
  | 'postres'
  | 'belleza'
  | 'salud'
  | 'servicios'
  | 'deportes'
  | 'mascotas'
  | 'simbolos';

export const CATEGORY_LABELS: Record<StampCategory, string> = {
  bebidas: 'Bebidas',
  comida: 'Comida',
  postres: 'Postres',
  belleza: 'Belleza',
  salud: 'Salud',
  servicios: 'Servicios',
  deportes: 'Deportes',
  mascotas: 'Mascotas',
  simbolos: 'Símbolos',
};

export interface StampIcon {
  id: string;
  /** Shown in the picker and matched by the search box. */
  label: string;
  category: StampCategory;
  /** Extra Spanish terms an owner might type. */
  keywords?: string[];
  /** SVG path data in a 24×24 viewBox. */
  d: string;
}

export const STAMP_ICONS: StampIcon[] = [
  // ---------------------------------------------------------------- bebidas
  { id: 'coffee', label: 'Café', category: 'bebidas', keywords: ['cafetería', 'taza', 'capuchino'],
    d: 'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1' },
  { id: 'cup-soda', label: 'Refresco', category: 'bebidas', keywords: ['soda', 'vaso', 'bebida'],
    d: 'M6 8h12M6 8l1.5 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2L18 8M6 8l1-5h10l1 5M9 13v5M15 13v5' },
  { id: 'beer', label: 'Cerveza', category: 'bebidas', keywords: ['bar', 'tarro', 'chela'],
    d: 'M17 11h1a3 3 0 0 1 0 6h-1M9 12v6M13 12v6M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 3 11 3s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8' },
  { id: 'wine', label: 'Vino', category: 'bebidas', keywords: ['copa', 'restaurante'],
    d: 'M8 22h8M7 10h10M12 15v7M12 15a5 5 0 0 0 5-5c0-2-.5-4-1-8H8c-.5 4-1 6-1 8a5 5 0 0 0 5 5Z' },
  { id: 'martini', label: 'Coctel', category: 'bebidas', keywords: ['bar', 'copa', 'trago'],
    d: 'M8 22h8M12 11v11M5 3h14l-7 8-7-8Z' },
  { id: 'milk', label: 'Leche', category: 'bebidas', keywords: ['lácteo', 'malteada'],
    d: 'M8 2h8M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0' },

  // ----------------------------------------------------------------- comida
  { id: 'pizza', label: 'Pizza', category: 'comida', keywords: ['pizzería', 'rebanada'],
    d: 'M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16M17 6c-6.29 1.47-9.43 5.13-11 11' },
  { id: 'sandwich', label: 'Sándwich', category: 'comida', keywords: ['torta', 'lonche'],
    d: 'M3 11v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3M12 19H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3.83M3.42 11a1 1 0 0 1-.63-1.63l5.5-6a1 1 0 0 1 .74-.37h5.94a1 1 0 0 1 .74.37l5.5 6a1 1 0 0 1-.63 1.63' },
  { id: 'soup', label: 'Sopa', category: 'comida', keywords: ['caldo', 'fonda', 'menudo'],
    d: 'M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM7 21h10M19.5 12 22 6M16.25 12l1.5-3.5M12 12l2-6M8 12l-1.5-3.5M4.5 12 2 6' },
  { id: 'utensils', label: 'Restaurante', category: 'comida', keywords: ['cubiertos', 'comida', 'menú'],
    d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' },
  { id: 'fish', label: 'Mariscos', category: 'comida', keywords: ['pescado', 'sushi', 'ceviche'],
    d: 'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6ZM18 12v.5M16 17.93a9.77 9.77 0 0 1 0-11.86M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33' },
  { id: 'drumstick', label: 'Pollo', category: 'comida', keywords: ['rostizado', 'asado', 'pierna'],
    d: 'M15.45 15.4c-2.13.65-4.3.32-5.7-1.1-2.29-2.27-1.76-6.5 1.17-9.42 2.93-2.93 7.15-3.46 9.43-1.18 1.41 1.41 1.74 3.57 1.1 5.71-1.4-.5-3.0-.2-4.0.8s-1.3 2.6-.8 4.0Z M11.25 15.6l-2.16 2.16a2.5 2.5 0 1 1-4.56 1.73 2.49 2.49 0 0 1-1.41-4.24 2.5 2.5 0 0 1 3.14-.32l2.16-2.16' },
  { id: 'egg', label: 'Desayuno', category: 'comida', keywords: ['huevo', 'almuerzo'],
    d: 'M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z' },
  { id: 'salad', label: 'Ensalada', category: 'comida', keywords: ['saludable', 'verduras', 'vegano'],
    d: 'M7 21h10M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1M13 12a2.4 2.4 0 0 0-4.77.4' },
  { id: 'apple', label: 'Fruta', category: 'comida', keywords: ['manzana', 'frutería', 'jugo'],
    d: 'M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06ZM10 2c1 .5 2 2 2 5' },
  { id: 'wheat', label: 'Panadería', category: 'comida', keywords: ['pan', 'trigo', 'bolillo'],
    d: 'M2 22 16 8M3.47 12.53l5-5 1.42 1.42a3.5 3.5 0 0 1 0 4.95L8.47 15.3ZM7.71 8.29l1.42-1.42a3.5 3.5 0 0 0 0-4.95L7.71 .5M15.53 12.47l-5 5 1.42 1.42a3.5 3.5 0 0 0 4.95 0l1.42-1.42Z' },

  // ---------------------------------------------------------------- postres
  { id: 'ice-cream', label: 'Helado', category: 'postres', keywords: ['nieve', 'paleta', 'heladería'],
    d: 'M12 22a1 1 0 0 1-.78-.38l-5.5-7A1 1 0 0 1 6.5 13h11a1 1 0 0 1 .78 1.62l-5.5 7A1 1 0 0 1 12 22ZM7 13a5 5 0 0 1 10 0M12 3a3 3 0 0 0-3 3v7M15 6a3 3 0 0 0-3-3' },
  { id: 'cake', label: 'Pastel', category: 'postres', keywords: ['tarta', 'cumpleaños', 'repostería'],
    d: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v2M12 8v2M17 8v2M7 4h.01M12 4h.01M17 4h.01' },
  { id: 'cookie', label: 'Galleta', category: 'postres', keywords: ['dulce', 'postre'],
    d: 'M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01' },
  { id: 'candy', label: 'Dulces', category: 'postres', keywords: ['dulcería', 'caramelo'],
    d: 'M10 7v10.9a1 1 0 0 1-1.7.7l-2-2A2 2 0 0 0 5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1a2 2 0 0 0 1.3-.6l2-2a1 1 0 0 1 1.7.7ZM14 17V6.1a1 1 0 0 1 1.7-.7l2 2A2 2 0 0 0 19 8h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1a2 2 0 0 0-1.3.6l-2 2a1 1 0 0 1-1.7-.7Z' },
  { id: 'donut', label: 'Dona', category: 'postres', keywords: ['rosquilla', 'panadería'],
    d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  { id: 'croissant', label: 'Cuernito', category: 'postres', keywords: ['croissant', 'pan', 'café'],
    d: 'M4.6 13.11l.32-.19c.66-.38 1.48-.31 2.05.18l.9.76a2 2 0 0 0 2.53.02l3.3-2.63a2 2 0 0 1 2.5 0l1.7 1.36M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9M2 17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4Z' },

  // ---------------------------------------------------------------- belleza
  { id: 'scissors', label: 'Peluquería', category: 'belleza', keywords: ['tijeras', 'corte', 'barbería', 'estética'],
    d: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12' },
  { id: 'sparkles', label: 'Uñas', category: 'belleza', keywords: ['manicure', 'nails', 'brillo', 'spa'],
    d: 'm12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287ZM5 3v4M19 17v4M3 5h4M17 19h4' },
  { id: 'spray', label: 'Estética', category: 'belleza', keywords: ['perfume', 'aerosol', 'salón'],
    d: 'M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01M7 22a5 5 0 0 1-5-5V15h10v2a5 5 0 0 1-5 5ZM7 15V9M14 4h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z' },
  { id: 'gem', label: 'Joyería', category: 'belleza', keywords: ['diamante', 'lujo', 'accesorios'],
    d: 'M6 3h12l4 6-10 13L2 9ZM11 3 8 9l4 13 4-13-3-6M2 9h20' },
  { id: 'shirt', label: 'Ropa', category: 'belleza', keywords: ['boutique', 'tienda', 'moda'],
    d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z' },
  { id: 'footprints', label: 'Calzado', category: 'belleza', keywords: ['zapatos', 'zapatería'],
    d: 'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0ZM20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0ZM16 17h4M4 13h4' },

  // ------------------------------------------------------------------ salud
  { id: 'dumbbell', label: 'Gimnasio', category: 'deportes', keywords: ['gym', 'pesas', 'ejercicio', 'fitness'],
    d: 'm6.5 6.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7' },
  { id: 'heart-pulse', label: 'Salud', category: 'salud', keywords: ['clínica', 'consultorio', 'médico'],
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7ZM3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' },
  { id: 'stethoscope', label: 'Consultorio', category: 'salud', keywords: ['doctor', 'médico', 'clínica'],
    d: 'M11 2v2M5 2v2M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1M8 15a6 6 0 0 0 12 0v-3M20 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
  { id: 'tooth', label: 'Dentista', category: 'salud', keywords: ['diente', 'odontología', 'muela'],
    d: 'M12 5.5c-1.5-1.5-3-2-4.5-2A4.5 4.5 0 0 0 3 8c0 3 1 5 1.5 8.5.3 2 .5 4 2 4s1.5-3 2-5c.4-1.6 1-2.5 3.5-2.5s3.1.9 3.5 2.5c.5 2 .5 5 2 5s1.7-2 2-4C20 13 21 11 21 8a4.5 4.5 0 0 0-4.5-4.5c-1.5 0-3 .5-4.5 2Z' },
  { id: 'leaf', label: 'Natural', category: 'salud', keywords: ['orgánico', 'herbolaria', 'vegano'],
    d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' },
  { id: 'pill', label: 'Farmacia', category: 'salud', keywords: ['medicina', 'pastilla', 'botica'],
    d: 'm10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7' },

  // -------------------------------------------------------------- servicios
  { id: 'car', label: 'Autolavado', category: 'servicios', keywords: ['coche', 'taller', 'carro', 'auto'],
    d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 17h6' },
  { id: 'wrench', label: 'Taller', category: 'servicios', keywords: ['mecánico', 'reparación', 'herramienta'],
    d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z' },
  { id: 'shopping-bag', label: 'Tienda', category: 'servicios', keywords: ['abarrotes', 'compras', 'comercio'],
    d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0' },
  { id: 'book', label: 'Librería', category: 'servicios', keywords: ['libro', 'papelería', 'escuela'],
    d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' },
  { id: 'camera', label: 'Fotografía', category: 'servicios', keywords: ['estudio', 'foto', 'cámara'],
    d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
  { id: 'music', label: 'Música', category: 'servicios', keywords: ['bar', 'antro', 'evento'],
    d: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  { id: 'washing-machine', label: 'Lavandería', category: 'servicios', keywords: ['lavado', 'ropa', 'tintorería'],
    d: 'M3 6h3M17 6h.01M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM12 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
  { id: 'home', label: 'Hogar', category: 'servicios', keywords: ['casa', 'inmobiliaria', 'muebles'],
    d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM9 22V12h6v10' },

  // --------------------------------------------------------------- deportes
  // ⚠️ `padel` and `football` are drawn FOR RestKit, not lifted from lucide —
  // the installed version has no ball and no racket of any kind, and pádel is
  // the fastest-growing court sport in Mexico to be missing. They follow the
  // same contract as everything else here: one 24×24 path, stroke only (the
  // renderer sets fill="none"), no shape that collapses at stamp size.
  { id: 'padel', label: 'Raqueta', category: 'deportes', keywords: ['pádel', 'padel', 'tenis', 'squash', 'cancha', 'raqueta'],
    d: 'M12.94 6.09a4.2 5.5 -35 1 0 -6.88 4.82a4.2 5.5 -35 1 0 6.88 -4.82M6.4 10.67 12.6 6.33M6.82 4.67 12.18 12.33M12.66 13l4.02 5.73M15.21 19.76l2.94-2.06' },
  { id: 'football', label: 'Balón', category: 'deportes', keywords: ['fútbol', 'futbol', 'soccer', 'cancha', 'pelota', 'llanero'],
    d: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M12 7.2l4.57 3.32-1.75 5.36H9.18l-1.75-5.36zM12 7.2V2M16.57 10.52l4.94-1.61M14.82 15.88l3.06 4.21M9.18 15.88l-3.06 4.21M7.43 10.52 2.49 8.91' },
  { id: 'trophy', label: 'Torneo', category: 'deportes', keywords: ['trofeo', 'campeón', 'premio', 'copa'],
    d: 'M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978M18 9h1.5a1 1 0 0 0 0-5H18M4 22h16M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zM6 9H4.5a1 1 0 0 1 0-5H6' },
  { id: 'medal', label: 'Medalla', category: 'deportes', keywords: ['logro', 'premio', 'ganador'],
    d: 'M11 12 5.12 2.2M13 12l5.88-9.8M8 7h8M12 12a5 5 0 1 0 0 10 5 5 0 1 0 0-10M12 18v-2h-.5' },
  { id: 'target', label: 'Puntería', category: 'deportes', keywords: ['diana', 'tiro', 'arquería', 'meta'],
    d: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4' },
  { id: 'bike', label: 'Ciclismo', category: 'deportes', keywords: ['bici', 'bicicleta', 'spinning', 'rodada'],
    d: 'M18.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7M5.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7M15 4a1 1 0 1 0 0 2 1 1 0 1 0 0-2M12 17.5V14l-3-3 4-3 2 3h2' },
  { id: 'timer', label: 'Cronómetro', category: 'deportes', keywords: ['tiempo', 'hora', 'reserva', 'clase'],
    d: 'M10 2h4M12 14l3-3M12 6a8 8 0 1 0 0 16 8 8 0 1 0 0-16' },

  // --------------------------------------------------------------- mascotas
  { id: 'paw', label: 'Mascotas', category: 'mascotas', keywords: ['huella', 'veterinaria', 'perro', 'gato'],
    d: 'M11.25 16.25h1.5L12 17ZM16 14v.5M8 14v.5M11.25 16.25c-1 0-2 .5-2 1.75 0 1 .75 2 2 2h1.5c1.25 0 2-1 2-2 0-1.25-1-1.75-2-1.75M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306' },
  { id: 'bone', label: 'Veterinaria', category: 'mascotas', keywords: ['hueso', 'perro', 'pet'],
    d: 'M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z' },
  { id: 'cat', label: 'Gato', category: 'mascotas', keywords: ['felino', 'veterinaria'],
    d: 'M13.5 4.5 12 3l-1.5 1.5M4 8V5l3 1M20 8V5l-3 1M12 21a8 8 0 0 0 8-8V6l-4 2h-8L4 6v7a8 8 0 0 0 8 8ZM9 13v.01M15 13v.01M11 17h2' },
  { id: 'dog', label: 'Perro', category: 'mascotas', keywords: ['canino', 'estética canina'],
    d: 'M11.25 16.25h1.5L12 17ZM16 14v.5M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306M8 14v.5M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.68-.418-3.66-1 .020-.604 1.093-.98 1.362-2.5.107-.605.44-2.5 1.598-2.5 1.5 0 1.5 1.5 3.044 3.5ZM15.5 8.5c.384 1.05 1.083 2.028 2.344 2.5 1.931.722 3.68-.418 3.66-1-.020-.604-1.093-.98-1.362-2.5-.107-.605-.44-2.5-1.598-2.5-1.5 0-1.5 1.5-3.044 3.5Z' },

  // --------------------------------------------------------------- simbolos
  { id: 'star', label: 'Estrella', category: 'simbolos', keywords: ['favorito', 'premio', 'general'],
    d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16Z' },
  { id: 'heart', label: 'Corazón', category: 'simbolos', keywords: ['amor', 'favorito', 'gracias'],
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' },
  { id: 'stamp', label: 'Sello', category: 'simbolos', keywords: ['sellos', 'marca', 'general'],
    d: 'M5 22h14M19.27 14H4.73a2 2 0 0 0-1.98 2.28l.24 1.72a2 2 0 0 0 1.98 1.72h13.06a2 2 0 0 0 1.98-1.72l.24-1.72A2 2 0 0 0 19.27 14ZM8 14v-3a4 4 0 0 1 8 0v3' },
  { id: 'gift', label: 'Regalo', category: 'simbolos', keywords: ['premio', 'obsequio', 'promoción'],
    d: 'M20 12v10H4V12M2 7h20v5H2ZM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z' },
  { id: 'crown', label: 'Corona', category: 'simbolos', keywords: ['vip', 'premium', 'lealtad'],
    d: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294ZM5 21h14' },
  { id: 'ticket', label: 'Boleto', category: 'simbolos', keywords: ['cupón', 'entrada', 'promoción'],
    d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2' },
  { id: 'circle', label: 'Círculo', category: 'simbolos', keywords: ['punto', 'simple', 'clásico'],
    d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z' },
  { id: 'flame', label: 'Flama', category: 'simbolos', keywords: ['picante', 'parrilla', 'asador'],
    d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z' },
  { id: 'sun', label: 'Sol', category: 'simbolos', keywords: ['playa', 'verano', 'terraza'],
    d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' },
  { id: 'map-pin', label: 'Ubicación', category: 'simbolos', keywords: ['sucursal', 'local', 'lugar'],
    d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  { id: 'thumbs-up', label: 'Pulgar', category: 'simbolos', keywords: ['gracias', 'bien', 'like'],
    d: 'M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z' },
  { id: 'zap', label: 'Rayo', category: 'simbolos', keywords: ['rápido', 'energía', 'express'],
    d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14Z' },
];

export function findStampIcon(id: string | undefined): StampIcon {
  return STAMP_ICONS.find((i) => i.id === id) ?? STAMP_ICONS.find((i) => i.id === 'star')!;
}

/** Matches on label and keywords, accent-insensitively — an owner typing
 *  "cafe" should find "Café". */
export function searchStampIcons(query: string): StampIcon[] {
  const q = normalise(query);
  if (!q) return STAMP_ICONS;
  return STAMP_ICONS.filter(
    (i) =>
      normalise(i.label).includes(q) ||
      i.id.includes(q) ||
      (i.keywords ?? []).some((k) => normalise(k).includes(q))
  );
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
