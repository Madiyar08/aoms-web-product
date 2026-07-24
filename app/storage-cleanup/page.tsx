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
      <StorageCleanupClient />
    </div>
  );
}
