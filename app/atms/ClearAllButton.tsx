"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAllAtmsAction } from "./actions";

export function ClearAllButton({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (count === 0) return null;

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold border border-st-red/40 text-st-red rounded-md px-3 py-2 bg-white hover:bg-st-red-bg"
      >
        Очистить все банкоматы
      </button>
    );
  }

  return (
    <div className="bg-st-red-bg border border-st-red/30 rounded-lg p-4 max-w-md">
      <p className="text-[13px] text-st-red font-semibold mb-1">
        Удалить все {count} банкоматов?
      </p>
      <p className="text-[11.5px] text-neutral-600 mb-3">
        Это удалит только банкоматы. Сотрудники, машины, расписание и настройки останутся.
        Действие необратимо. Для подтверждения введите слово <b>УДАЛИТЬ</b> ниже.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="УДАЛИТЬ"
          className="input !w-32 !py-1.5"
        />
        <button
          disabled={typed.trim().toUpperCase() !== "УДАЛИТЬ" || isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteAllAtmsAction();
              setConfirming(false);
              setTyped("");
              router.refresh();
            })
          }
          className="text-xs font-semibold bg-st-red text-white rounded-md px-3 py-2 disabled:opacity-40"
        >
          {isPending ? "Удаляем…" : "Подтвердить удаление"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          className="text-[11px] text-neutral-500"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
