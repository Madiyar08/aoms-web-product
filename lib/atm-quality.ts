import type { Atm } from "./atms";

export type AtmQuality = {
  total: number;
  missingCode: number;
  duplicateCodeGroups: number;
  duplicateCodeRecords: number;
  missingRegion: number;
  missingDistrict: number;
  missingAddress: number;
  missingCoordinates: number;
  invalidCoordinates: number;
  missingCategory: number;
  unverifiedAddress: number;
  unverifiedCoordinates: number;
};

export function normalizeAtmIdentifier(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized;
}

export function hasValidCoordinates(latitude: string | null | undefined, longitude: string | null | undefined): boolean {
  if (!latitude?.trim() || !longitude?.trim()) return false;
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function getAtmDataQuality(atms: Atm[]): AtmQuality {
  const identifiers = new Map<string, number>();
  for (const atm of atms) {
    const code = normalizeAtmIdentifier(atm.code);
    if (code) identifiers.set(code, (identifiers.get(code) ?? 0) + 1);
  }
  const duplicateGroups = [...identifiers.values()].filter((count) => count > 1);
  return {
    total: atms.length,
    missingCode: atms.filter((atm) => !normalizeAtmIdentifier(atm.code)).length,
    duplicateCodeGroups: duplicateGroups.length,
    duplicateCodeRecords: duplicateGroups.reduce((sum, count) => sum + count, 0),
    missingRegion: atms.filter((atm) => !atm.region?.trim()).length,
    missingDistrict: atms.filter((atm) => !atm.district?.trim()).length,
    missingAddress: atms.filter((atm) => !atm.address?.trim()).length,
    missingCoordinates: atms.filter((atm) => !atm.latitude?.trim() || !atm.longitude?.trim()).length,
    invalidCoordinates: atms.filter((atm) => Boolean(atm.latitude?.trim() && atm.longitude?.trim()) && !hasValidCoordinates(atm.latitude, atm.longitude)).length,
    missingCategory: atms.filter((atm) => !atm.categoryId).length,
    unverifiedAddress: atms.filter((atm) => !atm.addressVerified).length,
    unverifiedCoordinates: atms.filter((atm) => !atm.coordsVerified).length,
  };
}
