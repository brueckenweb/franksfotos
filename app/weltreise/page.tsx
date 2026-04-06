export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import WeltreiseClient from "./WeltreiseClient";

export const metadata: Metadata = {
  title: "Meine Weltreise – FranksFotos",
  description: "Alle bereisten Länder, Städte und Sehenswürdigkeiten auf einen Blick.",
  openGraph: {
    title: "Meine Weltreise – FranksFotos",
    description: "Alle bereisten Länder, Städte und Sehenswürdigkeiten auf einen Blick.",
    type: "website",
  },
};

export default function WeltreisePage() {
  return <WeltreiseClient />;
}
