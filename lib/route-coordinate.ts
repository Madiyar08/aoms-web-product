/** Coordinate guard for route generation. AOMS currently operates in Uzbekistan. */
export const UZBEKISTAN_ROUTE_BOUNDS = {
  minLatitude: 37.0,
  maxLatitude: 45.6,
  minLongitude: 55.9,
  maxLongitude: 73.2,
} as const;

export function isValidRouteCoordinate(latitude: unknown, longitude: unknown): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return false;
  const lat = typeof latitude === "number" ? latitude : Number(String(latitude).trim());
  const lon = typeof longitude === "number" ? longitude : Number(String(longitude).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= UZBEKISTAN_ROUTE_BOUNDS.minLatitude
    && lat <= UZBEKISTAN_ROUTE_BOUNDS.maxLatitude
    && lon >= UZBEKISTAN_ROUTE_BOUNDS.minLongitude
    && lon <= UZBEKISTAN_ROUTE_BOUNDS.maxLongitude;
}
