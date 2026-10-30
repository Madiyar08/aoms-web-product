import { StorageCleanupClient } from "./StorageCleanupClient";

export const dynamic = "force-dynamic";

export default function StorageCleanupPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Место на диске: фото</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Инструмент для освобождения места на диске Railway, если апгрейд тарифа сейчас недоступен.
        Начните с пережатия — оно почти всегда достаточно и не удаляет ничего.
      </p>

      <div className="bg-white border border-line rounded-[10px] p-5 mb-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-ink mb-1">Скачать полную базу данных</h2>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          Полная копия базы (банкоматы, отчёты, расписания, маршруты, сотрудники и т.д.) — для анализа,
          резервной копии или переноса. Скачивается ZIP-архив с файлом базы.
        </p>
        <a
          href="/api/admin/download-db"
          className="inline-block text-xs font-semibold bg-ink text-white rounded-md px-4 py-2"
        >
          ⬇ Скачать базу данных
        </a>
      </div>

      <StorageCleanupClient />
    </div>
  );
}
