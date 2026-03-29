"use server";

import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äöüß]/g, (c) =>
      ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c)
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
  if (!isMainAdmin) redirect("/admin");

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const sortOrderRaw = formData.get("sortOrder") as string | null;
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  if (!name) {
    return { error: "Name ist erforderlich" };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: "Ungültiger Name – konnte keinen Slug erzeugen" };
  }

  try {
    await db.insert(groups).values({
      name,
      slug,
      description: description || null,
      isSystem: false,
      sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Duplicate") || msg.includes("unique")) {
      return { error: "Eine Gruppe mit diesem Namen oder Slug existiert bereits" };
    }
    return { error: "Datenbankfehler: " + msg };
  }

  revalidatePath("/admin/gruppen");
  return { success: true };
}

export async function deleteGroup(groupId: number) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
  if (!isMainAdmin) redirect("/admin");

  // Systemgruppen dürfen nicht gelöscht werden
  const [group] = await db
    .select({ isSystem: groups.isSystem })
    .from(groups)
    .where(eq(groups.id, groupId));

  if (!group) {
    return { error: "Gruppe nicht gefunden" };
  }
  if (group.isSystem) {
    return { error: "Systemgruppen können nicht gelöscht werden" };
  }

  await db.delete(groups).where(eq(groups.id, groupId));
  revalidatePath("/admin/gruppen");
  return { success: true };
}
