import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, videos, albums, users, comments, pageViews } from "@/lib/db/schema";
import { count, countDistinct, desc, max, eq } from "drizzle-orm";
import {
  Camera, Film, FolderOpen, Users, MessageSquare,
  TrendingUp, Database, Eye, Globe, UserCheck, ArrowRight,
} from "lucide-react";
import DatabaseBackupPanel from "@/components/admin/DatabaseBackupPanel";
import Link from "next/link";

async function getStats() {
  try {
    const [photoCount] = await db.select({ count: count() }).from(photos);
    const [videoCount] = await db.select({ count: count() }).from(videos);
    const [albumCount] = await db.select({ count: count() }).from(albums);
    const [userCount] = await db.select({ count: count() }).from(users);
    const [commentCount] = await db.select({ count: count() }).from(comments);

    return {
      photos: photoCount.count,
      videos: videoCount.count,
      albums: albumCount.count,
      users: userCount.count,
      comments: commentCount.count,
    };
  } catch {
    return { photos: 0, videos: 0, albums: 0, users: 0, comments: 0 };
  }
}

async function getAccessStats() {
  try {
    const [{ totalViews }] = await db
      .select({ totalViews: count() })
      .from(pageViews);

    const [{ uniqueVisitors }] = await db
      .select({ uniqueVisitors: countDistinct(pageViews.ipAddress) })
      .from(pageViews);

    const userVisits = await db
      .select({
        userId:    users.id,
        name:      users.name,
        email:     users.email,
        visits:    count(pageViews.id),
        lastVisit: max(pageViews.createdAt),
      })
      .from(pageViews)
      .innerJoin(users, eq(pageViews.userId, users.id))
      .groupBy(users.id, users.name, users.email)
      .orderBy(desc(count(pageViews.id)))
      .limit(8);

    return { totalViews, uniqueVisitors, userVisits };
  } catch {
    return { totalViews: 0, uniqueVisitors: 0, userVisits: [] };
  }
}

export default async function AdminDashboard() {
  const session = await auth();
  const stats = await getStats();
  const accessStats = await getAccessStats();

  const statCards = [
    {
      label: "Fotos",
      value: stats.photos,
      icon: Camera,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      href: "/admin/fotos",
    },
    {
      label: "Videos",
      value: stats.videos,
      icon: Film,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      href: "/admin/videos",
    },
    {
      label: "Alben",
      value: stats.albums,
      icon: FolderOpen,
      color: "text-green-400",
      bg: "bg-green-500/10",
      href: "/admin/alben",
    },
    {
      label: "Benutzer",
      value: stats.users,
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      href: "/admin/benutzer",
    },
    {
      label: "Kommentare",
      value: stats.comments,
      icon: MessageSquare,
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      href: "/admin/kommentare",
    },
  ];

  const isMainAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Willkommen, {session?.user?.name} 👋
        </h1>
        <p className="text-gray-400 mt-1">FranksFotos Admin-Dashboard</p>
      </div>

      {/* Inhalts-Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <a
              key={card.label}
              href={card.href}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`${card.bg} rounded-lg p-2`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <span className="text-gray-400 text-sm">{card.label}</span>
              </div>
              <div className={`text-3xl font-bold ${card.color}`}>
                {card.value.toLocaleString("de-DE")}
              </div>
            </a>
          );
        })}
      </div>

      {/* Schnellzugriff & Datenbank-Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            Schnellzugriff
          </h2>
          <div className="space-y-2">
            <a
              href="/admin/upload"
              className="flex items-center gap-3 text-gray-300 hover:text-amber-400 hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Fotos/Videos hochladen
            </a>
            <a
              href="/admin/alben/neu"
              className="flex items-center gap-3 text-gray-300 hover:text-amber-400 hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Neues Album erstellen
            </a>
            <a
              href="/admin/benutzer/neu"
              className="flex items-center gap-3 text-gray-300 hover:text-amber-400 hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Users className="w-4 h-4" />
              Neuen Benutzer anlegen
            </a>
            {isMainAdmin && (
              <a
                href="/fotodatenbank"
                className="flex items-center gap-3 text-gray-300 hover:text-amber-400 hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
              >
                <Database className="w-4 h-4" />
                Fotodatenbank Eingabe
              </a>
            )}
          </div>
        </div>

        <DatabaseBackupPanel />
      </div>

      {/* Zugriffsstatistik-Übersicht (nur für Main-Admin) */}
      {isMainAdmin && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" />
              Zugriffsstatistik
            </h2>
            <Link
              href="/admin/statistik"
              className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 3 Kennzahlen-Karten */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-cyan-500/10 rounded-lg p-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="text-gray-400 text-sm">Seitenaufrufe (gesamt)</span>
              </div>
              <div className="text-3xl font-bold text-cyan-400">
                {accessStats.totalViews.toLocaleString("de-DE")}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-teal-500/10 rounded-lg p-2">
                  <Globe className="w-5 h-5 text-teal-400" />
                </div>
                <span className="text-gray-400 text-sm">Unique Besucher (gesamt)</span>
              </div>
              <div className="text-3xl font-bold text-teal-400">
                {accessStats.uniqueVisitors.toLocaleString("de-DE")}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-violet-500/10 rounded-lg p-2">
                  <UserCheck className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-gray-400 text-sm">Angemeldete Besucher</span>
              </div>
              <div className="text-3xl font-bold text-violet-400">
                {accessStats.userVisits.length.toLocaleString("de-DE")}
              </div>
            </div>
          </div>

          {/* Benutzer-Besuche Tabelle */}
          {accessStats.userVisits.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-violet-400" />
                  Benutzer-Besuche (alle Zeiten)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Benutzer</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Aufrufe</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium hidden sm:table-cell">Letzter Besuch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessStats.userVisits.map((uv, i) => (
                      <tr
                        key={uv.userId}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                          i === accessStats.userVisits.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-medium flex-shrink-0">
                              {uv.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white font-medium">{uv.name}</div>
                              <div className="text-gray-500 text-xs">{uv.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-violet-400 font-semibold">
                            {uv.visits.toLocaleString("de-DE")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">
                          {uv.lastVisit
                            ? new Date(uv.lastVisit).toLocaleString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-800">
                <Link
                  href="/admin/statistik"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  Vollständige Statistik ansehen
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
