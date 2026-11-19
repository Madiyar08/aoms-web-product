import { normalizeGeoName, regionIdForName } from "./geography";

export function districtBoundaryKey(regionId: string | undefined, district: string): string {
  const region = (regionId || "").trim();
  return `${region || "legacy"}:${normalizeGeoName(district)}`;
}

export function resolveBoundaryRegionId(regionId?: string, regionName?: string): string {
  return (regionId || "").trim() || regionIdForName(regionName || "") || "";
}
