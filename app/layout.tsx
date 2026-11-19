import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AOMS — ATM Operations Management",
  description: "Операционная система управления обслуживанием банкоматов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body className="font-sans"><AppShell>{children}</AppShell></body></html>;
}
