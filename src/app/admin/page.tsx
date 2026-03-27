import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, videos, albums, users, comments } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { Camera, Film, FolderOpen, Users, MessageSquare, TrendingUp } from "lucide-react";

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

export default async function AdminDashboard() {
  const session = await auth();
  const stats = await getStats();

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Willkommen, {session?.user?.name} 👋
        </h1>
        <p className="text-gray-400 mt-1">FranksFotos Admin-Dashboard</p>
      </div>

      {/* Stats-Grid */}
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

      {/* Schnellzugriff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            ℹ️ System-Info
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Upload-Domain:</span>
              <span className="text-gray-300 font-mono text-xs">pics.frank-sellke.de</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Next.js Version:</span>
              <span className="text-gray-300">16.x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Datenbank:</span>
              <span className="text-gray-300">MariaDB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
