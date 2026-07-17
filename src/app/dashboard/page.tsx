"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import {
  Kicker,
  Panel,
  SectionHeader,
  Stat,
  Badge,
  Btn,
  EmptyState,
  Spinner,
  Skeleton,
} from "@/components/ui";

interface Stats {
  totalPhotos: number;
  totalUsers: number;
  totalViews: number;
  totalRevenue: string;
}

interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  total: number;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/order/admin?limit=6"),
      ]);
      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (ordersRes.data?.success) setRecentOrders(ordersRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="01"
        kicker="Ringkasan"
        title="Studio"
        action={
          <Btn onClick={fetchData} disabled={loading} variant="ghost">
            {loading ? <Spinner /> : <span aria-hidden>↻</span>}
            {loading ? "Memuat" : "Perbarui"}
          </Btn>
        }
        className="mb-10"
      />

      {/* Stat strip + featured revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        <Panel className="lg:col-span-2 p-7">
          <Kicker className="mb-7">Indeks</Kicker>
          {loading && !stats ? (
            <div className="grid grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <Stat
                index="01"
                label="Foto"
                value={(stats?.totalPhotos ?? 0).toLocaleString("id-ID")}
                className="sm:pr-6 pb-6 sm:pb-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
              />
              <Stat
                index="02"
                label="Pengguna"
                value={(stats?.totalUsers ?? 0).toLocaleString("id-ID")}
                className="sm:px-6 py-6 sm:py-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
              />
              <Stat
                index="03"
                label="Tayangan"
                value={(stats?.totalViews ?? 0).toLocaleString("id-ID")}
                className="sm:pl-6 pt-6 sm:pt-0"
              />
            </div>
          )}
        </Panel>

        {/* Featured — dark revenue panel */}
        <div className="relative bg-ink text-paper rounded-[3px] p-7 overflow-hidden">
          <div
            aria-hidden
            className="absolute top-0 left-0 h-px w-16 bg-safelight"
          />
          <div
            aria-hidden
            className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-safelight/10 blur-2xl"
          />
          <Kicker tone="paper" className="mb-7">
            Pendapatan
          </Kicker>
          {loading && !stats ? (
            <Skeleton className="h-16 w-2/3 bg-paper/10" />
          ) : (
            <>
              <p className="font-display text-[2.7rem] leading-[0.9] tracking-[-0.02em] text-safelight tnum">
                {stats?.totalRevenue ?? "Rp 0"}
              </p>
              <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/40">
                Tercatat · semua transaksi
              </p>
            </>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <Panel>
        <div className="flex items-center justify-between px-7 py-5 border-b hairline border-solid">
          <div>
            <Kicker className="mb-1.5">02 — Pesanan Terbaru</Kicker>
            <p className="font-display text-lg">Transaksi terakhir</p>
          </div>
          <Link
            href="/dashboard/orders"
            className="group inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ash hover:text-ink transition-colors"
          >
            Lihat semua
            <ArrowUpRight
              size={13}
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            />
          </Link>
        </div>

        {loading ? (
          <div className="p-7 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <EmptyState>Belum ada pesanan</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b hairline border-solid">
                  <th className="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">
                    Pelanggan
                  </th>
                  <th className="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">
                    Nominal
                  </th>
                  <th className="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">
                    Status
                  </th>
                  <th className="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">
                    Tanggal
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors"
                  >
                    <td className="px-7 py-4">
                      <div className="text-ink">{order.userName}</div>
                      <div className="font-mono text-[11px] text-ash-2">
                        {order.userEmail}
                      </div>
                    </td>
                    <td className="px-7 py-4 font-display text-base tnum">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-7 py-4">
                      <Badge status={order.status} />
                    </td>
                    <td className="px-7 py-4 font-mono text-[11px] text-ash">
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-2">
        Lakuna Studio · {new Date().getFullYear()} · v2
      </p>
    </div>
  );
}