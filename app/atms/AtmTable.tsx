"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Atm } from "@/lib/atms";
import { verificationStatus, cleaningFreshness } from "@/lib/atm-status";
import type { AtmCategory } from "@/lib/categories";
import type { AtmWorkStatus } from "@/lib/statuses";
import { bulkAssignAction, deleteAtmAction } from "./actions";
import { getAtmDataQuality, normalizeAtmIdentifier } from "@/lib/atm-quality";

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
  const [regionFilter, setRegionFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const quality = useMemo(() => getAtmDataQuality(atms), [atms]);
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    atms.forEach((atm) => { const code = normalizeAtmIdentifier(atm.code); if (code) counts.set(code, (counts.get(code) ?? 0) + 1); });
    return new Set([...counts].filter(([, count]) => count > 1).map(([code]) => code));
  }, [atms]);

  const regions = useMemo(
    () => Array.from(new Set(atms.map((a) => a.region).filter((v): v is string => Boolean(v)))).sort(),
    [atms]
  );
  const districts = useMemo(() => {
    const options = new Map<string, string>();
    atms.filter((a) => a.district && (!regionFilter || a.region === regionFilter)).forEach((atm) => {
      const key = `${atm.region || ""}::${atm.district}`;
      options.set(key, `${atm.region ? `${atm.region} — ` : "Регион не указан — "}${atm.district}`);
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [atms, regionFilter]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return atms.filter((a) => {
      if (categoryFilter === "__none__" && a.categoryId) return false;
      else if (categoryFilter && categoryFilter !== "__none__" && a.categoryId !== categoryFilter) return false;
      if (statusFilter && a.workStatusId !== statusFilter) return false;
      if (regionFilter && a.region !== regionFilter) return false;
      if (districtFilter) {
        const [selectedRegion, selectedDistrict] = districtFilter.split("::");
        if (a.district !== selectedDistrict || (selectedRegion && (a.region || "") !== selectedRegion)) return false;
      }
      if (verificationFilter === "no_id" && a.code) return false;
      if (verificationFilter === "no_category" && a.categoryId) return false;
      if (verificationFilter === "unverified" && a.addressVerified && a.coordsVerified) return false;
      if (verificationFilter === "duplicate_id" && !duplicateIds.has(normalizeAtmIdentifier(a.code))) return false;
      if (verificationFilter === "missing_coords" && a.latitude?.trim() && a.longitude?.trim()) return false;
      if (verificationFilter === "invalid_coords") { const lat = Number(a.latitude); const lon = Number(a.longitude); if (!a.latitude?.trim() || !a.longitude?.trim() || (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return false; }
      if (verificationFilter === "missing_district" && a.district?.trim()) return false;
      if (verificationFilter === "missing_region" && a.region?.trim()) return false;
      if (verificationFilter === "missing_address" && a.address?.trim()) return false;
      if (verificationFilter === "cleaned_today") {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
        if (a.lastCleanedDate !== today) return false;
      }
      if (needle) {
        const haystack = `${a.code} ${a.name} ${a.address} ${a.region || ""} ${a.district}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [atms, search, categoryFilter, statusFilter, regionFilter, districtFilter, verificationFilter, duplicateIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((atm) => selected.has(atm.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((atm) => next.delete(atm.id));
      else filtered.forEach((atm) => next.add(atm.id));
      return next;
    });
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
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mb-4" aria-label="Качество данных банкоматов">
        <QualityCard label="Без ID" value={quality.missingCode} onClick={() => setVerificationFilter("no_id")} active={verificationFilter === "no_id"} />
        <QualityCard label="Дубли ID" value={quality.duplicateCodeRecords} detail={quality.duplicateCodeGroups ? `${quality.duplicateCodeGroups} групп` : "Нет дублей"} onClick={() => setVerificationFilter("duplicate_id")} active={verificationFilter === "duplicate_id"} />
        <QualityCard label="Без координат" value={quality.missingCoordinates} onClick={() => setVerificationFilter("missing_coords")} active={verificationFilter === "missing_coords"} />
        <QualityCard label="Некорректные координаты" value={quality.invalidCoordinates} onClick={() => setVerificationFilter("invalid_coords")} active={verificationFilter === "invalid_coords"} />
        <QualityCard label="Без района" value={quality.missingDistrict} onClick={() => setVerificationFilter("missing_district")} active={verificationFilter === "missing_district"} />
        <QualityCard label="Без региона" value={quality.missingRegion} onClick={() => setVerificationFilter("missing_region")} active={verificationFilter === "missing_region"} />
      </section>
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
        <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setDistrictFilter(""); }} className="input !w-auto">
          <option value="">Регион: все</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="input !w-auto">
          <option value="">Район: все</option>
          {districts.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
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
          <option value="duplicate_id">Дублирующийся ID</option>
          <option value="missing_coords">Без координат</option>
          <option value="invalid_coords">Некорректные координаты</option>
          <option value="missing_region">Без региона</option>
          <option value="missing_district">Без района</option>
          <option value="missing_address">Без адреса</option>
          <option value="unverified">Не проверено (адрес/координаты)</option>
          <option value="cleaned_today">Обслужено сегодня</option>
        </select>
        {(categoryFilter || statusFilter || regionFilter || districtFilter || verificationFilter || search) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setStatusFilter("");
              setDistrictFilter("");
              setRegionFilter("");
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
        <p className="text-[11px] text-neutral-500 mb-2">Выбрано записей: {selected.size}. Выбор сохраняется при смене фильтров.</p>
      )}
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
                checked={allVisibleSelected}
                onChange={toggleAll}
              />
            </th>
            <th className="py-2 w-6"></th>
            <th className="py-2">ID</th>
            <th className="py-2">Название</th>
            <th className="py-2">Регион</th>
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
                <td className="py-2.5 text-neutral-500">{atm.region || "—"}</td>
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


function QualityCard({ label, value, detail, onClick, active }: { label: string; value: number; detail?: string; onClick: () => void; active: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`text-left rounded-lg border p-3 transition-colors ${active ? "border-route bg-blue-50" : "border-line bg-neutral-50 hover:bg-neutral-100"}`}>
      <span className="block text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="block text-xl font-semibold text-ink tabular-nums mt-1">{value}</span>
      {detail && <span className="block text-[10px] text-neutral-500 mt-0.5">{detail}</span>}
    </button>
  );
}
