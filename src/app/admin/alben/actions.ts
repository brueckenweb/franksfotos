"use server";

import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteAlbum(albumId: number): Promise<void> {
  await db.delete(albums).where(eq(albums.id, albumId));
  revalidatePath("/admin/alben");
}
