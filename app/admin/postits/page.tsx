import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PostItAdminClient from "./PostItAdminClient";

export default async function PostItsAdminPage() {
  const session = await auth();
  const user = session?.user as { isMainAdmin?: boolean } | undefined;

  if (!user?.isMainAdmin) {
    redirect("/admin");
  }

  return <PostItAdminClient />;
}
