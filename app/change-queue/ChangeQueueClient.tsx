"use client";

import { useState } from "react";

interface Req {
  id: string;
  atmId: string;
  atmCode: string;
  changeType: string;
  oldAddress?: string;
  oldDistrict?: string;
  oldLat?: string;
  oldLon?: string;
  newLat?: string;
  newLon?: string;
  newDistrict?: string;
  newAddressText?: string;
  comment: string;
  employeeName: string;
  reportDate: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  location: "Координаты/адрес",
  district: "Район",
  new_atm: "Новый банкомат",
};

export function ChangeQueueClient({ pending, distinctDaysByGroup }: { pending: Req[]; distinctDaysByGroup: Record<string, number> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState(pending);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await fetch(`/api/change-queue/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
        Очередь пуста — все заявки либо применены автоматически (3 разных дня), либо ещё не поданы.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((r) => {
        const groupKey = `${r.atmId || r.atmCode}|${r.changeType}`;
        const days = distinctDaysByGroup[groupKey] || 1;
        return (
          <div key={r.id} className="bg-white border border-line rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] bg-brass/10 text-brass rounded-full px-2 py-0.5">
                {TYPE_LABEL[r.changeType] || r.changeType}
              </span>
              <span className="text-[11px] text-neutral-400">
                Подтверждений: {days} из 3 разных дней
              </span>
            </div>
            <div className="text-sm font-medium text-ink mb-1">{r.atmCode || "без ID"}</div>
            {r.changeType === "location" && (
              <div className="text-[12px] text-neutral-600 mb-1">
                Было: {r.oldLat}, {r.oldLon} → Предложено: {r.newLat}, {r.newLon}
              </div>
            )}
            {r.changeType === "district" && (
              <div className="text-[12px] text-neutral-600 mb-1">
                Было: {r.oldDistrict || "—"} → Предложено: {r.newDistrict}
              </div>
            )}
            {r.changeType === "new_atm" && (
              <div className="text-[12px] text-neutral-600 mb-1">
                Координаты: {r.newLat}, {r.newLon}
                {r.newAddressText && <div>Адрес (со слов сотрудника): {r.newAddressText}</div>}
              </div>
            )}
            <div className="text-[12px] text-neutral-500 mb-2">
              {r.employeeName} · {r.reportDate}
            </div>
            {r.comment && <div className="text-[12px] text-neutral-600 mb-2">«{r.comment}»</div>}
            <div className="flex gap-2">
              <button
                onClick={() => act(r.id, "approve")}
                disabled={busyId === r.id}
                className="flex-1 text-xs font-semibold bg-st-green text-white rounded-md px-3 py-2 disabled:opacity-50"
              >
                Подтвердить сейчас
              </button>
              <button
                onClick={() => act(r.id, "reject")}
                disabled={busyId === r.id}
                className="text-xs font-semibold border border-st-red/40 text-st-red rounded-md px-3 py-2"
              >
                Отклонить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
