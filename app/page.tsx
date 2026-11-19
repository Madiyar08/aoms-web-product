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
  ensureDefaultSettings(); ensureDefaultCategories(); ensureDefaultStatuses();
  const atms = listAtms(); const categories = listCategories(); const statuses = listStatuses();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const unverified = atms.filter((a) => !a.addressVerified || !a.coordsVerified).length;
  const insideBuilding = atms.filter((a) => categoryById.get(a.categoryId)?.name === "Внутри здания").length;
  const withoutId = atms.filter((a) => !a.code).length;
  const notWorking = atms.filter((a) => statusById.get(a.workStatusId)?.name === "Не работает").length;
  const problem = atms.filter((a) => statusById.get(a.workStatusId)?.name === "Проблемный").length;
  const kpiDefault = getSettingValue("kpi_min_atms_per_day", 50);
  const today = todayTashkent();
  const reports = listCleaningReports();
  const cleanedToday = reports.filter((r) => { const d = r.clientTime || r.createdAt; return d && tashkentDateString(new Date(d)) === today; });
  const uniqueToday = new Set(cleanedToday.map(r => r.atmId).filter(Boolean)).size;
  const noIdUnresolved = listNoIdReports().filter((r) => r.status !== "Разобран").length;
  const cards = [
    { label: "Банкоматы в реестре", value: atms.length, hint: "Общий реестр устройств", href: "/atms", tone: "blue" },
    { label: "Уникальные ATM сегодня", value: uniqueToday, hint: `${cleanedToday.length} отчётов за день`, href: "/cleaned-today", tone: "green" },
    { label: "Открытые проблемы", value: problem + noIdUnresolved, hint: `${problem} проблемных ATM · ${noIdUnresolved} отчётов без ID`, href: "/atm-issues", tone: "red" },
    { label: "Требуют верификации", value: unverified, hint: "Адрес или координаты не проверены", href: "/location-issues", tone: "amber" },
  ];
  const actions = [
    { href: "/monitoring", title: "Оперативный мониторинг", desc: "Экипажи, KPI и активность в течение дня", icon: "◉" },
    { href: "/schedule", title: "Планирование смены", desc: "Назначение машин, экипажей и районов", icon: "▦" },
    { href: "/routes", title: "Маршруты обслуживания", desc: "Проверка точек и последовательности", icon: "⌁" },
    { href: "/reports", title: "Журнал отчётов", desc: "История отправок и контроль результатов", icon: "▤" },
  ];
  const quality = [
    { label: "Не проверены", value: unverified, color: "amber", href: "/location-issues" },
    { label: "Без ID", value: withoutId, color: "red", href: "/atms" },
    { label: "Не работают", value: notWorking, color: "red", href: "/atms" },
    { label: "Внутри зданий", value: insideBuilding, color: "blue", href: "/atms" },
  ];
  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-sky-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Сводка операционного дня · {today}</div><h1 className="text-2xl font-semibold tracking-tight text-white">Центр управления AOMS</h1><p className="mt-2 text-xs text-slate-400">Единая картина состояния банкоматов и выполнения операционных задач</p></div>
      <Link href="/monitoring" className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20">Открыть мониторинг ↗</Link>
    </section>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => <Link href={card.href} key={card.label} className="group rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-sky-500/50">
        <div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">{card.label}</span><span className={`h-2 w-2 rounded-full ${card.tone === "green" ? "bg-emerald-400" : card.tone === "red" ? "bg-rose-400" : card.tone === "amber" ? "bg-amber-400" : "bg-sky-400"}`}/></div>
        <div className="mt-4 text-3xl font-semibold tracking-tight text-white">{card.value.toLocaleString("ru-RU")}</div><p className="mt-2 text-[10px] text-slate-500">{card.hint}</p>
      </Link>)}
    </section>
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Рабочие модули</h2><p className="mt-1 text-[10px] text-slate-500">Быстрый переход к основным процессам</p></div><span className="text-[9px] uppercase tracking-widest text-slate-500">Operations</span></div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">{actions.map(a => <Link href={a.href} key={a.href} className="flex gap-3 rounded-lg border border-slate-700/70 bg-slate-800/40 p-4 transition hover:border-sky-500/40 hover:bg-slate-800"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-lg text-sky-300">{a.icon}</span><span><b className="block text-xs text-slate-200">{a.title}</b><small className="mt-1 block text-[10px] leading-4 text-slate-500">{a.desc}</small></span></Link>)}</div>
      </div>
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Качество реестра</h2><p className="mt-1 text-[10px] text-slate-500">Показатели, требующие внимания</p></div><Link href="/atms" className="text-[10px] text-sky-300 hover:text-sky-200">Реестр ↗</Link></div>
        <div className="mt-4 space-y-4">{quality.map(q => <Link href={q.href} key={q.label} className="block"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-slate-400">{q.label}</span><b className="font-mono text-xs text-slate-200">{q.value}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${q.color === "red" ? "bg-rose-400" : q.color === "amber" ? "bg-amber-400" : "bg-sky-400"}`} style={{width: `${atms.length ? Math.min(100, q.value / atms.length * 100) : 0}%`}}/></div></Link>)}</div>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-4"><p className="text-[10px] text-slate-500">Целевой KPI на машину</p><b className="mt-2 block text-xl text-slate-100">{kpiDefault} <small className="text-[10px] font-normal text-slate-500">ATM / день</small></b></div>
      <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-4"><p className="text-[10px] text-slate-500">Категории устройств</p><b className="mt-2 block text-xl text-slate-100">{categories.length}</b></div>
      <div className="col-span-2 rounded-lg border border-slate-700/70 bg-slate-900/50 p-4 sm:col-span-1"><p className="text-[10px] text-slate-500">Статусы устройств</p><b className="mt-2 block text-xl text-slate-100">{statuses.length}</b></div>
    </section>
  </div>;
}
