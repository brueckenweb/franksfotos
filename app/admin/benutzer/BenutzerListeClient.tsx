"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { UserCheck, UserX, Crown, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type UserGroup = { name: string; slug: string };

type User = {
  id: number;
  email: string;
  name: string;
  isActive: boolean | null;
  isMainAdmin: boolean | null;
  createdAt: Date;
  groups: UserGroup[];
};

type SortKey = "name" | "email" | "createdAt" | "isActive";
type SortDir = "asc" | "desc";

export default function BenutzerListeClient({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.groups.some((g) => g.name.toLowerCase().includes(q))
    );
  }, [users, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "de");
      else if (sortKey === "email") cmp = a.email.localeCompare(b.email, "de");
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "isActive") cmp = Number(a.isActive ?? false) - Number(b.isActive ?? false);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <>
      {/* Suchfeld */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Name, E-Mail oder Gruppe suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Trefferanzahl */}
      {search && (
        <p className="text-xs text-gray-500 mb-3">
          {sorted.length} von {users.length} Benutzern
        </p>
      )}

      {/* Mobile Card-Layout (bis md) */}
      <div className="md:hidden space-y-3">
        {sorted.map((user) => (
          <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300 flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-medium truncate">{user.name}</span>
                    {user.isMainAdmin && (
                      <span title="Hauptadmin">
                        <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <Link
                href={`/admin/benutzer/${user.id}/edit`}
                className="flex-shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-amber-400 text-xs transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 hover:border-amber-500/50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Bearbeiten
              </Link>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div>
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                    <UserCheck className="w-3 h-3" /> Aktiv
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                    <UserX className="w-3 h-3" /> Inaktiv
                  </span>
                )}
              </div>
              {user.groups.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {user.groups.map((g) => (
                    <span key={g.slug} className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
              <span className="text-gray-600 text-xs ml-auto">
                {new Date(user.createdAt).toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            {search ? "Keine Benutzer gefunden." : "Keine Benutzer vorhanden."}
          </div>
        )}
      </div>

      {/* Desktop Tabellen-Layout (ab md) */}
      <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                <button
                  onClick={() => handleSort("name")}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  Benutzer <SortIcon col="name" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Gruppen</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">
                <button
                  onClick={() => handleSort("isActive")}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  Status <SortIcon col="isActive" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">
                <button
                  onClick={() => handleSort("createdAt")}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  Registriert <SortIcon col="createdAt" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((user) => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300 flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium">{user.name}</span>
                        {user.isMainAdmin && (
                          <span title="Hauptadmin">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.groups.length === 0 ? (
                      <span className="text-gray-600 text-xs">Keine Gruppe</span>
                    ) : (
                      user.groups.map((g) => (
                        <span key={g.slug} className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                          {g.name}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                      <UserCheck className="w-3 h-3" /> Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                      <UserX className="w-3 h-3" /> Inaktiv
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/benutzer/${user.id}/edit`}
                      className="text-gray-400 hover:text-amber-400 text-xs transition-colors px-2 py-1 rounded hover:bg-gray-800"
                    >
                      Bearbeiten
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            {search ? "Keine Benutzer gefunden." : "Keine Benutzer vorhanden."}
          </div>
        )}
      </div>
    </>
  );
}
