import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "app_settings";

export interface AppSetting extends BaseEntity {
  key: string;
  value: string;
  category: string;
  description: string;
  valueType: string; // string | int | float | bool | csv
}

const DEFAULT_SETTINGS: Array<Omit<AppSetting, keyof BaseEntity>> = [
  {
    key: "kpi_min_atms_per_day",
    value: "50",
    category: "KPI",
    description:
      "Значение KPI по умолчанию, подставляется при составлении расписания. " +
      "Итоговый KPI задаётся отдельно для каждого экипажа в модуле «Расписание».",
    valueType: "int",
  },
  {
    key: "antifraud_gps_radius_meters",
    value: "20",
    category: "Антифрод",
    description: "Максимально допустимое расстояние между GPS сотрудника и координатами банкомата, метров.",
    valueType: "int",
  },
  {
    key: "antifraud_time_window_minutes",
    value: "60",
    category: "Антифрод",
    description: "Допустимое отклонение времени фото от планового окна визита, минут.",
    valueType: "int",
  },
  {
    key: "schedule_tashkent_city_days",
    value: "Monday,Friday",
    category: "Расписание",
    description: "Дни недели, когда обязательно обслуживается город Ташкент (BR-001).",
    valueType: "csv",
  },
  {
    key: "coordinate_cluster_radius_meters",
    value: "30",
    category: "Анализ координат",
    description: "Порог расстояния для объединения банкоматов в одну точку обслуживания.",
    valueType: "int",
  },
  {
    key: "depot_latitude",
    value: "",
    category: "Маршруты",
    description: "Широта базы/склада — точка отсчёта для оптимизации маршрута. Если не задано, используется первый банкомат маршрута.",
    valueType: "string",
  },
  {
    key: "depot_longitude",
    value: "",
    category: "Маршруты",
    description: "Долгота базы/склада — см. depot_latitude.",
    valueType: "string",
  },
];

export function listSettings(): AppSetting[] {
  return readAll<AppSetting>(TABLE);
}

export function getSettingByKey(key: string): AppSetting | null {
  return listSettings().find((s) => s.key === key) ?? null;
}

export function castSettingValue(setting: AppSetting): string | number | boolean | string[] {
  const { value, valueType } = setting;
  switch (valueType) {
    case "int": {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    case "float": {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    case "bool":
      return ["true", "1", "yes", "да"].includes(value.trim().toLowerCase());
    case "csv":
      return value.split(",").map((v) => v.trim()).filter(Boolean);
    default:
      return value;
  }
}

export function getSettingValue<T = string | number | boolean | string[]>(key: string, fallback: T): T {
  const setting = getSettingByKey(key);
  if (!setting) return fallback;
  return castSettingValue(setting) as T;
}

export function createSetting(data: Omit<AppSetting, keyof BaseEntity>): AppSetting {
  const row: AppSetting = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateSettingValue(id: string, value: string): boolean {
  return updateRow<AppSetting>(TABLE, id, { value, updatedAt: nowIso() });
}

export function deleteSetting(id: string): boolean {
  return deleteRow(TABLE, id);
}

export function ensureDefaultSettings(): void {
  const existingKeys = new Set(listSettings().map((s) => s.key));
  for (const setting of DEFAULT_SETTINGS) {
    if (!existingKeys.has(setting.key)) {
      createSetting(setting);
    }
  }
}
