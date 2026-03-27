"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import {
  Camera,
  Film,
  FolderOpen,
  Users,
  Tag,
  MessageSquare,
  LogOut,
  LayoutDashboard,
  Upload,
  Shield,
  Settings,
} from "lucide-react";

interface AdminNavProps {
  session: Session;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Upload",
    href: "/admin/upload",
    icon: Upload,
  },
  {
    label: "Fotos",
    href: "/admin/fotos",
    icon: Camera,
  },
  {
    label: "Videos",
    href: "/admin/videos",
    icon: Film,
  },
  {
    label: "Alben",
    href: "/admin/alben",
    icon: FolderOpen,
  },
  {
    label: "Tags",
    href: "/admin/tags",
    icon: Tag,
  },
  {
    label: "Kommentare",
    href: "/admin/kommentare",
    icon: MessageSquare,
  },
];

const adminOnlyItems = [
  {
    label: "Benutzer",
    href: "/admin/benutzer",
    icon: Users,
  },
  {
    label: "Gruppen & Rechte",
    href: "/admin/gruppen",
    icon: Shield,
  },
  {
    label: "Einstellungen",
    href: "/admin/einstellungen",
    icon: Settings,
  },
];

export default function AdminNav({ session }: AdminNavProps) {
  const pathname = usePathname();
  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin;

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">FranksFotos</div>
            <div className="text-gray-500 text-xs">Admin</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 overflow-y-auto">
        {/* Hauptnavigation */}
        <div className="px-3 mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
            Galerie
          </div>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-amber-500/10 text-amber-400"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Admin-Only */}
        {isMainAdmin && (
          <div className="px-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              Administration
            </div>
            <ul className="space-y-1">
              {adminOnlyItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-amber-500/10 text-amber-400"
                          : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* User-Info & Logout */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-sm font-medium">
            {session.user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {session.user?.name}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {session.user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </nav>
  );
}
