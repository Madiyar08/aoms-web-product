"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_SECONDS = 30;

export default function MonitoringAutoRefresh() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(REFRESH_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          router.refresh();
          return REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [router]);

  return <span title="Данные страницы обновляются автоматически каждые 30 секунд" className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-neutral-600">Автообновление через {seconds} сек.</span>;
}
