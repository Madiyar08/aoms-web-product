/** Point-in-polygon helper. Polygon edges are treated as inside. */
export function pointInPolygon(lat: number, lon: number, points: { lat: number; lon: number }[]): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || points.length < 3) return false;

  let inside = false;
  const EPSILON = 1e-10;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    const cross = (lon - a.lon) * (b.lat - a.lat) - (lat - a.lat) * (b.lon - a.lon);
    const withinBounds =
      lon >= Math.min(a.lon, b.lon) - EPSILON && lon <= Math.max(a.lon, b.lon) + EPSILON &&
      lat >= Math.min(a.lat, b.lat) - EPSILON && lat <= Math.max(a.lat, b.lat) + EPSILON;
    if (Math.abs(cross) <= EPSILON && withinBounds) return true;

    const intersects =
      (a.lat > lat) !== (b.lat > lat) &&
      lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon;
    if (intersects) inside = !inside;
  }
  return inside;
}

export type PolygonValidation = { ok: true } | { ok: false; reason: string };

function orientation(a: {lat:number;lon:number}, b: {lat:number;lon:number}, c: {lat:number;lon:number}): number {
  return (b.lon-a.lon)*(c.lat-a.lat) - (b.lat-a.lat)*(c.lon-a.lon);
}
function onSegment(a: {lat:number;lon:number}, b: {lat:number;lon:number}, p: {lat:number;lon:number}): boolean {
  const eps = 1e-10;
  return Math.abs(orientation(a,b,p)) <= eps &&
    p.lon >= Math.min(a.lon,b.lon)-eps && p.lon <= Math.max(a.lon,b.lon)+eps &&
    p.lat >= Math.min(a.lat,b.lat)-eps && p.lat <= Math.max(a.lat,b.lat)+eps;
}
function segmentsIntersect(a: {lat:number;lon:number}, b: {lat:number;lon:number}, c: {lat:number;lon:number}, d: {lat:number;lon:number}): boolean {
  const o1=orientation(a,b,c), o2=orientation(a,b,d), o3=orientation(c,d,a), o4=orientation(c,d,b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}

/** Validate a saved boundary before it can affect ATM geography checks. */
export function validateBoundaryPoints(points: {lat:number;lon:number}[]): PolygonValidation {
  if (!Array.isArray(points) || points.length < 1) return {ok:false, reason:"Добавьте хотя бы одну точку"};
  if (points.length === 2) return {ok:false, reason:"Нужна одна точка центра или минимум три точки полигона"};
  if (points.length > 10000) return {ok:false, reason:"Максимум 10 000 точек"};
  if (points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180)) {
    return {ok:false, reason:"Координаты выходят за допустимые диапазоны"};
  }
  if (points.length === 1) return {ok:true};
  const distinct = new Set(points.map(p => `${p.lat.toFixed(10)},${p.lon.toFixed(10)}`));
  if (distinct.size < 3) return {ok:false, reason:"Для полигона нужны минимум три различные точки"};
  for (let i=0;i<points.length;i++) {
    const next=(i+1)%points.length;
    if (Math.abs(points[i].lat-points[next].lat)<1e-12 && Math.abs(points[i].lon-points[next].lon)<1e-12) {
      return {ok:false, reason:"Соседние точки полигона не должны совпадать"};
    }
  }
  let twiceArea=0;
  for(let i=0,j=points.length-1;i<points.length;j=i++) twiceArea += points[j].lon*points[i].lat-points[i].lon*points[j].lat;
  if (Math.abs(twiceArea)<1e-12) return {ok:false, reason:"Площадь полигона равна нулю"};
  const n=points.length;
  for(let i=0;i<n;i++) {
    const i2=(i+1)%n;
    for(let j=i+1;j<n;j++) {
      const j2=(j+1)%n;
      if(i===j || i2===j || j2===i) continue;
      if(segmentsIntersect(points[i],points[i2],points[j],points[j2])) return {ok:false, reason:"Граница пересекает саму себя"};
    }
  }
  return {ok:true};
}
