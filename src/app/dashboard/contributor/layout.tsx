"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Image, LogOut, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

export default function ContributorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = Cookies.get("accessToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        Cookies.remove("accessToken", { path: "/" });
        Cookies.remove("refreshToken", { path: "/" });
        router.replace("/login");
        return;
      }
      if (payload.role !== "CONTRIBUTOR") {
        router.replace("/login");
      }
    } catch {
      Cookies.remove("accessToken", { path: "/" });
      Cookies.remove("refreshToken", { path: "/" });
      router.replace("/login");
    }
  }, []);

  function logout() {
    Cookies.remove("accessToken", { path: "/" });
    Cookies.remove("refreshToken", { path: "/" });
    router.replace("/login");
  }

  const menus = [
    { label: "Dashboard", href: "/dashboard/contributor", icon: LayoutDashboard },
    { label: "Upload Foto", href: "/dashboard/contributor/upload", icon: Image },
    { label: "Penghasilan", href: "/dashboard/contributor/earnings", icon: Wallet },
  ];

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 h-screen sticky top-0 bg-ink text-paper flex flex-col border-r border-ink-3">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="text-safelight text-lg leading-none">
              ▣
            </span>
            <span className="font-display text-[1.4rem] leading-none tracking-[-0.01em]">
              Lakuna
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40 pl-7">
            Kontributor
          </p>
        </div>

        <div className="mx-6 h-px bg-paper/10" />

        <nav className="flex-1 px-3 py-5">
          <p className="px-3 mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/30">
            Studio
          </p>
          <ul className="space-y-px">
            {menus.map((menu) => {
              const Icon = menu.icon;
              const active = pathname === menu.href;
              return (
                <li key={menu.href}>
                  <Link
                    href={menu.href}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2.5 rounded-[3px] transition-colors",
                      active
                        ? "bg-paper/[0.06] text-paper"
                        : "text-paper/55 hover:text-paper/90 hover:bg-paper/[0.03]",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-safelight"
                      />
                    )}
                    <Icon
                      size={15}
                      className={cn(
                        "shrink-0",
                        active
                          ? "text-safelight"
                          : "text-paper/45 group-hover:text-paper/70",
                      )}
                    />
                    <span className="text-[13px] tracking-tight">{menu.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-5">
          <div className="mx-3 mb-3 h-px bg-paper/10" />
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-paper/55 hover:text-safelight hover:bg-paper/[0.03] transition-colors"
          >
            <LogOut size={15} className="shrink-0" />
            <span className="text-[13px] tracking-tight">Keluar</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="px-8 py-10 lg:px-12 max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}