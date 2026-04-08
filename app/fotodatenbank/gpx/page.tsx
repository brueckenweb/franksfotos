/**
 * GPX-Tracks – Übersichtsseite (Admin)
 * Route: /fotodatenbank/gpx
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx, fdFotogruppen, albums, users } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import GpxListClient from "./GpxListClient";

export const metadata = { title: "GPX-Tracks – Fotodatenbank" };

export default async function GpxUebersichtPage() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) redirect("/login");

  const rows = await db
    .select({
      id:              fdGpx.id,
      titel:           fdGpx.titel,
      typ:             fdGpx.typ,
      land:            fdGpx.land,
      laengeKm:        fdGpx.laengeKm,
      hoehmAuf:        fdGpx.hoehmAuf,
      datumTour:       fdGpx.datumTour,
      eingetragen:     fdGpx.eingetragen,
      albumId:         fdGpx.albumId,
      albumName:       albums.name,
      albumSlug:       albums.slug,
      fotogruppeId:    fdGpx.fotogruppeId,
      fotogruppenName: fdFotogruppen.name,
      userName:        users.name,
    })
    .from(fdGpx)
    .leftJoin(albums,        eq(fdGpx.albumId,      albums.id))
    .leftJoin(users,         eq(fdGpx.userId,       users.id))
    .leftJoin(fdFotogruppen, eq(fdGpx.fotogruppeId, fdFotogruppen.idfgruppe))
    .orderBy(desc(fdGpx.eingetragen))
    .limit(200);

  // Alben für Dropdown im Edit-Modal
  const alleAlben = await db
    .select({ id: albums.id, name: albums.name, parentId: albums.parentId })
    .from(albums)
    .where(eq(albums.isActive, true))
    .orderBy(albums.sortOrder, albums.name);

  // Fotogruppen für Dropdown (nur aktive)
  const alleFotogruppen = await db
    .select({ idfgruppe: fdFotogruppen.idfgruppe, name: fdFotogruppen.name })
    .from(fdFotogruppen)
    .where(eq(fdFotogruppen.einaktiv, "ja"))
    .orderBy(asc(fdFotogruppen.name));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">GPX-Tracks</h1>
          <p className="text-gray-400 text-sm mt-1">{rows.length} Track{rows.length !== 1 ? "s" : ""} gespeichert</p>
        </div>
        <Link
          href="/fotodatenbank/gpx/neu"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuen Track hochladen
        </Link>
      </div>

      <GpxListClient tracks={rows} alben={alleAlben} fotogruppen={alleFotogruppen} />
    </div>
  );
}
