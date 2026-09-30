import { listAtms } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { listStatuses } from "@/lib/statuses";
import { AtmsMapClient } from "./AtmsMapClient";

export const dynamic = "force-dynamic";

export default function AtmsMapPage() {
  const categories = listCategories();
  const statuses = listStatuses();
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const statusById = new Map(statuses.map((s) => [s.id, s.name]));

  const points = listAtms()
    .map((a) => {
      const lat = parseFloat(a.latitude);
      const lon = parseFloat(a.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
      return {
        id: a.id,
        code: a.code || "без ID",
        name: a.name,
        address: a.address,
        lat,
        lon,
        category: a.categoryId ? categoryById.get(a.categoryId) || "" : "",
        status: a.workStatusId ? statusById.get(a.workStatusId) || "" : "",
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const withoutCoords = listAtms().length - points.length;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Карта всех банкоматов</h1>
      <p className="text-sm text-neutral-500 mb-4">
        {points.length} банкоматов на карте
        {withoutCoords > 0 && ` · ${withoutCoords} без координат не показаны`}. Клик по точке — переход в карточку
        банкомата.
      </p>
      <AtmsMapClient points={points} />
    </div>
  );
}
