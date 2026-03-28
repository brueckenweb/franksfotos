import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userGroups, groups } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Plus, UserCheck, UserX, Crown } from "lucide-react";

async function getUsersWithGroups() {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        isMainAdmin: users.isMainAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const usersWithGroups = await Promise.all(
      allUsers.map(async (user) => {
        const groupData = await db
          .select({ name: groups.name, slug: groups.slug })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(eq(userGroups.userId, user.id));
        return { ...user, groups: groupData };
      })
    );

    return usersWithGroups;
  } catch {
    return [];
  }
}

export default async function AdminBenutzerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentUserIsAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
  if (!currentUserIsAdmin) redirect("/admin");

  const allUsers = await getUsersWithGroups();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Benutzer</h1>
          <p className="text-gray-400 text-sm mt-0.5">{allUsers.length} Benutzer</p>
        </div>
        <Link
          href="/admin/benutzer/neu"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Benutzer
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Benutzer</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Gruppen</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Registriert</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
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
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {user.groups.length === 0 ? (
                      <span className="text-gray-600 text-xs">Keine Gruppe</span>
                    ) : (
                      user.groups.map((g) => (
                        <span
                          key={g.slug}
                          className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded"
                        >
                          {g.name}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                      <UserCheck className="w-3 h-3" />
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                      <UserX className="w-3 h-3" />
                      Inaktiv
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
      </div>
    </div>
  );
}
