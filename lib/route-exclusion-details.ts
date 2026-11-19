export interface RouteExcludedAtmDetail {
  atmId: string;
  code: string;
  name: string;
  district: string;
  reason: string;
}

/**
 * Old route snapshots do not contain excludedAtms. Treat missing or malformed
 * persisted values as an empty list so legacy routes remain readable.
 */
export function normalizeRouteExcludedAtms(value: unknown): RouteExcludedAtmDetail[] {
  if (!Array.isArray(value)) return [];
  const normalized: RouteExcludedAtmDetail[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.atmId !== "string" || !row.atmId.trim()) continue;
    if (typeof row.reason !== "string" || !row.reason.trim()) continue;
    const key = `${row.atmId}\u0000${row.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      atmId: row.atmId,
      code: typeof row.code === "string" ? row.code : "",
      name: typeof row.name === "string" ? row.name : "",
      district: typeof row.district === "string" ? row.district : "",
      reason: row.reason,
    });
  }
  return normalized;
}
