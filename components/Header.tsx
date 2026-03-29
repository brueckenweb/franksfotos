import Link from "next/link";
import { Camera, LogIn, Images } from "lucide-react";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";

export default async function Header() {
  const session = await auth();

  const isMainAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
  const userPermissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const showAdminLink = isAdmin(userPermissions, isMainAdmin);

  return (
    <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 flex items-center justify-center">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-white">FranksFotos</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-4">
            {/* Galerie-Link – immer sichtbar */}
            <Link
              href="/alben"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">Galerie</span>
            </Link>

            {session?.user ? (
              <>
                {showAdminLink && (
                  <Link
                    href="/admin"
                    className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/profil"
                  className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800 max-w-[80px] sm:max-w-none truncate"
                >
                  {session.user.name}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Anmelden</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
