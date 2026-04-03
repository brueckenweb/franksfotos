/**
 * Fotogruppen-Übersicht
 * Listet alle Einträge aus fd_fotogruppen mit Filter-Funktion.
 * Route: /fotodatenbank/fotogruppen
 */

import type { Metadata } from "next";
import FotogruppenListe from "@/components/admin/FotogruppenListe";

export const metadata: Metadata = {
  title: "Fotogruppen – FranksFotos",
};

export default function FotogruppenPage() {
  return <FotogruppenListe />;
}
