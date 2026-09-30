"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type L from "leaflet";

interface AtmPoint {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string;
  status: string;
}

/**
 * Карта всех банкоматов базы — простые лёгкие маркеры (circleMarker, не
 * тяжёлые иконки), клик по точке ведёт в карточку банкомата
 * (/atms/[id]). Тысяча точек рендерится нормально в Leaflet без
 * дополнительной библиотеки кластеризации — она не нужна для рабочего
 * инструмента руководителя, только для карт с постоянным зумом на весь
 * мир.
 */
export function AtmsMapClient({ points }: { points: AtmPoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!mapRef.current || mapInstance.current || points.length === 0) return;
    import("leaflet").then((leaflet) => {
      const Lm = leaflet.default;
      const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const centerLon = points.reduce((s, p) => s + p.lon, 0) / points.length;
      const map = Lm.map(mapRef.current!).setView([centerLat, centerLon], 11);
      Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapInstance.current = map;

      const layer = Lm.layerGroup().addTo(map);
      for (const p of points) {
        const marker = Lm.circleMarker([p.lat, p.lon], {
          radius: 6,
          color: "#16233A",
          weight: 1,
          fillColor: "#A9782F",
          fillOpacity: 0.8,
        });
        // Popup при клике не имел бы смысла — клик сразу уводит в
        // карточку. Вместо него — подсказка при наведении, чтобы понять,
        // какая это точка, прежде чем нажимать.
        marker.bindTooltip(`${p.code} — ${p.name}`, { direction: "top" });
        marker.on("click", () => router.push(`/atms/${p.id}`));
        layer.addLayer(marker);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (points.length === 0) {
    return (
      <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
        Нет банкоматов с координатами.
      </div>
    );
  }

  return <div ref={mapRef} className="rounded-[10px] border border-line" style={{ height: 640 }} />;
}
