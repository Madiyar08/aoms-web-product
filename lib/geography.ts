/** Data-driven administrative regions. District names remain scoped to a region. */
export interface RegionDefinition {
  id: string;
  name: string;
  aliases: string[];
}

export const UZBEKISTAN_REGIONS: RegionDefinition[] = [
  { id: "karakalpakstan", name: "Республика Каракалпакстан", aliases: ["Каракалпакстан", "Республика Каракалпакстан", "Karakalpakstan", "Qoraqalpog'iston Respublikasi", "Qoraqalpogiston"] },
  { id: "andijan", name: "Андижанская область", aliases: ["Андижан", "Андижанская область", "Andijan", "Andijon viloyati"] },
  { id: "bukhara", name: "Бухарская область", aliases: ["Бухара", "Бухарская область", "Bukhara", "Buxoro viloyati"] },
  { id: "jizzakh", name: "Джизакская область", aliases: ["Джизак", "Джизакская область", "Jizzakh", "Jizzax viloyati"] },
  { id: "kashkadarya", name: "Кашкадарьинская область", aliases: ["Кашкадарья", "Кашкадарьинская область", "Kashkadarya", "Qashqadaryo viloyati"] },
  { id: "navoi", name: "Навоийская область", aliases: ["Навои", "Навоийская область", "Navoi", "Navoiy viloyati"] },
  { id: "namangan", name: "Наманганская область", aliases: ["Наманган", "Наманганская область", "Namangan", "Namangan viloyati"] },
  { id: "samarkand", name: "Самаркандская область", aliases: ["Самарканд", "Самаркандская область", "Samarkand", "Samarqand viloyati"] },
  { id: "surkhandarya", name: "Сурхандарьинская область", aliases: ["Сурхандарья", "Сурхандарьинская область", "Surkhandarya", "Surxondaryo viloyati"] },
  { id: "syrdarya", name: "Сырдарьинская область", aliases: ["Сырдарья", "Сырдарьинская область", "Syrdarya", "Sirdaryo viloyati"] },
  { id: "tashkent-region", name: "Ташкентская область", aliases: ["Ташкентская область", "Tashkent Region", "Toshkent viloyati"] },
  { id: "fergana", name: "Ферганская область", aliases: ["Фергана", "Ферганская область", "Fergana", "Farg'ona viloyati", "Fargona"] },
  { id: "khorezm", name: "Хорезмская область", aliases: ["Хорезм", "Хорезмская область", "Khorezm", "Xorazm viloyati"] },
  { id: "tashkent-city", name: "Город Ташкент", aliases: ["Ташкент", "Город Ташкент", "Tashkent City", "Toshkent shahri"] },
];

export function normalizeGeoName(value: string): string {
  return (value || "").toLocaleLowerCase("ru").replace(/[’`]/g, "'").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export function resolveRegionName(value: string): string {
  const normalized = normalizeGeoName(value);
  if (!normalized) return "";
  const match = UZBEKISTAN_REGIONS.find((region) =>
    [region.name, ...region.aliases].some((alias) => normalizeGeoName(alias) === normalized)
  );
  // Unknown values are preserved so admins can add new administrative
  // units through data/import rather than requiring a code release.
  return match?.name || value.trim();
}

/**
 * Excel may contain a region column that is populated only on section rows.
 * In that case the last recognized section region remains in effect for
 * subsequent ATM rows. An explicit non-empty row value always wins.
 */
export function resolveRegionWithFallback(explicitRegion: string, inheritedRegion: string): string {
  const explicit = (explicitRegion || "").trim();
  return resolveRegionName(explicit || inheritedRegion || "");
}

export function regionIdForName(value: string): string {
  const normalized = normalizeGeoName(value);
  const match = UZBEKISTAN_REGIONS.find((region) =>
    [region.name, ...region.aliases].some((alias) => normalizeGeoName(alias) === normalized)
  );
  return match?.id || (normalized ? `custom:${normalized}` : "");
}

export function districtScopedKey(region: string, district: string): string {
  return `${regionIdForName(region) || "unassigned"}:${normalizeGeoName(district)}`;
}
