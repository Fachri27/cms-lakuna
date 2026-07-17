"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Stat,
  EmptyState,
  Skeleton,
  Kicker,
} from "@/components/ui";

interface Summary {
  pending: number;
  paidOut: number;
  lifetimeEarned: number;
  thisMonth: number;
}

interface Earning {
  id: string;
  source: "STANDAR" | "SUBSCRIPTION";
  amount: number;
  period: string | null;
  orderId: string | null;
  photo: { id: string; title: string } | null;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  createdAt: string;
}

export default function ContributorEarningsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, e, p] = await Promise.all([
          api.get("/earnings/mine/summary"),
          api.get("/earnings/mine", { params: { limit: 50 } }),
          api.get("/payouts/mine", { params: { limit: 50 } }),
        ]);
        setSummary(s.data.data);
        setEarnings(e.data.data || []);
        setPayouts(p.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sourceLabel = (src: string) =>
    src === "STANDAR" ? "Pembelian satuan" : "Langganan";

  return (
    <div className="rise">
      <SectionHeader
        index="01"
        kicker="Penghasilan"
        title="Dompet"
        className="mb-10"
      />

      {/* Balance strip */}
      <Panel className="p-7 mb-10">
        <Kicker className="mb-7">Saldo</Kicker>
        {loading && !summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4">
            <Stat
              index="01"
              label="Saldo tertunda"
              value={formatPrice(summary?.pending ?? 0)}
              tone="safelight"
              className="pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r hairline border-solid"
            />
            <Stat
              index="02"
              label="Total ditarik"
              value={formatPrice(summary?.paidOut ?? 0)}
              className="lg:px-6 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r hairline border-solid"
            />
            <Stat
              index="03"
              label="Total penghasilan"
              value={formatPrice(summary?.lifetimeEarned ?? 0)}
              className="lg:px-6 pt-6 lg:pt-0 pr-6 border-r hairline border-solid"
            />
            <Stat
              index="04"
              label="Bulan ini"
              value={formatPrice(summary?.thisMonth ?? 0)}
              className="lg:pl-6 pt-6 lg:pt-0"
            />
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Earnings history */}
        <Panel>
          <div className="px-7 py-5 border-b hairline border-solid">
            <Kicker className="mb-1.5">02 — Riwayat</Kicker>
            <p className="font-display text-lg">Penghasilan</p>
          </div>
          {loading ? (
            <div className="p-7 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : earnings.length === 0 ? (
            <EmptyState>Belum ada penghasilan</EmptyState>
          ) : (
            <ul className="divide-y divide-ink/10">
              {earnings.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 px-7 py-4">
                  <div className="min-w-0">
                    <p className="text-ink truncate">
                      {sourceLabel(e.source)}
                      {e.photo ? (
                        <span className="text-ash"> · {e.photo.title}</span>
                      ) : e.period ? (
                        <span className="text-ash"> · {e.period}</span>
                      ) : null}
                    </p>
                    <p className="font-mono text-[11px] text-ash-2">
                      {new Date(e.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <span className="font-display text-base text-safelight tnum shrink-0">
                    +{formatPrice(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Payout history */}
        <Panel>
          <div className="px-7 py-5 border-b hairline border-solid">
            <Kicker className="mb-1.5">03 — Pencairan</Kicker>
            <p className="font-display text-lg">Riwayat tarik</p>
          </div>
          {loading ? (
            <div className="p-7 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <EmptyState>Belum ada pencairan</EmptyState>
          ) : (
            <ul className="divide-y divide-ink/10">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-7 py-4">
                  <div className="min-w-0">
                    <p className="text-ink">
                      {p.method}
                      {p.reference ? (
                        <span className="text-ash"> · ref {p.reference}</span>
                      ) : null}
                    </p>
                    <p className="font-mono text-[11px] text-ash-2">
                      {new Date(p.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <span className="font-display text-base tnum shrink-0">
                    −{formatPrice(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}