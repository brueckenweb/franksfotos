"use client";

/**
 * /admin/statistik – Detaillierte Zugriffsstatistik
 * Client-Komponente die per API-Call die Daten lädt und filtert.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Eye, Globe, UserCheck, BarChart2, Clock, RefreshCw,
  TrendingUp, FileText,
} from "lucide-react";

// ── Typen ────────────────────────────────────────────────────────────────────
interface UserVisit {
  userId: number;
  name: string;
  email: string;
  visits: number;
  lastVisit: string | null;
}

interface TopPage {
  path: string;
  views: number;
  uniqueVisitors: number;
}

interface RecentVisit {
  id: number;
  path: string;
  ipAddress: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

interface DailyStat {
  day: string;
  views: number;
}

interface StatsData {
  totalViews: number;
  uniqueVisitors: number;
  periodViews: number;
  periodVisitors: number;
  days: number;
  userVisits: UserVisit[];
  topPages: TopPage[];
  recentVisits: RecentVisit[];
  dailyStats: DailyStat[];
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("de-DE");
}

function fmtDate(s: string | null) {
  if (!s) return "–";
  return new Date(s).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// SVG-Linien-Chart (glatte Kurve, ohne externe Bibliothek)
function MiniLineChart({ data }: { data: DailyStat[] }) {
  const [tooltip, setTooltip] = useState<{ day: string; views: number; xPct: number; yPct: number } | null>(null);

  if (!data.length) return <p className="text-gray-500 text-sm">Keine Daten vorhanden.</p>;

  const W = 800;
  const H = 96;
  const PAD = 4;

  const max = Math.max(...data.map((d) => d.views), 1);
  const n = data.length;

  // Koordinate für jeden Datenpunkt
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - d.views / max) * (H - PAD * 2),
    ...d,
  }));

  // Smooth-Bezier-Pfad
  function smoothPath(points: typeof pts): string {
    if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  const linePath = smoothPath(pts);
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <div className="relative w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {/* Gefüllte Fläche */}
        <path d={areaPath} fill="url(#chartGrad)" />
        {/* Linie */}
        <path
          d={linePath}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Datenpunkte */}
        {pts.map((p) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={tooltip?.day === p.day ? 5 : 3}
            fill="#22d3ee"
            className="cursor-pointer transition-all"
            onMouseEnter={() =>
              setTooltip({
                day: p.day,
                views: p.views,
                xPct: (p.x / W) * 100,
                yPct: (p.y / H) * 100,
              })
            }
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {/* Tooltip-Overlay */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-gray-800 border border-gray-600 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{
            left: `${tooltip.xPct}%`,
            top: `${tooltip.yPct}%`,
            marginTop: "-8px",
          }}
        >
          <span className="text-gray-400">{tooltip.day}</span>
          <br />
          <span className="font-semibold text-cyan-400">{tooltip.views} Aufrufe</span>
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function StatistikPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/page-views-stats?days=${d}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const periodOptions = [
    { label: "Heute", value: 1 },
    { label: "7 Tage", value: 7 },
    { label: "30 Tage", value: 30 },
    { label: "90 Tage", value: 90 },
    { label: "1 Jahr", value: 365 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-cyan-400" />
            Zugriffsstatistik
          </h1>
          <p className="text-gray-400 mt-1">Seitenaufrufe, Besucher & Benutzer-Aktivität</p>
        </div>
        <button
          onClick={() => load(days)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {/* Zeitraum-Filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {periodOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => setDays(o.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              days === o.value
                ? "bg-cyan-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-24 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Lade Statistiken…
        </div>
      )}

      {data && (
        <>
          {/* Kennzahlen-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Gesamt-Aufrufe */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-500">Gesamt-Aufrufe</span>
              </div>
              <div className="text-3xl font-bold text-cyan-400">{fmt(data.totalViews)}</div>
              <div className="text-xs text-gray-600 mt-1">alle Zeiten</div>
            </div>

            {/* Gesamt Unique Besucher */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-teal-400" />
                <span className="text-xs text-gray-500">Unique Besucher</span>
              </div>
              <div className="text-3xl font-bold text-teal-400">{fmt(data.uniqueVisitors)}</div>
              <div className="text-xs text-gray-600 mt-1">alle Zeiten (nach IP)</div>
            </div>

            {/* Zeitraum-Aufrufe */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-500">Aufrufe ({days}d)</span>
              </div>
              <div className="text-3xl font-bold text-amber-400">{fmt(data.periodViews)}</div>
              <div className="text-xs text-gray-600 mt-1">letzten {days} Tage</div>
            </div>

            {/* Zeitraum Unique Besucher */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-gray-500">Besucher ({days}d)</span>
              </div>
              <div className="text-3xl font-bold text-violet-400">{fmt(data.periodVisitors)}</div>
              <div className="text-xs text-gray-600 mt-1">letzten {days} Tage</div>
            </div>
          </div>

          {/* Täglicher Mini-Chart */}
          {data.dailyStats.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Tägliche Aufrufe – letzte {days} Tage
              </h2>
              <MiniLineChart data={data.dailyStats} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{data.dailyStats[0]?.day}</span>
                <span>{data.dailyStats[data.dailyStats.length - 1]?.day}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top-Seiten */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Top-Seiten ({days} Tage)
                </h2>
              </div>
              {data.topPages.length === 0 ? (
                <p className="text-gray-500 text-sm px-5 py-6">Keine Daten im Zeitraum.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-5 py-3 text-gray-500 font-medium">Seite</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Aufrufe</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium hidden sm:table-cell">Besucher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr
                          key={p.path}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                            i === data.topPages.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <td className="px-5 py-3 text-gray-300 truncate max-w-[180px]" title={p.path}>
                            {p.path}
                          </td>
                          <td className="px-5 py-3 text-right text-amber-400 font-semibold">
                            {fmt(p.views)}
                          </td>
                          <td className="px-5 py-3 text-right text-teal-400 hidden sm:table-cell">
                            {fmt(p.uniqueVisitors)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Benutzer-Besuche */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-violet-400" />
                  Angemeldete Benutzer (alle Zeiten)
                </h2>
              </div>
              {data.userVisits.length === 0 ? (
                <p className="text-gray-500 text-sm px-5 py-6">Noch keine eingeloggten Besucher.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-5 py-3 text-gray-500 font-medium">Benutzer</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Aufrufe</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium hidden md:table-cell">Zuletzt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.userVisits.map((uv, i) => (
                        <tr
                          key={uv.userId}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                            i === data.userVisits.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-medium flex-shrink-0">
                                {uv.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white">{uv.name}</div>
                                <div className="text-gray-500 text-xs">{uv.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-violet-400 font-semibold">
                            {fmt(uv.visits)}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                            {fmtDate(uv.lastVisit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Letzte Einzelaufrufe */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Letzte 25 Seitenaufrufe
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Seite</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium hidden sm:table-cell">Benutzer / IP</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVisits.map((rv, i) => (
                    <tr
                      key={rv.id}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                        i === data.recentVisits.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-5 py-3 text-gray-300 truncate max-w-[200px]" title={rv.path}>
                        {rv.path}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        {rv.userName ? (
                          <span className="text-violet-400">{rv.userName}</span>
                        ) : (
                          <span className="text-gray-500 font-mono text-xs">{rv.ipAddress ?? "–"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(rv.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
