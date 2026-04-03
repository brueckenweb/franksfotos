/**
 * Fotodatenbank Eingabe – eigenständige Seite
 * Auth-Prüfung erfolgt im Layout (app/fotodatenbank/layout.tsx)
 * Route: /fotodatenbank
 */

import type { Metadata } from "next";
import FotodatenbankEingabe from "@/components/admin/FotodatenbankEingabe";

export const metadata: Metadata = {
  title: "Fotodatenbank Eingabe – FranksFotos",
};

export default function FotodatenbankPage() {
  return <FotodatenbankEingabe />;
}
