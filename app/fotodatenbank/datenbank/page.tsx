/**
 * Fotodatenbank-Browser
 * Route: /fotodatenbank/datenbank
 * Auth-Prüfung erfolgt im Layout (app/fotodatenbank/layout.tsx)
 */

import type { Metadata } from "next";
import FotodatenbankBrowser from "@/components/admin/FotodatenbankBrowser";

export const metadata: Metadata = {
  title: "Fotodatenbank Browser – FranksFotos",
};

export default function FotodatenbankDatenbankPage() {
  return <FotodatenbankBrowser />;
}
