"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Image,
  ShoppingCart,
  Users,
  CreditCard,
  Tag,
  Hash,
  Settings,
  LogOut,
  ClipboardCheck,
  User,
  Wallet,
  Ticket,
  CalendarClock,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { cn } from "@/lib/cn";

type Item = { label: string; href: string; icon: any };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Studio",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Foto", href: "/dashboard/photos", icon: Image },
      { label: "Persetujuan", href: "/dashboard/approval", icon: ClipboardCheck },
    ],
  },
  {
    title: "Katalog",
    items: [
      { label: "Kategori", href: "/dashboard/categories", icon: Tag },
      { label: "Kata Kunci", href: "/dashboard/keywords", icon: Hash },
      { label: "Fotografer", href: "/dashboard/photographers", icon: User },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { label: "Pesanan", href: "/dashboard/orders", icon: ShoppingCart },
      { label: "Paket Langganan", href: "/dashboard/subscriptions", icon: CreditCard },
      { label: "Pelanggan Aktif", href: "/dashboard/subscriptions/manage", icon: Users },
      { label: "Pencairan", href: "/dashboard/payouts", icon: Wallet },
    ],
  },
  {
    title: "Diskon",
    items: [
      { label: "Voucher", href: "/dashboard/vouchers", icon: Ticket },
      { label: "Event Diskon", href: "/dashboard/events", icon: CalendarClock },
    ],
  },
  {
    title: "Sistem",
    items: [
      { label: "Pengguna", href: "/dashboard/users", icon: Users },
      { label: "Pengaturan", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Route /dashboard/contributor punya layout (sidebar) sendiri.
  // Layout admin ini membungkusnya juga (nested), jadi kita opt-out di sini
  // supaya sidebar admin tidak ikut render & tidak mengkick contributor -> loop.
  const isContributorRoute = pathname.startsWith("/dashboard/contributor");

  function logout() {
    Cookies.remove("accessToken", { path: "/" });
    Cookies.remove("refreshToken", { path: "/" });
    router.replace("/login");
  }

  useEffect(() => {
    if (isContributorRoute) return;
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
      if (payload.role !== "ADMIN") {
        router.replace("/login");
      }
    } catch {
      Cookies.remove("accessToken", { path: "/" });
      Cookies.remove("refreshToken", { path: "/" });
      router.replace("/login");
    }
  }, []);

  if (!mounted || isContributorRoute) return null;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-ink text-paper flex flex-col border-r border-ink-3">
      {/* Brand */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-safelight text-lg leading-none">
            ▣
          </span>
          <span className="font-display text-[1.55rem] leading-none tracking-[-0.01em]">
            Lakuna
          </span>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40 pl-7">
          Studio / CMS
        </p>
      </div>

      <div className="mx-6 h-px bg-paper/10" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="px-3 mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/30">
              {group.title}
            </p>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
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
                          active ? "text-safelight" : "text-paper/45 group-hover:text-paper/70",
                        )}
                      />
                      <span className="text-[13px] tracking-tight">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
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
  );
}