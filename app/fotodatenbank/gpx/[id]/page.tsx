/**
 * GPX-Track Detailseite + Editor
 * Route: /fotodatenbank/gpx/[id]
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx, albums, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Mountain, Calendar, Globe } from "lucide-react";
import { TYP_EMOJI } from "@/lib/gpx/utils";
import GpxDetailClient from "./GpxDetailClient";

type Props = { params: Promise<{ id: string }> };

export default async function GpxDetailPage({ params }: Props) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) redirect("/login");

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (isNaN(trackId)) notFound();

  const rows = await db
    .select({
      id:           fdGpx.id,
      titel:        fdGpx.titel,
      beschreibung: fdGpx.beschreibung,
      typ:          fdGpx.typ,
      land:         fdGpx.land,
      laengeKm:     fdGpx.laengeKm,
      hoehmAuf:     fdGpx.hoehmAuf,
      datumTour:    fdGpx.datumTour,
      eingetragen:  fdGpx.eingetragen,
      albumId:      fdGpx.albumId,
      albumName:    albums.name,
      albumSlug:    albums.slug,
      gpxUrl:       fdGpx.gpxUrl,
      gpxDateiname: fdGpx.gpxDateiname,
      userName:     users.name,
    })
    .from(fdGpx)
    .leftJoin(albums, eq(fdGpx.albumId, albums.id))
    .leftJoin(users,  eq(fdGpx.userId,  users.id))
    .where(eq(fdGpx.id, trackId))
    .limit(1);

  const track = rows[0];
  if (!track) notFound();

  const alleAlben = await db
    .select({ id: albums.id, name: albums.name })
    .from(albums)
    .where(eq(albums.isActive, true))
    .orderBy(albums.name);

  const formatDatum = (d: Date | string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fotodatenbank/gpx" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{TYP_EMOJI[track.typ] ?? "🗺️"}</span>
            {track.titel}
          </h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-400">
            {track.laengeKm && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                {parseFloat(track.laengeKm).toFixed(1)} km
              </span>
            )}
            {track.hoehmAuf != null && track.hoehmAuf > 0 && (
              <span className="flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-green-400" />
                ↑ {track.hoehmAuf} m
              </span>
            )}
            {formatDatum(track.datumTour) && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {formatDatum(track.datumTour)}
              </span>
            )}
            {track.land && (
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                {track.land}
              </span>
            )}
            {track.albumName && track.albumSlug && (
              <span>
                Album:{" "}
                <Link href={`/alben/${track.albumSlug}`} className="text-blue-400 hover:text-blue-300">
                  {track.albumName}
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {track.beschreibung && (
        <p className="text-gray-400 text-sm mb-6 bg-gray-800/50 rounded-lg px-4 py-3">{track.beschreibung}</p>
      )}

      {/* Client-Komponente: GpxEditor + GpxMap */}
      <GpxDetailClient
        trackId={track.id}
        gpxUrl={track.gpxUrl}
        titel={track.titel}
        typ={track.typ}
        laengeKm={track.laengeKm}
        hoehmAuf={track.hoehmAuf}
        datumTour={track.datumTour}
        alben={alleAlben}
        albumId={track.albumId}
      />

      {/* Datei-Info */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-xs text-gray-500">
        <p>GPX-Datei: <span className="text-gray-300 font-mono">{track.gpxDateiname}</span></p>
        <p className="mt-1">URL: <a href={track.gpxUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{track.gpxUrl}</a></p>
        <p className="mt-1">Eingetragen: {formatDatum(track.eingetragen)} von {track.userName ?? "–"}</p>
      </div>
    </div>
  );
}
