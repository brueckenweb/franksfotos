/**
 * GPX-Track hochladen – Formularseite
 * Route: /fotodatenbank/gpx/neu
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, fdFotogruppen } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import GpxUploadForm from "@/components/gpx/GpxUploadForm";

export const metadata = { title: "Neuen GPX-Track hochladen" };

export default async function GpxNeuPage() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) redirect("/login");

  const alleAlben = await db
    .select({ id: albums.id, name: albums.name, slug: albums.slug, parentId: albums.parentId })
    .from(albums)
    .where(eq(albums.isActive, true))
    .orderBy(albums.sortOrder, albums.name);

  // Nur aktive Fotogruppen für Dropdown
  const alleFotogruppen = await db
    .select({ idfgruppe: fdFotogruppen.idfgruppe, name: fdFotogruppen.name })
    .from(fdFotogruppen)
    .where(eq(fdFotogruppen.einaktiv, "ja"))
    .orderBy(asc(fdFotogruppen.name));

  return (
    <div className="p-6 pb-80">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fotodatenbank/gpx" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Neuen GPX-Track hochladen</h1>
      </div>
      <GpxUploadForm alben={alleAlben} fotogruppen={alleFotogruppen} />
    </div>
  );
}
