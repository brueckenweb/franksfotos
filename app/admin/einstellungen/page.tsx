import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Database, Globe, Key, Info } from "lucide-react";

export default async function AdminEinstellungenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
  if (!isMainAdmin) redirect("/admin");

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
        <p className="text-gray-400 text-sm mt-0.5">System-Konfiguration</p>
      </div>

      <div className="space-y-4">
        {/* Upload-Konfiguration */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            Upload-Server
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Upload-Domain</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.UPLOAD_DOMAIN || "https://pics.frank-sellke.de"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Foto-Pfad</span>
              <span className="text-gray-300 font-mono text-xs">/fotos/</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Thumbnail-Pfad</span>
              <span className="text-gray-300 font-mono text-xs">/thumbs/</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Video-Pfad</span>
              <span className="text-gray-300 font-mono text-xs">/videos/</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">API-Schlüssel</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.UPLOAD_API_KEY ? "••••••••" : "nicht gesetzt ⚠️"}
              </span>
            </div>
          </div>
        </div>

        {/* Wasserzeichen */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            Wasserzeichen (Download)
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Text</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.WATERMARK_TEXT || "© FranksFotos – frank-sellke.de"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Deckkraft</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.WATERMARK_OPACITY || "0.4"}
              </span>
            </div>
          </div>
        </div>

        {/* Datenbank */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            Datenbank
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Engine</span>
              <span className="text-gray-300">MariaDB / Drizzle ORM</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">DATABASE_URL</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.DATABASE_URL ? "••••••••" : "nicht gesetzt ⚠️"}
              </span>
            </div>
          </div>
        </div>

        {/* System-Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            System-Info
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Framework</span>
              <span className="text-gray-300">Next.js 16 (App Router)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Auth</span>
              <span className="text-gray-300">NextAuth.js v5 (Credentials)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Node.js</span>
              <span className="text-gray-300 font-mono text-xs">{process.version}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Environment</span>
              <span className="text-gray-300 font-mono text-xs">
                {process.env.NODE_ENV || "development"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
