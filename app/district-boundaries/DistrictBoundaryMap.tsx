"use client";

// БЕЗ ЭТОГО ИМПОРТА карта визуально не работает: контейнер Leaflet не
// получает нужные размеры/позиционирование, тайлы либо не показываются
// вообще, либо съезжают. При этом JS-логика (клик по карте, счётчик
// точек) продолжает работать нормально — отсюда и путающий симптом
// "точка выбрана, а картинки не вижу". Это была единственная причина,
// её и чиним — не архитектурная проблема, а забытая строчка импорта.
import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

interface Point {
  lat: number;
  lon: number;
}

interface Props {
  districts: string[];
  initialBoundaries: Record<string, Point[]>;
  centerLat: number;
  centerLon: number;
}

/**
 * Интерактивная карта: руководитель выбирает район из списка, кликает по
 * карте, чтобы обвести его границу точками, и сохраняет. Один раз
 * нарисованная граница используется системой для точной проверки
 * "банкомат внутри своего района или нет" (см. lib/district-boundaries.ts) —
 * заменяет прежний грубый метод по среднему координат.
 */
export default function DistrictBoundaryMap({ districts, initialBoundaries, centerLat, centerLon }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const polygonLayer = useRef<L.Polygon | null>(null);
  const referenceLayer = useRef<L.Polygon | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const allBoundariesLayer = useRef<L.LayerGroup | null>(null);

  const [selectedDistrict, setSelectedDistrict] = useState(districts[0] || "");
  const [points, setPoints] = useState<Point[]>(initialBoundaries[districts[0]] || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [referencePoints, setReferencePoints] = useState<Point[] | null>(null);
  const [fetchingReference, setFetchingReference] = useState(false);

  // Инициализация карты один раз
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    import("leaflet").then((leaflet) => {
      const Lm = leaflet.default;
      const map = Lm.map(mapRef.current!).setView([centerLat, centerLon], 11);
      Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapInstance.current = map;
      markersLayer.current = Lm.layerGroup().addTo(map);
      allBoundariesLayer.current = Lm.layerGroup().addTo(map);

      map.on("click", (e: L.LeafletMouseEvent) => {
        setPoints((prev) => [...prev, { lat: e.latlng.lat, lon: e.latlng.lng }]);
      });

      redrawAllBoundaries(Lm, map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redrawAllBoundaries(Lm: typeof L, map: L.Map) {
    if (!allBoundariesLayer.current) return;
    allBoundariesLayer.current.clearLayers();
    if (!showAll) return;
    Object.entries(initialBoundaries).forEach(([district, pts]) => {
      if (district === selectedDistrict || pts.length < 3) return;
      const poly = Lm.polygon(
        pts.map((p) => [p.lat, p.lon] as [number, number]),
        { color: "#A9782F", weight: 1, fillOpacity: 0.05 }
      );
      poly.bindTooltip(district, { permanent: false });
      allBoundariesLayer.current!.addLayer(poly);
    });
  }

  // Перерисовка текущего полигона при изменении точек
  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((leaflet) => {
      const Lm = leaflet.default;
      const map = mapInstance.current!;

      if (polygonLayer.current) {
        map.removeLayer(polygonLayer.current);
        polygonLayer.current = null;
      }
      markersLayer.current?.clearLayers();

      points.forEach((p, idx) => {
        const marker = Lm.circleMarker([p.lat, p.lon], {
          radius: 5,
          color: "#B23A48",
          fillColor: "#B23A48",
          fillOpacity: 1,
        });
        marker.bindTooltip(String(idx + 1), { permanent: true, direction: "top", offset: [0, -6] });
        markersLayer.current?.addLayer(marker);
      });

      if (points.length >= 2) {
        polygonLayer.current = Lm.polygon(
          points.map((p) => [p.lat, p.lon] as [number, number]),
          { color: "#16233A", weight: 2, fillOpacity: 0.15 }
        ).addTo(map);
      }
    });
  }, [points]);

  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((leaflet) => redrawAllBoundaries(leaflet.default, mapInstance.current!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll, selectedDistrict]);

  // Эталонная граница из OpenStreetMap — рисуется отдельным пунктирным
  // слоем поверх карты как подсказка, чтобы обводить не по пустому месту.
  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((leaflet) => {
      const Lm = leaflet.default;
      const map = mapInstance.current!;
      if (referenceLayer.current) {
        map.removeLayer(referenceLayer.current);
        referenceLayer.current = null;
      }
      if (referencePoints && referencePoints.length >= 2) {
        referenceLayer.current = Lm.polygon(
          referencePoints.map((p) => [p.lat, p.lon] as [number, number]),
          { color: "#2B6E63", weight: 2, dashArray: "6 6", fillOpacity: 0.05, interactive: false }
        ).addTo(map);
        map.fitBounds(referenceLayer.current.getBounds(), { padding: [20, 20] });
      }
    });
  }, [referencePoints]);

  async function fetchReferenceBoundary() {
    setFetchingReference(true);
    setMessage(null);
    setReferencePoints(null);
    try {
      const res = await fetch("/api/district-boundaries/fetch-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district: selectedDistrict }),
      });
      const data = await res.json();
      if (data.ok) {
        setReferencePoints(data.points);
        setMessage(`Найдена примерная граница (${data.points.length} точек) — зелёным пунктиром на карте. Можно принять как есть или обвести точнее поверх неё.`);
      } else {
        setMessage(data.error || "Не удалось найти границу автоматически. Рисуйте вручную.");
      }
    } catch {
      setMessage("Ошибка сети при запросе к OpenStreetMap.");
    }
    setFetchingReference(false);
  }

  function useReferenceAsIs() {
    if (!referencePoints) return;
    setPoints(referencePoints);
    setReferencePoints(null);
    setMessage("Граница из OpenStreetMap применена — не забудьте сохранить.");
  }

  function handleSelectDistrict(d: string) {
    setSelectedDistrict(d);
    setPoints(initialBoundaries[d] || []);
    setMessage(null);
  }

  function undoLast() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setPoints([]);
  }

  async function save(pointsToSave?: Point[]) {
    const pts = pointsToSave || points;
    if (pts.length === 2) {
      setMessage("2 точки не подходят: либо 1 (центр района), либо 3+ (полигон).");
      return;
    }
    if (pts.length < 1) {
      setMessage("Добавьте хотя бы одну точку — центр района.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/district-boundaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district: selectedDistrict, points: pts }),
      });
      const data = await res.json();
      if (data.ok) {
        initialBoundaries[selectedDistrict] = pts;
        setPoints(pts);
        setMessage(pts.length === 1 ? "Центр района сохранён ✓" : "Граница сохранена ✓");
      } else {
        setMessage(data.error || "Ошибка сохранения");
      }
    } catch {
      setMessage("Ошибка сети");
    }
    setSaving(false);
  }

  // Быстрый способ: вставить координаты, скопированные из Яндекс.Карт
  // (клик по названию района там показывает широту/долготу), вместо
  // трудоёмкого обведения полигона кликами по карте.
  const [quickCoords, setQuickCoords] = useState("");
  async function saveQuickCenter() {
    const parts = quickCoords.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) {
      setMessage("Формат: широта, долгота — например 41.311, 69.279");
      return;
    }
    const [lat, lon] = parts;
    await save([{ lat, lon }]);
  }

  return (
    <div className="flex gap-4">
      <div className="w-64 shrink-0">
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Район</label>
        <select
          value={selectedDistrict}
          onChange={(e) => handleSelectDistrict(e.target.value)}
          className="input w-full mb-3"
        >
          {districts.map((d) => (
            <option key={d} value={d}>
              {d} {initialBoundaries[d]?.length >= 1 ? "✓" : ""}
            </option>
          ))}
        </select>

        <div className="bg-brass-bg border border-brass/30 rounded-lg p-3 mb-4">
          <p className="text-[12px] font-semibold text-ink mb-1">Быстрый способ (рекомендуется)</p>
          <p className="text-[11.5px] text-neutral-600 mb-2">
            Откройте Яндекс.Карты, найдите район, кликните по его названию — появятся широта и долгота.
            Вставьте их сюда через запятую.
          </p>
          <input
            value={quickCoords}
            onChange={(e) => setQuickCoords(e.target.value)}
            placeholder="41.311, 69.279"
            className="input w-full mb-2 !text-[12px]"
          />
          <button
            onClick={saveQuickCenter}
            disabled={saving || !quickCoords.trim()}
            className="w-full text-xs font-semibold bg-brass text-white rounded-md px-3 py-2 disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить как центр района"}
          </button>
          {initialBoundaries[selectedDistrict]?.length === 1 && (
            <p className="text-[11px] text-route mt-2">
              ✓ Центр уже задан: {initialBoundaries[selectedDistrict][0].lat.toFixed(4)},{" "}
              {initialBoundaries[selectedDistrict][0].lon.toFixed(4)}
            </p>
          )}
        </div>

        <details className="mb-3">
          <summary className="text-[12px] text-neutral-500 cursor-pointer mb-2">
            Точный способ: обвести границу на карте (дольше, но точнее)
          </summary>

          <div className="bg-route-bg border border-route/30 rounded-lg p-2.5 mb-3">
            <p className="text-[11.5px] text-ink mb-2">
              Не обязательно обводить с нуля — можно подгрузить примерный контур из OpenStreetMap как подсказку
              (зелёный пунктир на карте), и либо принять его как есть, либо обвести точнее поверх.
            </p>
            <button
              onClick={fetchReferenceBoundary}
              disabled={fetchingReference}
              className="w-full text-xs font-semibold border border-route text-route rounded-md px-3 py-2 bg-white disabled:opacity-50 mb-2"
            >
              {fetchingReference ? "Ищу границу…" : "🔍 Показать примерную границу (авто)"}
            </button>
            {referencePoints && (
              <button
                onClick={useReferenceAsIs}
                className="w-full text-xs font-semibold bg-route text-white rounded-md px-3 py-2"
              >
                Принять эту границу как есть ({referencePoints.length} точек)
              </button>
            )}
          </div>

          <p className="text-[12px] text-neutral-500 my-2">
            Кликайте по карте, чтобы поставить точки границы по порядку обхода (минимум 3). Точки {points.length}.
          </p>
          <div className="flex flex-col gap-2 mb-3">
            <button onClick={undoLast} disabled={points.length === 0} className="text-xs border border-line rounded-md px-3 py-2 bg-white disabled:opacity-40">
              Отменить последнюю точку
            </button>
            <button onClick={clearAll} disabled={points.length === 0} className="text-xs border border-line rounded-md px-3 py-2 bg-white disabled:opacity-40">
              Очистить точки
            </button>
            <button
              onClick={() => save()}
              disabled={saving || points.length < 3}
              className="text-xs font-semibold bg-ink text-white rounded-md px-3 py-2 disabled:opacity-40"
            >
              {saving ? "Сохранение…" : "Сохранить точную границу"}
            </button>
          </div>
        </details>

        <label className="flex items-center gap-2 text-[11.5px] text-neutral-600 mb-3">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Показывать другие нарисованные границы
        </label>

        {message && <div className="text-[12px] bg-neutral-50 rounded-lg p-2">{message}</div>}

        <div className="text-[11px] text-neutral-400 mt-4">
          Задано (центр или граница): {Object.values(initialBoundaries).filter((p) => p.length >= 1).length} из {districts.length}
        </div>
        {(() => {
          const missing = districts.filter((d) => !(initialBoundaries[d]?.length >= 1));
          if (missing.length === 0) return null;
          return (
            <div className="mt-2 bg-brass-bg border border-brass/30 rounded-lg p-2">
              <p className="text-[11px] font-semibold text-ink mb-1">Ещё не заданы ({missing.length}):</p>
              <div className="flex flex-wrap gap-1">
                {missing.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDistrict(d)}
                    className="text-[11px] bg-white border border-line rounded-full px-2 py-0.5 hover:border-brass"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      <div ref={mapRef} className="flex-1 rounded-[10px] border border-line" style={{ height: 560 }} />
    </div>
  );
}
