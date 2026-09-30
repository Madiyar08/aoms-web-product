import { listChangeRequests } from "@/lib/atm-change-history";
import { ChangeQueueClient } from "./ChangeQueueClient";

export const dynamic = "force-dynamic";

export default function ChangeQueuePage() {
  const all = listChangeRequests();
  const pending = all.filter((r) => r.status === "pending");
  const applied = all.filter((r) => r.status === "applied");

  // Считаем, сколько РАЗНЫХ дней уже накопилось в каждой группе
  // (банкомат/код + тип изменения) — чтобы показать прогресс к порогу 3.
  const distinctDaysByGroup: Record<string, number> = {};
  for (const r of pending) {
    const key = `${r.atmId || r.atmCode}|${r.changeType}`;
    if (!distinctDaysByGroup[key]) {
      const days = new Set(
        pending.filter((x) => `${x.atmId || x.atmCode}|${x.changeType}` === key).map((x) => x.reportDate)
      );
      distinctDaysByGroup[key] = days.size;
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Очередь изменений банкоматов</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Единая очередь для сигналов о неверном адресе/координатах/районе и заявок на новые банкоматы.
        Применяется автоматически после 3 подтверждений в РАЗНЫЕ дни (не от разных людей — работает и там,
        где район обслуживает один экипаж), либо по вашему ручному решению в любой момент.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Ожидают</div>
          <div className="text-xl font-mono text-st-orange">{pending.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Применено</div>
          <div className="text-xl font-mono text-st-green">{applied.length}</div>
        </div>
      </div>

      <ChangeQueueClient pending={pending} distinctDaysByGroup={distinctDaysByGroup} />
    </div>
  );
}
