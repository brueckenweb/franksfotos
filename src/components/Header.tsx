import Link from "next/link";
import { Camera, LogIn } from "lucide-react";
import { auth } from "@/auth";

export default async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">FranksFotos</span>
          </Link>
          <nav className="flex items-center gap-4">
            {session?.user ? (
              <>
                <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Admin
                </Link>
                <Link href="/profil" className="text-sm text-gray-400 hover:text-white transition-colors">
                  {session.user.name}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Anmelden
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}