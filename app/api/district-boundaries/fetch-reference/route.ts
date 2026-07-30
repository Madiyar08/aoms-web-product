import { NextRequest, NextResponse } from "next/server";

/**
 * Запрашивает у OpenStreetMap (Nominatim — бесплатный публичный сервис,
 * без API-ключа, тот же провайдер, что рисует тайлы нашей карты) реальную
 * административную границу района по названию. Это решает главную
 * жалобу "без границы очень сложно рисовать" — вместо обведения полигона
 * с нуля кликами по пустой карте, показываем настоящую границу как
 * подложку, которую можно либо принять как есть, либо обвести точнее.
 *
 * Честное ограничение: качество границ в OpenStreetMap для Узбекистана
 * может быть неполным для некоторых районов — тогда вернём понятную
 * ошибку, и останется прежний способ (вручную или через центр).
 */
export async function POST(req: NextRequest) {
  const { district } = await req.json();
  if (!district) {
    return NextResponse.json({ ok: false, error: "Не указан район" }, { status: 400 });
  }

  const query = `${district}, Ташкент, Узбекистан`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=1&q=${encodeURIComponent(
    query
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim требует внятный User-Agent с контактом — иначе может
        // отклонять запросы как неопознанного бота.
        "User-Agent": "AOMS-ATM-Service/1.0 (internal district boundary tool)",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `OpenStreetMap ответил ошибкой (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Район «${district}» не найден в OpenStreetMap. Попробуйте другое написание или рисуйте вручную.` },
        { status: 404 }
      );
    }

    const result = data[0];
    const geojson = result.geojson;
    if (!geojson || (geojson.type !== "Polygon" && geojson.type !== "MultiPolygon")) {
      return NextResponse.json(
        { ok: false, error: `Для «${district}» нашёлся только центр, а не граница. Используйте способ "центр района".` },
        { status: 404 }
      );
    }

    // GeoJSON хранит координаты как [долгота, широта] — у нас наоборот
    // ({lat, lon}), переворачиваем. Для MultiPolygon берём самый крупный
    // контур (обычно основная часть района, без анклавов).
    let ring: number[][];
    if (geojson.type === "Polygon") {
      ring = geojson.coordinates[0];
    } else {
      const polygons = geojson.coordinates as number[][][][];
      ring = polygons.reduce((largest, poly) => (poly[0].length > largest.length ? poly[0] : largest), polygons[0][0]);
    }

    // Слишком много точек (OSM границы бывают на тысячи вершин) — сильно
    // упрощаем до разумного числа, иначе карта и сохранение будут
    // тормозить. Берём каждую N-ю точку, сохраняя форму.
    const MAX_POINTS = 60;
    const step = Math.max(1, Math.floor(ring.length / MAX_POINTS));
    const simplified = ring.filter((_, i) => i % step === 0);

    const points = simplified.map(([lon, lat]) => ({ lat, lon }));

    return NextResponse.json({ ok: true, points, source: result.display_name });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Не удалось связаться с OpenStreetMap: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
