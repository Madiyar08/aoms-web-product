"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type L from "leaflet";

export interface MonitoringMapPoint {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  reportsToday: number;
  hasOpenIssue: boolean;
}

export interface MonitoringBoundary {
  id: string;
  district: string;
  region: string;
  points: { lat: number; lon: number }[];
}

export default function MonitoringMap({ points, boundaries }: { points: MonitoringMapPoint[]; boundaries: MonitoringBoundary[] }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!elementRef.current || mapRef.current) return;

    import("leaflet").then(({ default: Lm }) => {
      if (cancelled || !elementRef.current || mapRef.current) return;
      const map = Lm.map(elementRef.current, { preferCanvas: true, scrollWheelZoom: false }).setView([41.2, 64.5], 5);
      mapRef.current = map;
      Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const boundaryLayer = Lm.layerGroup().addTo(map);
      for (const boundary of boundaries) {
        if (boundary.points.length < 3) continue;
        Lm.polygon(boundary.points.map((point) => [point.lat, point.lon] as [number, number]), {
          color: "#64748b", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.06,
        }).bindTooltip(`${boundary.region} · ${boundary.district}`).addTo(boundaryLayer);
      }

      const markerLayer = Lm.layerGroup().addTo(map);
      const bounds: [number, number][] = [];
      for (const point of points) {
        bounds.push([point.lat, point.lon]);
        const color = point.hasOpenIssue ? "#dc2626" : point.reportsToday > 0 ? "#059669" : "#d97706";
        const marker = Lm.circleMarker([point.lat, point.lon], {
          radius: point.reportsToday > 0 ? 6 : 5,
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.78,
        });
        const details = [
          `<strong>${escapeHtml(point.code)}</strong> — ${escapeHtml(point.name || "Без названия")}`,
          escapeHtml(point.address || "Адрес не указан"),
          `Отчётов сегодня: ${point.reportsToday}`,
          point.hasOpenIssue ? "Есть открытая проблема" : "Открытых проблем нет",
        ].join("<br>");
        marker.bindPopup(`${details}<br><a href="/atms/${encodeURIComponent(point.id)}">Открыть карточку ATM</a>`);
        marker.addTo(markerLayer);
      }
      if (bounds.length > 0) {
        map.fitBounds(Lm.latLngBounds(bounds), { padding: [24, 24], maxZoom: 12 });
      }
      // Keep the map responsive when its parent changes size.
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points, boundaries]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-semibold text-ink">География обслуживания</h2>
          <p className="mt-1 text-xs text-neutral-500">Точки из реестра ATM · отчёты и проблемы за сегодня · сохранённые полигоны районов (если загружены)</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Есть отчёт</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Нет отчёта</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-600" /> Открытая проблема</span>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="p-10 text-center text-sm text-neutral-500">В выбранной географии нет банкоматов с корректными координатами.</div>
      ) : (
        <>
          <div ref={elementRef} className="h-[420px] w-full bg-slate-100 md:h-[540px]" aria-label="Карта банкоматов и активности обслуживания" />
          <div className="border-t border-line px-5 py-3 text-[11px] text-neutral-500">
            {points.length.toLocaleString("ru-RU")} ATM на карте · {boundaries.length.toLocaleString("ru-RU")} сохранённых полигонов · отсутствующие границы не дорисовываются
          </div>
        </>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] || char);
}
