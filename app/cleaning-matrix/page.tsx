import { todayTashkent } from "@/lib/tz";

export const dynamic = "force-dynamic";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function CleaningMatrixPage() {
  const today = todayTashkent();
  const monthAgo = addDays(today, -29);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Матрица очистки (Excel)</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Все банкоматы по строкам, даты по столбцам, «1» — банкомат был очищен в этот день. Тот же принцип,
        что и в прежней ручной Excel-таблице, только строится автоматически из реальных отчётов —
        не нужно искать вручную по сообщениям в группе.
      </p>

      <form action="/api/atms/coverage-export" method="get" className="bg-white border border-line rounded-[10px] p-4 max-w-md flex flex-col gap-3">
        <div>
          <label className="block text-[12px] text-neutral-500 mb-1">С даты</label>
          <input type="date" name="from" defaultValue={monthAgo} max={today} className="input w-full" />
        </div>
        <div>
          <label className="block text-[12px] text-neutral-500 mb-1">По дату</label>
          <input type="date" name="to" defaultValue={today} max={today} className="input w-full" />
        </div>
        <button className="text-xs font-semibold bg-ink text-white rounded-md px-3 py-2">
          Скачать матрицу Excel
        </button>
        <p className="text-[11px] text-neutral-400">
          По умолчанию — последние 30 дней. Большой диапазон (год и больше) может формироваться дольше.
        </p>
      </form>
    </div>
  );
}
