/**
 * Layout für die eigenständige Fotodatenbank-Eingabe-Seite
 * Eigene Navigationsleiste – unabhängig vom Admin-Layout
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import { Database, LayoutDashboard, List } from "lucide-react";

export const metadata: Metadata = {
  title: "Fotodatenbank – FranksFotos",
};

export default async function FotodatenbankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Nicht eingeloggt → Login
  if (!session?.user) {
    redirect("/login");
  }

  // Nur Hauptadmin
  const isMainAdmin = !!(session.user as { isMainAdmin?: boolean }).isMainAdmin;
  if (!isMainAdmin) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Navigationsleiste ─────────────────────────────────────── */}
      <nav className="bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
          {/* Logo / Titel */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">
              Fotodatenbank Eingabe
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Navigation rechts */}
          <div className="flex items-center gap-1">
            <Link
              href="/fotodatenbank"
              className="flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Eingabe</span>
            </Link>
            <Link
              href="/fotodatenbank/fotogruppen"
              className="flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Fotogruppen</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Admin-Dashboard</span>
            </Link>

            {/* Benutzer-Info */}
            <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-gray-800">
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-medium flex-shrink-0">
                {session.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <span className="text-gray-400 text-sm">
                {session.user?.name}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hauptinhalt ───────────────────────────────────────────── */}
      <main className="flex-1 p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
