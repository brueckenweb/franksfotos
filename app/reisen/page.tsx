export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ReisenClient from "./ReisenClient";

export const metadata = { title: "Meine Reisen – FranksFotos" };

export default async function ReisenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id as string);

  return <ReisenClient currentUserId={userId} />;
}
