"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Atm } from "@/lib/atms";
import { verificationStatus, cleaningFreshness } from "@/lib/atm-status";
import type { AtmCategory } from "@/lib/categories";
import type { AtmWorkStatus } from "@/lib/statuses";
import { bulkAssignAction, deleteAtmAction } from "./actions";

export function AtmTable({
  atms,
  categories,
  statuses,
}: {
  atms: Atm[];
  categories: AtmCategory[];
  statuses: AtmWorkStatus[];
}) {
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const districts = useMemo(
    () => Array.from(new Set(atms.map((a) => a.district).filter(Boolean))).sort(),
    [atms]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return atms.filter((a) => {
      if (categoryFilter === "__none__" && a.categoryId) return false;
      else if (categoryFilter && categoryFilter !== "__none__" && a.categoryId !== categoryFilter) return false;
      if (statusFilter && a.workStatusId !== statusFilter) return false;
      if (districtFilter && a.district !== districtFilter) return false;
      if (verificationFilter === "no_id" && a.code) return false;
      if (verificationFilter === "no_category" && a.categoryId) return false;
      if (verificationFilter === "unverified" && a.addressVerified && a.coordsVerified) return false;
      if (verificationFilter === "cleaned_today") {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
        if (a.lastCleanedDate !== today) return false;
      }
      if (needle) {
        const haystack = `${a.code} ${a.name} ${a.address} ${a.district}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [atms, search, categoryFilter, statusFilter, districtFilter, verificationFilter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id))
    );
  }

  function applyBulk() {
    if (selected.size === 0 || (!bulkCategory && !bulkStatus)) return;
    startTransition(async () => {
      await bulkAssignAction(Array.from(selected), bulkCategory, bulkStatus);
      setSelected(new Set());
      setBulkCategory("");
      setBulkStatus("");
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить банкомат?")) return;
    await deleteAtmAction(id);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          placeholder="Поиск по ID, названию, адресу, району…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input !w-64"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input !w-auto">
          <option value="">Категория: все</option>
          <option value="__none__">— без категории —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto">
          <option value="">Статус: все</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="input !w-auto">
          <option value="">Район: все</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Проверка: все</option>
          <option value="no_id">Без ID</option>
          <option value="no_category">Без категории</option>
          <option value="unverified">Не проверено (адрес/координаты)</option>
          <option value="cleaned_today">Обслужено сегодня</option>
        </select>
        {(categoryFilter || statusFilter || districtFilter || verificationFilter || search) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setStatusFilter("");
              setDistrictFilter("");
              setVerificationFilter("");
            }}
            className="text-[11.5px] text-neutral-500 underline"
          >
            Сбросить фильтры
          </button>
        )}
        <span className="text-[11.5px] text-neutral-500">
          Показано {filtered.length} из {atms.length}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-brass-bg border border-brass/30 rounded-lg p-3">
          <span className="text-[12px] text-brass-dark font-semibold">Выбрано: {selected.size}</span>
          <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="input !w-auto">
            <option value="">Категория — не менять</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="input !w-auto">
            <option value="">Статус — не менять</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulk}
            disabled={isPending || (!bulkCategory && !bulkStatus)}
            className="bg-brass text-white text-xs font-semibold rounded-md px-3 py-2 disabled:opacity-50"
          >
            {isPending ? "Применяем…" : "Применить к выбранным"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[11px] text-neutral-500">
            Снять выбор
          </button>
        </div>
      )}

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
            <th className="py-2 w-8">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === filtered.length}
                onChange={toggleAll}
              />
            </th>
            <th className="py-2 w-6"></th>
            <th className="py-2">ID</th>
            <th className="py-2">Название</th>
            <th className="py-2">Район</th>
            <th className="py-2">Категория</th>
            <th className="py-2">Статус</th>
            <th className="py-2">Очистка</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((atm) => {
            const v = verificationStatus(atm);
            const freshness = cleaningFreshness(atm.lastCleanedDate);
            const category = categoryById.get(atm.categoryId);
            return (
              <tr key={atm.id} className="border-b border-line last:border-0">
                <td className="py-2.5">
                  <input type="checkbox" checked={selected.has(atm.id)} onChange={() => toggle(atm.id)} />
                </td>
                <td className="py-2.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${v.dotClass}`} title={v.label} />
                </td>
                <td className="py-2.5 font-mono text-neutral-500">{atm.code || "—"}</td>
                <td className="py-2.5">
                  <Link href={`/atms/${atm.id}`} className="text-route hover:underline">
                    {atm.name}
                  </Link>
                </td>
                <td className="py-2.5 text-neutral-500">{atm.district || "—"}</td>
                <td className="py-2.5">
                  {category ? category.name : <span className="text-st-yellow">не указана</span>}
                </td>
                <td className="py-2.5">{statusById.get(atm.workStatusId)?.name ?? "—"}</td>
                <td className="py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${freshness.dotClass}`} />
                    {freshness.label}
                  </span>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <Link href={`/atms/${atm.id}`} className="text-[11px] text-route mr-3">
                    Открыть
                  </Link>
                  <button onClick={() => handleDelete(atm.id)} className="text-[11px] text-st-red">
                    Удалить
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-400 py-6 text-center">Ничего не найдено по этим фильтрам.</p>
      )}
    </div>
  );
}
