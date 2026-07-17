"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DashboardSidebar from "./DashboardSidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Route /dashboard/contributor punya layout (sidebar) sendiri.
  // Layout admin ini hanya membungkus route admin, supaya tidak nested
  // (nested = sidebar admin ikut render + mengkick contributor -> loop).
  if (pathname.startsWith("/dashboard/contributor")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" suppressHydrationWarning>
      <DashboardSidebar />
      <main className="flex-1 min-w-0" suppressHydrationWarning>
        <div className="px-8 py-10 lg:px-12 max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}