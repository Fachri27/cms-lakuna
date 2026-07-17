"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import {
  SectionHeader,
  Panel,
  Th,
  Td,
  Btn,
  Modal,
  Field,
  SearchInput,
  Pagination,
  EmptyState,
  Skeleton,
  Badge,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

interface Voucher {
  id: string;
  code: string;
  description: string | null;
  scope: "ORDER" | "SUBSCRIPTION" | "BOTH";
  valueType: "PERCENT" | "NOMINAL";
  value: number;
  maxDiscount: number | null;
  minSpend: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  quotaTotal: number | null;
  quotaPerUser: number;
  usedCount: number;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SCOPE_LABEL: Record<string, string> = {
  ORDER: "Order foto",
  SUBSCRIPTION: "Langganan",
  BOTH: "Semua",
};

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatValue(v: Voucher) {
  if (v.valueType === "PERCENT") {
    const base = `${v.value}%`;
    if (v.maxDiscount) return `${base} · max ${formatPrice(v.maxDiscount)}`;
    return base;
  }
  return formatPrice(v.value);
}

const emptyForm = {
  code: "",
  description: "",
  scope: "BOTH" as Voucher["scope"],
  valueType: "PERCENT" as Voucher["valueType"],
  value: "",
  maxDiscount: "",
  minSpend: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  quotaTotal: "",
  quotaPerUser: "1",
};

export default function VouchersClient() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchVouchers();
  }, [page, search]);

  async function fetchVouchers() {
    setFetching(true);
    try {
      const res = await api.get("/vouchers", {
        params: { page, limit: 10, search: search || undefined },
      });
      setVouchers(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  function openCreate() {
    setEditVoucher(null);
    setForm({ ...emptyForm });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(v: Voucher) {
    setEditVoucher(v);
    setForm({
      code: v.code,
      description: v.description || "",
      scope: v.scope,
      valueType: v.valueType,
      value: String(v.value),
      maxDiscount: v.maxDiscount != null ? String(v.maxDiscount) : "",
      minSpend: v.minSpend != null ? String(v.minSpend) : "",
      startsAt: toLocalInput(v.startsAt),
      endsAt: toLocalInput(v.endsAt),
      isActive: v.isActive,
      quotaTotal: v.quotaTotal != null ? String(v.quotaTotal) : "",
      quotaPerUser: String(v.quotaPerUser),
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.code.trim()) newErrors.code = "Kode wajib diisi";
    if (!form.value || Number(form.value) <= 0) newErrors.value = "Value harus > 0";
    if (form.valueType === "PERCENT" && Number(form.value) > 100)
      newErrors.value = "Persen maks 100";
    if (!form.startsAt) newErrors.startsAt = "Mulai wajib diisi";
    if (!form.endsAt) newErrors.endsAt = "Berakhir wajib diisi";
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt))
      newErrors.endsAt = "Berakhir harus setelah mulai";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        scope: form.scope,
        valueType: form.valueType,
        value: Number(form.value),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        minSpend: form.minSpend ? Number(form.minSpend) : null,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        isActive: form.isActive,
        quotaTotal: form.quotaTotal ? Number(form.quotaTotal) : null,
        quotaPerUser: Number(form.quotaPerUser) || 1,
      };

      if (editVoucher) {
        await api.patch(`/vouchers/${editVoucher.id}`, payload);
      } else {
        await api.post("/vouchers", payload);
      }

      setShowForm(false);
      fetchVouchers();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus voucher ini? Riwayat pemakaian ikut terhapus.")) return;
    try {
      await api.delete(`/vouchers/${id}`);
      fetchVouchers();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus voucher");
    }
  }

  async function toggleActive(v: Voucher) {
    try {
      await api.patch(`/vouchers/${v.id}`, { isActive: !v.isActive });
      fetchVouchers();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal mengubah status");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="06"
        kicker="Diskon"
        title="Voucher"
        action={<Btn variant="primary" onClick={openCreate}>+ Tambah</Btn>}
        className="mb-8"
      />

      <div className="mb-6 max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Cari kode voucher…"
        />
      </div>

      {fetching ? (
        <Panel className="p-7 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : vouchers.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada voucher</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Cakupan</Th>
                  <Th>Nilai</Th>
                  <Th>Periode</Th>
                  <Th>Kuota</Th>
                  <Th>Status</Th>
                  <Th align="right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => {
                  const now = Date.now();
                  const ended = new Date(v.endsAt).getTime() < now;
                  const started = new Date(v.startsAt).getTime() <= now;
                  const status = !v.isActive ? "CANCELLED" : ended ? "EXPIRED" : started ? "ACTIVE" : "PENDING";
                  const quota = v.quotaTotal == null ? `${v.usedCount} / ∞` : `${v.usedCount} / ${v.quotaTotal}`;
                  return (
                    <tr key={v.id} className="hover:bg-ink/[0.02] transition-colors">
                      <Td>
                        <span className="font-mono text-[12px] tracking-wide text-ink">{v.code}</span>
                      </Td>
                      <Td className="text-ash">{SCOPE_LABEL[v.scope]}</Td>
                      <Td className="text-ink tnum">{formatValue(v)}</Td>
                      <Td className="text-ash-2 font-mono text-[11px]">
                        {toLocalInput(v.startsAt).slice(0, 10)} → {toLocalInput(v.endsAt).slice(0, 10)}
                      </Td>
                      <Td className="text-ash tnum">{quota}</Td>
                      <Td>
                        <Badge status={status} />
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-2">
                          <Btn variant="ghost" onClick={() => toggleActive(v)}>
                            {v.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Btn>
                          <Btn variant="ghost" onClick={() => openEdit(v)}>Edit</Btn>
                          <Btn variant="danger" onClick={() => handleDelete(v.id)}>Hapus</Btn>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {meta && <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />}
        </>
      )}

      {showForm && (
        <Modal
          kicker="Diskon"
          title={editVoucher ? "Edit Voucher" : "Tambah Voucher"}
          onClose={() => setShowForm(false)}
          className="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.general && (
              <p className="text-safelight-dim text-xs font-mono">{errors.general}</p>
            )}

            <Field label="Kode" error={errors.code}>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={50}
                className={cn(inputCls, "font-mono tracking-wide")}
                placeholder="cth. LEBARAN50"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cakupan">
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as Voucher["scope"] })}
                  className={inputCls}
                >
                  <option value="BOTH">Semua</option>
                  <option value="ORDER">Order foto</option>
                  <option value="SUBSCRIPTION">Langganan</option>
                </select>
              </Field>

              <Field label="Tipe nilai">
                <select
                  value={form.valueType}
                  onChange={(e) => setForm({ ...form, valueType: e.target.value as Voucher["valueType"] })}
                  className={inputCls}
                >
                  <option value="PERCENT">Persen (%)</option>
                  <option value="NOMINAL">Nominal (Rp)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={form.valueType === "PERCENT" ? "Persen" : "Nominal"} error={errors.value}>
                <input
                  type="number"
                  min={1}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className={cn(inputCls, "tnum")}
                  placeholder="0"
                />
              </Field>

              {form.valueType === "PERCENT" && (
                <Field label="Cap maksimal" hint="(opsional)">
                  <input
                    type="number"
                    min={0}
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                    className={cn(inputCls, "tnum")}
                    placeholder="rupiah"
                  />
                </Field>
              )}
            </div>

            <Field label="Min. belanja" hint="(opsional, rupiah)">
              <input
                type="number"
                min={0}
                value={form.minSpend}
                onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
                className={cn(inputCls, "tnum")}
                placeholder="0"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Mulai berlaku" error={errors.startsAt}>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Berakhir" error={errors.endsAt}>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Kuota total" hint="(opsional)">
                <input
                  type="number"
                  min={1}
                  value={form.quotaTotal}
                  onChange={(e) => setForm({ ...form, quotaTotal: e.target.value })}
                  className={cn(inputCls, "tnum")}
                  placeholder="∞"
                />
              </Field>
              <Field label="Kuota per-user">
                <input
                  type="number"
                  min={1}
                  value={form.quotaPerUser}
                  onChange={(e) => setForm({ ...form, quotaPerUser: e.target.value })}
                  className={cn(inputCls, "tnum")}
                  placeholder="1"
                />
              </Field>
            </div>

            <Field label="Deskripsi" hint="(opsional)">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className={cn(inputCls, "resize-none")}
                placeholder="Catatan internal…"
              />
            </Field>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-safelight w-4 h-4"
              />
              <span className="text-sm text-ink">Aktif</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Btn type="submit" variant="dark" disabled={loading} className="flex-1">
                {loading ? <Spinner /> : null}
                {loading ? "Menyimpan" : "Simpan"}
              </Btn>
              <Btn type="button" variant="ghost" onClick={() => setShowForm(false)} className="flex-1">
                Batal
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}