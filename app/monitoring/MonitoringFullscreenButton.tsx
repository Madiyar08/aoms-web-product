"use client";

import { useEffect, useState } from "react";

export default function MonitoringFullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement?.id === "monitoring-fullscreen");
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    const target = document.getElementById("monitoring-fullscreen");
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      // Fullscreen may be blocked by browser policy; keep the page usable.
    }
  }

  return <button type="button" onClick={toggleFullscreen} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-slate-50" title={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть мониторинг на весь экран"}>{isFullscreen ? "↙ Свернуть экран" : "⛶ На весь экран"}</button>;
}
