"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Kicker,
  Btn,
  Badge,
  EmptyState,
  Skeleton,
  Spinner,
} from "@/components/ui";

interface Contributor {
  id: string;
  email: string;
  realName: string | null;
  pending: number;
  paidOut: number;
  lifetimeEarned: number;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  createdAt: string;
  contributor: { email: string; realName: string | null } | null;
}

interface Settlement {
  id: string;
  period: string;
  totalPool: number;
  totalDistributed: number;
  ranAt: string;
}

const inputCls =
  "border hairline border-solid rounded-[3px] bg-card-2 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-safelight focus:ring-2 focus:ring-safelight/15 placeholder:text-ash-2";

export default function AdminPayoutsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // payout modal state
  const [selected, setSelected] = useState<Contributor | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // settlement state
  const [settlePeriod, setSettlePeriod] = useState("");
  const [settleMsg, setSettleMsg] = useState("");
  const [settling, setSettling] = useState(false);

  async function fetchAll() {
    try {
      const [c, p, s] = await Promise.all([
        api.get("/payouts/contributors"),
        api.get("/payouts", { params: { limit: 20 } }),
        api.get("/payouts/settlements"),
      ]);
      setContributors(c.data.data || []);
      setPayouts(p.data.data || []);
      setSettlements(s.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      await api.post("/payouts", {
        contributorId: selected.id,
        amount: Number(amount),
        method,
        reference: reference || undefined,
      });
      setSelected(null);
      setAmount("");
      setReference("");
      fetchAll();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Gagal mencatat payout");
    } finally {
      setSaving(false);
    }
  }

  async function runSettlement(e: React.FormEvent) {
    e.preventDefault();
    setSettleMsg("");
    setSettling(true);
    try {
      const res = await api.post("/payouts/settle", { period: settlePeriod });
      setSettleMsg(
        `Selesai · pool ${formatPrice(res.data.data.totalPool)} · dibagi ${formatPrice(res.data.data.totalDistributed)}`,
      );
      fetchAll();
    } catch (err: any) {
      setSettleMsg(err?.response?.data?.message || "Gagal run settlement");
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="01"
        kicker="Pencairan"
        title="Bagi Hasil"
        className="mb-10"
      />

      {/* Settlement */}
      <Panel className="mb-8">
        <div className="px-7 py-5 border-b hairline border-solid">
          <Kicker className="mb-1.5">02 — Settlement</Kicker>
          <p className="font-display text-lg">Settlement langganan</p>
        </div>
        <div className="px-7 py-6">
          <form onSubmit={runSettlement} className="flex flex-wrap items-center gap-3 mb-5">
            <input
              type="text"
              value={settlePeriod}
              onChange={(e) => setSettlePeriod(e.target.value)}
              placeholder="YYYY-MM (mis. 2026-06)"
              className={`${inputCls} w-52 font-mono`}
            />
            <Btn type="submit" variant="dark" disabled={!settlePeriod || settling}>
              {settling ? <Spinner /> : null}
              {settling ? "Memproses" : "Run Settlement"}
            </Btn>
            {settleMsg && (
              <span className="font-mono text-[11px] text-ash">{settleMsg}</span>
            )}
          </form>

          {loading ? (
            <Skeleton className="h-16" />
          ) : settlements.length === 0 ? (
            <EmptyState>Belum ada settlement</EmptyState>
          ) : (
            <ul className="divide-y divide-ink/10 border-t">
              {settlements.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-3.5"
                >
                  <span className="font-mono text-sm tnum">{s.period}</span>
                  <span className="font-mono text-[11px] text-ash">
                    pool {formatPrice(s.totalPool)} · dibagi{" "}
                    <span className="text-safelight">{formatPrice(s.totalDistributed)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* Contributors with balance */}
      <Panel className="mb-8">
        <div className="px-7 py-5 border-b hairline border-solid">
          <Kicker className="mb-1.5">03 — Saldo</Kicker>
          <p className="font-display text-lg">Kontributor</p>
        </div>
        {loading ? (
          <div className="p-7 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : contributors.length === 0 ? (
          <EmptyState>Belum ada kontributor</EmptyState>
        ) : (
          <ul className="divide-y divide-ink/10">
            {contributors.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 px-7 py-4"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate">{c.realName || c.email}</p>
                  <p className="font-mono text-[11px] text-ash-2 truncate">
                    {c.email}
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="font-display text-lg tnum">
                      {formatPrice(c.pending)}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ash-2">
                      tertunda
                    </p>
                  </div>
                  <Btn
                    variant="primary"
                    onClick={() => {
                      setSelected(c);
                      setAmount(String(c.pending));
                      setMessage("");
                    }}
                    disabled={c.pending <= 0}
                  >
                    Bayar
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Recent payouts */}
      <Panel>
        <div className="px-7 py-5 border-b hairline border-solid">
          <Kicker className="mb-1.5">04 — Riwayat</Kicker>
          <p className="font-display text-lg">Pencairan terbaru</p>
        </div>
        {loading ? (
          <div className="p-7 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <EmptyState>Belum ada pencairan</EmptyState>
        ) : (
          <ul className="divide-y divide-ink/10">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-7 py-4"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate">
                    {p.contributor?.realName || p.contributor?.email || "—"}
                  </p>
                  <p className="font-mono text-[11px] text-ash-2">
                    {p.method} · {new Date(p.createdAt).toLocaleString("id-ID")}
                    {p.reference ? ` · ref ${p.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Badge status={p.status} />
                  <span className="font-display text-base tnum">
                    {formatPrice(p.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Payout modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm fade"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm bg-paper rounded-[3px] border hairline border-solid p-7 rise"
            onClick={(e) => e.stopPropagation()}
          >
            <Kicker className="mb-3">Bayar Kontributor</Kicker>
            <h2 className="font-display text-2xl tracking-[-0.01em] mb-1">
              {selected.realName || selected.email}
            </h2>
            <p className="font-mono text-[11px] text-ash mb-6">
              Saldo tertunda {formatPrice(selected.pending)}
            </p>

            <form onSubmit={submitPayout} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
                  Nominal
                </label>
                <input
                  type="number"
                  min={1}
                  max={selected.pending}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${inputCls} w-full font-display tnum`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
                  Metode
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="EWALLET">E-Wallet</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
                  Referensi (opsional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={`${inputCls} w-full`}
                  placeholder="No. bukti / referensi"
                />
              </div>

              {message && (
                <p className="text-safelight-dim text-xs font-mono border-l-2 border-safelight pl-3 py-1">
                  {message}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Btn
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  className="flex-1"
                >
                  Batal
                </Btn>
                <Btn
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? <Spinner /> : null}
                  {saving ? "Memproses" : "Bayar"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}