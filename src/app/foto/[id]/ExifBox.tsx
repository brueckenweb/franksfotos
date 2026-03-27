"use client";

import dynamic from "next/dynamic";
import { Camera, Calendar, MapPin, Aperture, Clock, Copyright } from "lucide-react";

// ExifMap wird nur client-seitig geladen (kein SSR)
const ExifMap = dynamic(() => import("./ExifMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-lg border border-gray-700 bg-gray-800 animate-pulse"
      style={{ height: "180px" }}
    />
  ),
});

// ----------------------------------------------------------------
// GPS-Hilfsfunktion: DMS-Array oder Dezimalzahl → Dezimalzahl
// ----------------------------------------------------------------
function gpsToDecimal(val: unknown, ref?: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    const r = typeof ref === "string" ? ref.toUpperCase() : "";
    return r === "S" || r === "W" ? -val : val;
  }
  if (Array.isArray(val) && val.length >= 2) {
    const [deg, min, sec = 0] = val as number[];
    const decimal = deg + min / 60 + sec / 3600;
    const r = typeof ref === "string" ? ref.toUpperCase() : "";
    return r === "S" || r === "W" ? -decimal : decimal;
  }
  return null;
}

// ----------------------------------------------------------------
// Datum aus EXIF formatieren
// ----------------------------------------------------------------
function formatExifDate(raw: unknown): string {
  if (!raw) return "";
  try {
    const normalized = String(raw).replace(
      /^(\d{4}):(\d{2}):(\d{2})/,
      "$1-$2-$3"
    );
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(raw);
  }
}

// ----------------------------------------------------------------
// Props & Komponente
// ----------------------------------------------------------------
interface ExifBoxProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exifData: Record<string, any> | null | undefined;
}

export default function ExifBox({ exifData }: ExifBoxProps) {
  if (!exifData) return null;

  // Safeguard: Falls Drizzle/MariaDB die JSON-Spalte als String liefert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any> = exifData;
  if (typeof exifData === "string") {
    try {
      parsed = JSON.parse(exifData);
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = parsed as Record<string, any>;

  const dateRaw =
    e.DateTimeOriginal ??
    e.dateTimeOriginal ??
    e.DateTime ??
    e.dateTime ??
    e.CreateDate ??
    e.createDate ??
    null;
  const make = e.Make ?? e.make ?? null;
  const model = e.Model ?? e.model ?? null;
  const fNumber = e.FNumber ?? e.fNumber ?? e.ApertureValue ?? e.apertureValue ?? null;
  const exposureTime = e.ExposureTime ?? e.exposureTime ?? e.ShutterSpeedValue ?? null;
  const iso =
    e.ISOSpeedRatings ??
    e.ISO ??
    e.iso ??
    e.PhotographicSensitivity ??
    e.photographicSensitivity ??
    null;
  const copyright = e.Copyright ?? e.copyright ?? e.Rights ?? e.rights ?? null;

  // exifr liefert GPS entweder als latitude/longitude (Dezimal)
  // oder als GPSLatitude/GPSLongitude (DMS-Array) + Ref
  const lat = gpsToDecimal(
    e.GPSLatitude ?? e.gpsLatitude ?? e.latitude ?? null,
    e.GPSLatitudeRef ?? e.gpsLatitudeRef ?? null
  );
  const lon = gpsToDecimal(
    e.GPSLongitude ?? e.gpsLongitude ?? e.longitude ?? null,
    e.GPSLongitudeRef ?? e.gpsLongitudeRef ?? null
  );

  const hasCoords = lat !== null && lon !== null;
  const dateLabel = formatExifDate(dateRaw);
  const cameraLabel = [make, model].filter(Boolean).join(" ");

  const hasAnyData =
    dateLabel || cameraLabel || fNumber || exposureTime || iso || hasCoords || copyright;

  if (!hasAnyData) {
    // Fallback: Rohdaten anzeigen damit man erkennt welche Keys vorhanden sind
    const rawKeys = Object.keys(e);
    if (rawKeys.length === 0) return null;
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-gray-800/50">
          <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-white">EXIF-Rohdaten</h2>
        </div>
        <div className="p-5">
          <pre className="text-xs text-gray-400 overflow-auto max-h-64 whitespace-pre-wrap break-all">
            {JSON.stringify(e, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Kopfzeile */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-gray-800/50">
        <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <h2 className="text-sm font-semibold text-white">
          Aufnahme-Informationen
        </h2>
      </div>

      <div className="p-5 space-y-3">
        {/* Datum */}
        {dateLabel && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                Aufgenommen am
              </p>
              <p className="text-sm text-gray-200">{dateLabel}</p>
            </div>
          </div>
        )}

        {/* Kamera */}
        {cameraLabel && (
          <div className="flex items-start gap-3">
            <Camera className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                Kamera
              </p>
              <p className="text-sm text-gray-200">{cameraLabel}</p>
            </div>
          </div>
        )}

        {/* Copyright */}
        {copyright && (
          <div className="flex items-start gap-3">
            <Copyright className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                Copyright
              </p>
              <p className="text-sm text-gray-200">{String(copyright)}</p>
            </div>
          </div>
        )}

        {/* Technik (Blende / Belichtung / ISO) */}
        {(fNumber || exposureTime || iso) && (
          <div className="flex flex-wrap gap-4 pt-1 border-t border-gray-800/60">
            {fNumber && (
              <div className="flex items-center gap-1.5">
                <Aperture className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-400">
                  f/<span className="text-gray-200">{fNumber}</span>
                </span>
              </div>
            )}
            {exposureTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-400">
                  <span className="text-gray-200">{exposureTime}</span> s
                </span>
              </div>
            )}
            {iso && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-500 leading-none">
                  ISO
                </span>
                <span className="text-xs text-gray-200">{iso}</span>
              </div>
            )}
          </div>
        )}

        {/* GPS-Koordinaten + Karte */}
        {hasCoords && (
          <div className="pt-1 border-t border-gray-800/60 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Aufnahmeort
                </p>
                <a
                  href={`https://www.google.com/maps?q=${lat!.toFixed(6)},${lon!.toFixed(6)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  {lat!.toFixed(5)}°, {lon!.toFixed(5)}° ↗
                </a>
              </div>
            </div>

            {/* Leaflet-Karte */}
            <ExifMap lat={lat!} lon={lon!} />
          </div>
        )}
      </div>
    </div>
  );
}
