import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminNav from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: "Admin – FranksFotos",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Seitenleiste */}
      <AdminNav session={session} />

      {/* Hauptinhalt */}
      <main className="flex-1 ml-64 p-6">
        {children}
      </main>
    </div>
  );
}
