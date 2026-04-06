import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userGroups, groups } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import BenutzerListeClient from "./BenutzerListeClient";

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
          <span className="hidden sm:inline">Neuer Benutzer</span>
          <span className="sm:hidden">Neu</span>
        </Link>
      </div>

      <BenutzerListeClient users={allUsers} />
    </div>
  );
}
