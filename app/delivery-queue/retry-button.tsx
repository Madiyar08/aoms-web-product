"use client";
import { useState } from "react";
import { retryDeliveryJobAction } from "./actions";
export function RetryButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return <button className="text-route underline disabled:opacity-50" disabled={busy} onClick={async () => { setBusy(true); try { await retryDeliveryJobAction(id); } finally { setBusy(false); } }}>{busy ? "Запуск…" : "Повторить"}</button>;
}
