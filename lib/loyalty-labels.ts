interface UnitSource {
  settings?: {
    unitSingular?: string;
    unitPlural?: string;
  };
}

export function unitSingular(business: UnitSource): string {
  return business.settings?.unitSingular?.trim() || 'visita';
}

export function unitPlural(business: UnitSource): string {
  return business.settings?.unitPlural?.trim() || 'visitas';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
