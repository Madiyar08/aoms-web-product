import { listDistinctDistricts, listAtms } from "@/lib/atms";
import { listDistrictBoundaries } from "@/lib/district-boundaries";
import DistrictBoundaryMap from "./DistrictBoundaryMap";

export const dynamic = "force-dynamic";

export default async function DistrictBoundariesPage() {
  const districts = listDistinctDistricts().sort();
  const boundaries = listDistrictBoundaries();
  const initialBoundaries: Record<string, { lat: number; lon: number }[]> = {};
  for (const b of boundaries) initialBoundaries[b.district] = b.points;

  // Центр карты — среднее всех банкоматов, чтобы сразу открывалось в нужном месте
  const atms = listAtms().filter((a) => {
    const lat = parseFloat(a.latitude);
    return !Number.isNaN(lat);
  });
  const centerLat = atms.length ? atms.reduce((s, a) => s + parseFloat(a.latitude), 0) / atms.length : 41.31;
  const centerLon = atms.length ? atms.reduce((s, a) => s + parseFloat(a.longitude), 0) / atms.length : 69.28;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Границы районов</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-3xl">
        Задайте координаты каждого района один раз — система будет точнее проверять, входит ли банкомат в
        свой район, вместо прежнего приблизительного метода (среднее по своим же данным). Быстрый способ —
        вставить координаты центра района, скопированные из Яндекс.Карт (клик по названию района там
        показывает широту и долготу). Для точной границы теперь можно не обводить с нуля — кнопка
        «Показать примерную границу (авто)» подгружает реальный контур района из OpenStreetMap, который
        можно принять как есть или обвести точнее поверх. Пока для района не задано ни то, ни другое —
        банкоматы этого района не проверяются на соответствие, это осознанно, чтобы не исключать из
        маршрута нормальные банкоматы.
      </p>
      <DistrictBoundaryMap
        districts={districts}
        initialBoundaries={initialBoundaries}
        centerLat={centerLat}
        centerLon={centerLon}
      />
    </div>
  );
}
