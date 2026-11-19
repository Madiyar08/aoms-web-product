"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_GROUPS = [
  { title: "Операционный центр", items: [
    ["/", "Обзор", "⌂"], ["/monitoring", "Мониторинг", "◉"], ["/schedule", "Планирование", "▦"], ["/routes", "Маршруты", "⌁"],
  ]},
  { title: "Инфраструктура", items: [
    ["/atms", "Банкоматы", "▣"], ["/atms-map", "Карта банкоматов", "⌖"], ["/machines", "Автомобили", "▤"], ["/employees", "Сотрудники", "♙"],
  ]},
  { title: "Контроль и аналитика", items: [
    ["/reports", "Отчёты", "▤"], ["/cleaning-review", "Проверка очистки", "✓"], ["/warehouse", "Склад и материалы", "▥"], ["/inspector-reports", "Инспекторские отчёты", "⌕"], ["/delivery-queue", "Очередь доставки", "⇄"], ["/cleaned-today", "Обслужено сегодня", "✓"], ["/cleaning-matrix", "Матрица очистки", "▦"], ["/crew-locations", "Геопозиции экипажей", "⌖"],
  ]},
  { title: "Данные и администрирование", items: [
    ["/coordinate-analysis", "Координаты", "◎"], ["/district-boundaries", "Границы районов", "◇"], ["/atm-analysis", "Анализ базы", "◫"], ["/atm-issues", "Проблемы банкоматов", "!"], ["/change-queue", "Очередь изменений", "↻"], ["/location-issues", "Проверка адресов", "⌖"], ["/problem-atms", "Архив проблем", "▤"], ["/no-id-reports", "Отчёты без ID", "▤"], ["/driver-logs", "Журнал водителей", "▤"], ["/storage-cleanup", "Хранилище", "▤"], ["/settings", "Настройки", "⚙"], ["/users", "Пользователи и роли", "♙"], ["/audit-log", "Журнал аудита", "≡"],
  ]},
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  return <div className="aoms-shell">
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
    <aside className={`aoms-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <Link href="/" className="brand-lockup"><span className="brand-mark">A</span><span><b>AOMS</b><small>OPERATIONS MANAGEMENT</small></span></Link>
      <div className="sidebar-context"><span className="live-dot" /> ОПЕРАЦИОННАЯ СИСТЕМА</div>
      <nav className="sidebar-nav" aria-label="Основная навигация">
        {NAV_GROUPS.map(group => <section className="nav-group" key={group.title}>
          <p className="nav-group-title">{group.title}</p>
          {group.items.map(([href, label, icon]) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link href={href} key={href} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "is-active" : ""}`}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span></Link>;
          })}
        </section>)}
      </nav>
      <div className="sidebar-footer"><div className="user-avatar">AO</div><div className="user-meta"><b>Операционный доступ</b><span>Управление AOMS</span></div><form action="/api/logout" method="POST"><button className="logout-button" title="Выйти" aria-label="Выйти">↗</button></form></div>
    </aside>
    <main className="aoms-main">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">☰</button><div><span className="topbar-eyebrow">ATM OPERATIONS MANAGEMENT SYSTEM</span><div className="topbar-title">Операционная панель</div></div></div>
        <div className="topbar-right"><span className="system-status"><i /> UZBEKISTAN</span><span className="topbar-divider" /><span className="topbar-region">UTC+5</span></div>
      </header>
      <div className="page-content">{children}</div>
      <footer className="app-footer"><span>AOMS · ATM Operations Management</span><span>Внутренняя система управления</span></footer>
    </main>
  </div>;
}
