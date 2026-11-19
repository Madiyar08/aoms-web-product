import { insertRow, readAll, updateRow, deleteRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { districtBoundaryKey, resolveBoundaryRegionId } from "./district-boundary-key";
import { pointInPolygon } from "./geometry-polygon";

const TABLE = "district_boundaries";

/** Boundary records are scoped by regionId + district. Missing regionId
 * identifies a legacy record; it is never silently copied to all regions. */
export interface DistrictBoundary extends BaseEntity {
  district: string;
  regionId?: string;
  points: { lat: number; lon: number }[];
}

export function listDistrictBoundaries(): DistrictBoundary[] {
  return readAll<DistrictBoundary>(TABLE);
}

export function getDistrictBoundary(district: string, regionId?: string, regionName?: string): DistrictBoundary | null {
  const rows = listDistrictBoundaries();
  const resolvedRegionId = resolveBoundaryRegionId(regionId, regionName);
  if (resolvedRegionId) {
    return rows.find((b) => districtBoundaryKey(b.regionId, b.district) === districtBoundaryKey(resolvedRegionId, district)) || null;
  }
  return rows.find((b) => !b.regionId && districtBoundaryKey(undefined, b.district) === districtBoundaryKey(undefined, district)) || null;
}

export function saveDistrictBoundary(
  district: string,
  points: { lat: number; lon: number }[],
  regionId?: string,
  regionName?: string
): DistrictBoundary {
  const resolvedRegionId = resolveBoundaryRegionId(regionId, regionName) || undefined;
  const existing = getDistrictBoundary(district, resolvedRegionId);
  if (existing) {
    updateRow<DistrictBoundary>(TABLE, existing.id, { points, regionId: resolvedRegionId, updatedAt: nowIso() });
    return { ...existing, points, regionId: resolvedRegionId, updatedAt: nowIso() };
  }
  const row: DistrictBoundary = {
    id: newId(), createdAt: nowIso(), updatedAt: nowIso(), district,
    ...(resolvedRegionId ? { regionId: resolvedRegionId } : {}), points,
  };
  insertRow(TABLE, row);
  return row;
}

export function deleteDistrictBoundary(district: string, regionId?: string, regionName?: string): boolean {
  const existing = getDistrictBoundary(district, regionId, regionName);
  if (!existing) return false;
  return deleteRow(TABLE, existing.id);
}

export function districtByPolygon(lat: number, lon: number, regionId?: string): string | null {
  const boundaries = listDistrictBoundaries().filter((b) => regionId ? b.regionId === regionId : !b.regionId);
  for (const b of boundaries) {
    if (b.points.length >= 3 && pointInPolygon(lat, lon, b.points)) return b.district;
  }
  return null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function districtByNearestCenter(lat: number, lon: number, regionId?: string): { district: string; distanceM: number } | null {
  const centers = listDistrictBoundaries().filter((b) => (regionId ? b.regionId === regionId : !b.regionId) && b.points.length === 1);
  let best: { district: string; distanceM: number } | null = null;
  for (const c of centers) {
    const d = haversine(lat, lon, c.points[0].lat, c.points[0].lon);
    if (!best || d < best.distanceM) best = { district: c.district, distanceM: Math.round(d) };
  }
  return best;
}
