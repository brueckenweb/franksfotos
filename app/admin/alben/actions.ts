"use server";

import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteAlbum(albumId: number): Promise<void> {
  await db.delete(albums).where(eq(albums.id, albumId));
  revalidatePath("/admin/alben");
}

export async function updateAlbumSortOrders(
  updates: { id: number; sortOrder: number }[]
): Promise<void> {
  for (const { id, sortOrder } of updates) {
    await db.update(albums).set({ sortOrder }).where(eq(albums.id, id));
  }
  revalidatePath("/admin/alben");
}
