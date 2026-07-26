export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ReisenClient from "./ReisenClient";
export const metadata = { title: "Meine Reisen – FranksFotos" };
export default async function ReisenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id as string);
  const userRecord = await db.select({ isMainAdmin: users.isMainAdmin }).from(users).where(eq(users.id, userId)).then(r => r[0]);
  const isFrank = userRecord?.isMainAdmin ?? false;
  return <ReisenClient currentUserId={userId} isFrank={isFrank} />;
}
