import { NextRequest, NextResponse } from "next/server";
import { saveDistrictBoundary } from "@/lib/district-boundaries";

/**
 * Принимает точки границы района. МИНИМУМ 1 точка допустим намеренно:
 * рисование полного полигона для каждого района оказалось слишком
 * трудозатратным (26 районов). Одна точка трактуется как "центр района",
 * определённый вручную (например, скопирован из Яндекс.Карт кликом по
 * названию района) — это быстрый способ, который всё равно точнее
 * прежнего автоматического среднего по своим же (возможно, неточным)
 * данным банкоматов. Полигон (3+ точек) остаётся доступен для тех, кто
 * хочет максимальной точности отдельного района.
 */
export async function POST(req: NextRequest) {
  const { district, points } = await req.json();
  if (!district || !Array.isArray(points) || points.length < 1) {
    return NextResponse.json({ ok: false, error: "Нужен район и хотя бы одна точка (центр)" }, { status: 400 });
  }
  const clean = points
    .map((p: any) => ({ lat: Number(p.lat), lon: Number(p.lon) }))
    .filter((p: any) => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));
  if (clean.length < 1) {
    return NextResponse.json({ ok: false, error: "Некорректные координаты точек" }, { status: 400 });
  }
  saveDistrictBoundary(String(district), clean);
  return NextResponse.json({ ok: true });
}
