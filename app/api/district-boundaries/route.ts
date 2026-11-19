import { NextRequest, NextResponse } from "next/server";
import { saveDistrictBoundary } from "@/lib/district-boundaries";
import { validateBoundaryPoints } from "@/lib/geometry-polygon";

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
  const { district, regionId, region, points } = await req.json();
  if (!district || typeof district !== "string" || !Array.isArray(points)) {
    return NextResponse.json({ ok: false, error: "Нужен район и массив координат" }, { status: 400 });
  }
  const clean = points.map((p: any) => ({ lat: Number(p?.lat), lon: Number(p?.lon) }));
  const validation = validateBoundaryPoints(clean);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.reason }, { status: 400 });
  }
  saveDistrictBoundary(String(district), clean, typeof regionId === "string" ? regionId : undefined, typeof region === "string" ? region : undefined);
  return NextResponse.json({ ok: true });
}
