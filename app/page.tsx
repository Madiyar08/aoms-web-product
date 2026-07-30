import Link from "next/link";
import { listAtms } from "@/lib/atms";
import { listCategories, ensureDefaultCategories } from "@/lib/categories";
import { listStatuses, ensureDefaultStatuses } from "@/lib/statuses";
import { getSettingValue, ensureDefaultSettings } from "@/lib/settings";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { listNoIdReports } from "@/lib/no-id-reports";
import { todayTashkent, tashkentDateString } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  ensureDefaultSettings();
  ensureDefaultCategories();
  ensureDefaultStatuses();

  const atms = listAtms();
  const categories = listCategories();
  const statuses = listStatuses();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  const unverified = atms.filter((a) => !a.addressVerified || !a.coordsVerified).length;
  const insideBuilding = atms.filter((a) => categoryById.get(a.categoryId)?.name === "Внутри здания").length;
  const withoutId = atms.filter((a) => !a.code).length;
  const notWorking = atms.filter((a) => statusById.get(a.workStatusId)?.name === "Не работает").length;
  const problem = atms.filter((a) => statusById.get(a.workStatusId)?.name === "Проблемный").length;
  const kpiDefault = getSettingValue("kpi_min_atms_per_day", 50);

  const today = todayTashkent();
  const cleanedToday = listCleaningReports().filter((r) => tashkentDateString(new Date(r.clientTime)) === today).length;
  const noIdUnresolved = listNoIdReports().filter((r) => r.status !== "Разобран").length;

  const counters = [
    { label: "Не проверено", value: unverified },
    { label: "Внутри здания", value: insideBuilding },
    { label: "Без ID", value: withoutId },
    { label: "Не работает", value: notWorking },
    { label: "Проблемные", value: problem, danger: true },
  ];

  // Быстрые ссылки на то, что руководитель смотрит каждый день — сверху,
  // ещё до общей статистики базы (п.8 ТЗ: удобство ежедневной работы).
  const quickLinks = [
    { href: "/cleaned-today", label: "Обслужено сегодня", value: cleanedToday, tone: "text-st-green" },
    { href: "/problem-atms", label: "Проблемные банкоматы", value: problem, tone: "text-st-red" },
    { href: "/no-id-reports", label: "Без ID / не работает", value: noIdUnresolved, tone: "text-st-orange" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-medium text-ink">Dashboard руководителя</h1>
        <p className="text-sm text-neutral-500 mt-1">Данные — реальные, из файла data/aoms.db</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {quickLinks.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-white border border-line rounded-[10px] p-4 flex items-center justify-between hover:border-brass/50 transition-colors"
          >
            <span className="text-sm text-neutral-600">{q.label}</span>
            <span className={`font-display text-2xl font-medium ${q.tone}`}>{q.value}</span>
          </Link>
        ))}
      </div>

      <div className="kpi-row grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Банкоматов в базе" value={atms.length.toString()} />
        <Kpi label="KPI по умолчанию" value={`${kpiDefault} / день`} />
        <Kpi label="Категорий" value={categories.length.toString()} />
        <Kpi label="Статусов работы" value={statuses.length.toString()} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {counters.map((c) => (
          <div key={c.label} className="bg-white border border-line rounded-[10px] p-3">
            <div className="text-[11.5px] text-neutral-500 mb-1">{c.label}</div>
            <div className={`font-display text-xl ${c.danger ? "text-st-red" : "text-ink"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {atms.length === 0 && (
        <div className="mt-6 bg-brass-bg border border-brass/30 text-brass-dark text-sm rounded-lg p-4">
          Банкоматов пока нет — добавьте первый на странице «Банкоматы»,
          или дождитесь модуля импорта из Excel.
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative z-10 bg-white border border-line rounded-[10px] p-4">
      <div className="text-[11.5px] text-neutral-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="font-display text-2xl font-medium text-ink leading-none">{value}</div>
    </div>
  );
}
