"use client";

/**
 * Blendet Header und Footer auf bestimmten Routen aus.
 * Server-Components (Header, Footer) werden als Props übergeben,
 * damit sie weiterhin serverseitig gerendert werden können.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Routen, auf denen Header + Footer ausgeblendet werden
const ROUTES_WITHOUT_SHELL = ["/admin", "/fotodatenbank", "/weltreise/"];

interface ConditionalShellProps {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export default function ConditionalShell({
  header,
  footer,
  children,
}: ConditionalShellProps) {
  const pathname = usePathname();
  const hideShell = ROUTES_WITHOUT_SHELL.some((r) => pathname.startsWith(r));

  return (
    <>
      {!hideShell && header}
      <main className="flex-1">{children}</main>
      {!hideShell && footer}
    </>
  );
}
