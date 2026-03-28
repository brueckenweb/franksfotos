import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups, groupPermissions, permissions, userGroups } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Shield } from "lucide-react";
import GroupPermissionsEditor from "./GroupPermissionsEditor";

async function getGroupsWithDetails() {
  try {
    const allGroups = await db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        description: groups.description,
        isSystem: groups.isSystem,
        sortOrder: groups.sortOrder,
      })
      .from(groups)
      .orderBy(groups.sortOrder);

    const result = await Promise.all(
      allGroups.map(async (group) => {
        const perms = await db
          .select({ permName: permissions.name, permLabel: permissions.label })
          .from(groupPermissions)
          .innerJoin(permissions, eq(groupPermissions.permissionId, permissions.id))
          .where(eq(groupPermissions.groupId, group.id));

        const [memberCount] = await db
          .select({ cnt: count() })
          .from(userGroups)
          .where(eq(userGroups.groupId, group.id));

        return { ...group, permissions: perms, memberCount: memberCount.cnt };
      })
    );

    return result;
  } catch {
    return [];
  }
}

export default async function AdminGruppenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
  if (!isMainAdmin) redirect("/admin");

  const allGroups = await getGroupsWithDetails();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Gruppen & Rechte</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Systemgruppen und ihre Berechtigungen
        </p>
      </div>

      <div className="space-y-4">
        {allGroups.map((group) => {
          const currentPermNames = group.permissions.map((p) => p.permName);

          return (
            <div
              key={group.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Gruppen-Header */}
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-white font-semibold">{group.name}</h2>
                      <span className="text-gray-600 font-mono text-xs">{group.slug}</span>
                      {group.isSystem && (
                        <span className="bg-blue-500/10 text-blue-400 text-xs px-1.5 py-0.5 rounded">
                          System
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-gray-500 text-xs">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-gray-500 text-sm">
                  {group.memberCount} Mitglied{group.memberCount !== 1 ? "er" : ""}
                </div>
              </div>

              {/* Rechte-Übersicht + Editor */}
              <div className="p-4">
                {group.slug === "admin" ? (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Shield className="w-4 h-4" />
                    <span>Alle Rechte (Vollzugriff) – nicht editierbar</span>
                  </div>
                ) : (
                  <>
                    {/* Aktuelle Rechte als Übersicht (kompakt) */}
                    {currentPermNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {group.permissions.map((perm) => (
                          <span
                            key={perm.permName}
                            className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-2 py-0.5 rounded-full"
                          >
                            {perm.permLabel}
                          </span>
                        ))}
                      </div>
                    )}
                    {currentPermNames.length === 0 && (
                      <p className="text-gray-600 text-sm mb-1">Keine Rechte zugewiesen</p>
                    )}

                    {/* Interaktiver Editor */}
                    <GroupPermissionsEditor
                      groupId={group.id}
                      groupSlug={group.slug}
                      initialPermNames={currentPermNames}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-gray-600 text-xs mt-4">
        💡 Systemgruppen können nicht gelöscht werden. Änderungen werden sofort wirksam.
      </p>
    </div>
  );
}
