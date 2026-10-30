import Script from "next/script";
import { MiniAppClient } from "./MiniAppClient";

export const dynamic = "force-dynamic";

export default function MiniAppPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <style>{`aside { display: none !important; } main { padding: 0 !important; background: #f9fafb !important; }`}</style>
      <div className="min-h-screen bg-gray-50">
        <MiniAppClient />
      </div>
    </>
  );
}
