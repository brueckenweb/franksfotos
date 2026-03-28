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
      {/* Seitenleiste (Desktop: fest, Mobile: Drawer) */}
      <AdminNav session={session} />

      {/* Hauptinhalt:
          - lg:ml-64 → auf Desktop Platz für die feste Sidebar
          - pt-14 lg:pt-0 → auf Mobile Platz für die fixierte Topbar (h-14)
          - p-4 lg:p-6 → kompakteres Padding auf Mobile */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 pt-[4.5rem] lg:pt-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
