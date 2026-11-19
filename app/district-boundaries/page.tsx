import { listAtms } from "@/lib/atms";
import { listDistrictBoundaries } from "@/lib/district-boundaries";
import { regionIdForName, UZBEKISTAN_REGIONS } from "@/lib/geography";
import DistrictBoundaryMap from "./DistrictBoundaryMap";

export const dynamic = "force-dynamic";

export default async function DistrictBoundariesPage() {
  const atms = listAtms();
  const boundaries = listDistrictBoundaries();
  const regionMap = new Map<string, { id: string; name: string; districts: string[] }>();
  for (const atm of atms) {
    if (!atm.district) continue;
    const regionId = atm.regionId || regionIdForName(atm.region || "") || "legacy";
    const regionName = regionId === "legacy"
      ? "Регион не указан (старые записи)"
      : UZBEKISTAN_REGIONS.find((r) => r.id === regionId)?.name || atm.region || regionId;
    const entry = regionMap.get(regionId) || { id: regionId, name: regionName, districts: [] };
    if (!entry.districts.includes(atm.district)) entry.districts.push(atm.district);
    regionMap.set(regionId, entry);
  }
  // Keep boundary-only regions visible too, so previously saved contours can be edited.
  for (const boundary of boundaries) {
    const regionId = boundary.regionId || "legacy";
    if (!regionMap.has(regionId)) {
      const regionName = regionId === "legacy" ? "Регион не указан (старые записи)" : UZBEKISTAN_REGIONS.find((r) => r.id === regionId)?.name || regionId;
      regionMap.set(regionId, { id: regionId, name: regionName, districts: [] });
    }
    const entry = regionMap.get(regionId)!;
    if (!entry.districts.includes(boundary.district)) entry.districts.push(boundary.district);
  }
  const regions = [...regionMap.values()].map((r) => ({ ...r, districts: r.districts.sort() })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const initialBoundaries: Record<string, { lat: number; lon: number }[]> = {};
  for (const b of boundaries) initialBoundaries[`${b.regionId || "legacy"}:${b.district}`] = b.points;

  const located = atms.filter((a) => Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude)) && a.latitude !== "" && a.longitude !== "");
  const centerLat = located.length ? located.reduce((s, a) => s + Number(a.latitude), 0) / located.length : 41.31;
  const centerLon = located.length ? located.reduce((s, a) => s + Number(a.longitude), 0) / located.length : 69.28;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Границы районов</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-3xl">
        Выберите регион, затем район. Границы одноимённых районов в разных регионах сохраняются независимо.
        Старые записи без региона вынесены в отдельную группу и не назначаются автоматически.
      </p>
      <DistrictBoundaryMap regions={regions} initialBoundaries={initialBoundaries} centerLat={centerLat} centerLon={centerLon} />
    </div>
  );
}
