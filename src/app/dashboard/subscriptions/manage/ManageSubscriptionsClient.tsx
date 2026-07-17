"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Th,
  Td,
  Badge,
  Btn,
  EmptyState,
  Skeleton,
  Spinner,
} from "@/components/ui";

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planQuota: number;
  billing: string;
  payOption: string;
  price: number;
  status: string;
  used: number;
  quota: number;
  expiresAt: string;
  startedAt: string;
  createdAt: string;
}

export default function ManageSubscriptionsClient() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expiring, setExpiring] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    setFetching(true);
    try {
      const res = await api.get("/subscription/admin");
      setSubscriptions(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  async function handleExpire(userId: string, userName: string) {
    if (!confirm(`Yakin ingin expire subscription user "${userName}"?`)) return;
    setExpiring(userId);
    try {
      await api.patch(`/subscription/admin/${userId}/expire`, {});
      fetchSubscriptions();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal expire subscription");
    } finally {
      setExpiring(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="rise">
      <SectionHeader
        index="03"
        kicker="Transaksi"
        title="Pelanggan Aktif"
        action={
          <Btn onClick={fetchSubscriptions} disabled={fetching} variant="ghost">
            {fetching ? <Spinner /> : <span aria-hidden>↻</span>}
            {fetching ? "Memuat" : "Perbarui"}
          </Btn>
        }
        className="mb-8"
      />

      {fetching ? (
        <Panel className="p-7">
          <Skeleton className="h-64" />
        </Panel>
      ) : subscriptions.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada subscription</EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Paket</Th>
                <Th>Harga</Th>
                <Th>Status</Th>
                <Th>Pakai</Th>
                <Th>Berakhir</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-ink/[0.02] transition-colors">
                  <Td className="text-ink">{sub.userName || "—"}</Td>
                  <Td className="font-mono text-[11px] text-ash">{sub.userEmail}</Td>
                  <Td>
                    <span className="font-display text-base tnum">{sub.planQuota}</span>
                    <span className="font-mono text-[10px] text-ash-2 uppercase ml-1">
                      {sub.billing}
                    </span>
                  </Td>
                  <Td className="font-display text-base tnum">{formatPrice(sub.price)}</Td>
                  <Td>
                    <Badge status={sub.status} />
                  </Td>
                  <Td className="font-mono text-[11px] text-ash tnum">
                    {sub.used}/{sub.quota}
                  </Td>
                  <Td className="font-mono text-[11px] text-ash">
                    {sub.expiresAt ? formatDate(sub.expiresAt) : "—"}
                  </Td>
                  <Td align="right">
                    {sub.status === "ACTIVE" && (
                      <Btn
                        variant="danger"
                        onClick={() => handleExpire(sub.userId, sub.userName)}
                        disabled={expiring === sub.userId}
                      >
                        {expiring === sub.userId ? "…" : "Expire"}
                      </Btn>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-7 py-3 border-t hairline border-solid font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
            Total {subscriptions.length} subscription
          </div>
        </Panel>
      )}
    </div>
  );
}