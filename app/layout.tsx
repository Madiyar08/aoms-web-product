import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AOMS — ATM Operations Management System",
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/atms", label: "Банкоматы" },
  { href: "/machines", label: "Машины" },
  { href: "/employees", label: "Сотрудники" },
  { href: "/schedule", label: "Расписание" },
  { href: "/routes", label: "Маршруты" },
  { href: "/driver-logs", label: "Водитель" },
  { href: "/coordinate-analysis", label: "Анализ координат" },
  { href: "/district-boundaries", label: "Границы районов" },
  { href: "/atm-issues", label: "Банкоматы с проблемой" },
  { href: "/change-queue", label: "Очередь изменений" },
  { href: "/problem-atms", label: "Проблемные (архив)" },
  { href: "/no-id-reports", label: "Без ID (архив)" },
  { href: "/location-issues", label: "Уточнить адрес/координаты" },
  { href: "/cleaned-today", label: "Сегодня очищено" },
  { href: "/cleaning-matrix", label: "Матрица очистки" },
  { href: "/crew-locations", label: "Где экипажи" },
  { href: "/storage-cleanup", label: "Место на диске" },
  { href: "/reports", label: "Отчёты" },
  { href: "/settings", label: "Настройки" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 bg-ink text-slate-300 flex flex-col py-5">
            <div className="flex items-center gap-2 px-5 pb-5 mb-3 border-b border-white/10">
              <div className="w-7 h-7 rounded-md bg-brass flex items-center justify-center text-ink-2 font-display font-semibold text-sm">
                A
              </div>
              <div>
                <b className="text-white text-sm block">AOMS</b>
                <small className="text-[9.5px] text-slate-500 tracking-wide">ТАШКЕНТ / ОБЛАСТЬ</small>
              </div>
            </div>
            <nav className="nav-thread flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-md mr-2 text-slate-300 hover:bg-white/5"
                >
                  <span className="w-[7px] h-[7px] rounded-full bg-ink border border-slate-600 -ml-0.5 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-5 pt-3 border-t border-white/10 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-route text-white flex items-center justify-center text-[11px] font-semibold">
                ДР
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-200 m-0">Дилшод Раззаков</p>
                <span className="text-[10.5px] text-slate-500">Руководитель отдела</span>
              </div>
              <form action="/api/logout" method="POST">
                <button className="text-[10.5px] text-slate-500 hover:text-slate-300" title="Выйти">
                  Выйти
                </button>
              </form>
            </div>
          </aside>
          <main className="flex-1 bg-paper p-8 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
