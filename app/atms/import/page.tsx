import Link from "next/link";
import { ImportForm } from "./ImportForm";

export default function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/atms" className="text-[12px] text-route">
          ← Назад к банкоматам
        </Link>
        <h1 className="font-display text-2xl font-medium text-ink mt-2">Импорт банкоматов из Excel</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Существующие банкоматы (по совпадению ID) обновятся, новые — добавятся.
          История очисток и маршрутов не затрагивается.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
