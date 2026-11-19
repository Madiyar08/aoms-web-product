export interface MonitoringAtmRef {
  id: string;
  region?: string;
  district?: string;
}

export interface MonitoringReportRef {
  atmId?: string;
}

export interface DistrictCompletion {
  key: string;
  region: string;
  district: string;
  cleaned: number;
}

/**
 * Counts distinct reported ATMs by their master-data location, not by the
 * crew's planned districts. A crew can cover several districts in one day;
 * assigning its full KPI/report count to every planned district would
 * multiply the figures and produce misleading district totals.
 */
export function countActualDistrictCompletions(
  reports: MonitoringReportRef[],
  atms: MonitoringAtmRef[],
): DistrictCompletion[] {
  const atmById = new Map(atms.map((atm) => [atm.id, atm]));
  const idsByDistrict = new Map<string, { region: string; district: string; ids: Set<string> }>();

  for (const report of reports) {
    const atmId = (report.atmId || "").trim();
    if (!atmId) continue;
    const atm = atmById.get(atmId);
    const region = (atm?.region || "").trim() || "Регион не указан";
    const district = (atm?.district || "").trim() || "Район не указан";
    const key = atm ? `${region.toLocaleLowerCase("ru").trim()}:${district.toLocaleLowerCase("ru").trim()}` : "unassigned:unknown-atm";
    const existing = idsByDistrict.get(key) || { region, district: atm ? district : "Банкомат отсутствует в справочнике", ids: new Set<string>() };
    existing.ids.add(atmId);
    idsByDistrict.set(key, existing);
  }

  return [...idsByDistrict.entries()]
    .map(([key, value]) => ({ key, region: value.region, district: value.district, cleaned: value.ids.size }))
    .sort((a, b) => a.region.localeCompare(b.region, "ru") || a.district.localeCompare(b.district, "ru"));
}

