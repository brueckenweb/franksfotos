export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import WeltreiseMapClient from "./WeltreiseMapClient";

export const metadata: Metadata = {
  title: "Meine Weltreise – FranksFotos",
  description: "Alle bereisten Länder, Städte und Sehenswürdigkeiten auf einen Blick.",
  openGraph: {
    title: "Meine Weltreise – FranksFotos",
    description: "Alle bereisten Länder, Städte und Sehenswürdigkeiten auf einen Blick.",
    type: "website",
  },
};

type Props = { params: Promise<{ mapId: string }> };

export default async function WeltreiseMapPage({ params }: Props) {
  const { mapId } = await params;
  return <WeltreiseMapClient mapId={parseInt(mapId)} />;
}
