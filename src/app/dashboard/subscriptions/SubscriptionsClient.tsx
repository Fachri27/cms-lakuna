"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Kicker,
  Btn,
  Modal,
  Field,
  EmptyState,
  Skeleton,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface Plan {
  id: string;
  quota: number;
  priceMonthly: number;
  priceAnnual: number;
  isActive: boolean;
}

export default function SubscriptionsClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({ quota: "", priceMonthly: "", priceAnnual: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [standarPrice, setStandarPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchStandarPrice();
  }, []);

  async function fetchPlans() {
    try {
      const res = await api.get("/plans");
      setPlans(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  async function fetchStandarPrice() {
    try {
      const res = await api.get("/settings/standar_plan_price");
      if (res.data?.success && res.data?.data) {
        setStandarPrice(res.data.data.value);
      }
    } catch (err) {
      console.error("Gagal mengambil harga paket standar", err);
    }
  }

  async function handleSaveStandarPrice() {
    if (!standarPrice) {
      setPriceMessage({ success: false, text: "Harga tidak boleh kosong" });
      return;
    }
    setSavingPrice(true);
    setPriceMessage(null);
    try {
      const res = await api.patch("/settings/standar_plan_price", { value: standarPrice });
      if (res.data?.success) {
        setPriceMessage({ success: true, text: "Harga paket standar berhasil disimpan" });
      } else {
        setPriceMessage({ success: false, text: "Gagal menyimpan harga" });
      }
    } catch (err: any) {
      setPriceMessage({
        success: false,
        text: err?.response?.data?.error?.message || "Gagal menyimpan harga",
      });
    } finally {
      setSavingPrice(false);
    }
  }

  function openCreate() {
    setEditPlan(null);
    setForm({ quota: "", priceMonthly: "", priceAnnual: "" });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(plan: Plan) {
    setEditPlan(plan);
    setForm({
      quota: String(plan.quota),
      priceMonthly: String(plan.priceMonthly),
      priceAnnual: String(plan.priceAnnual),
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.quota) newErrors.quota = "Quota wajib diisi";
    if (!form.priceMonthly) newErrors.priceMonthly = "Harga monthly wajib diisi";
    if (!form.priceAnnual) newErrors.priceAnnual = "Harga annual wajib diisi";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        quota: Number(form.quota),
        priceMonthly: Number(form.priceMonthly),
        priceAnnual: Number(form.priceAnnual),
      };

      if (editPlan) {
        await api.patch(`/plans/${editPlan.id}`, payload);
      } else {
        await api.post("/plans", payload);
      }

      setShowForm(false);
      fetchPlans();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus plan ini?")) return;
    try {
      await api.delete(`/plans/${id}`);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus plan");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="03"
        kicker="Langganan"
        title="Paket & Harga"
        action={<Btn variant="primary" onClick={openCreate}>+ Tambah Paket</Btn>}
        className="mb-8"
      />

      {/* Standar Plan Price Editor */}
      <Panel className="p-7 mb-10 max-w-xl">
        <div className="flex items-start justify-between gap-6 mb-5">
          <div>
            <Kicker className="mb-2">Sekali Beli</Kicker>
            <h2 className="font-display text-2xl tracking-[-0.01em]">Paket Standar</h2>
            <p className="mt-1.5 text-sm text-ash max-w-xs">
              Harga per item yang tampil di halaman pricing.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-[2.2rem] leading-[0.9] tnum">
              {formatPrice(Number(standarPrice || 0))}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 mt-1">
              /item
            </div>
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <Field label="Harga (Rp)" className="flex-1">
            <input
              type="number"
              value={standarPrice}
              onChange={(e) => setStandarPrice(e.target.value)}
              className={inputCls}
              placeholder="500000"
            />
          </Field>
          <Btn variant="dark" onClick={handleSaveStandarPrice} disabled={savingPrice} className="h-[42px]">
            {savingPrice ? <Spinner /> : null}
            {savingPrice ? "Menyimpan" : "Simpan"}
          </Btn>
        </div>
        {priceMessage && (
          <p
            className={cn(
              "mt-3 font-mono text-[11px]",
              priceMessage.success ? "text-safelight" : "text-safelight-dim",
            )}
          >
            {priceMessage.text}
          </p>
        )}
      </Panel>

      <Kicker className="mb-4">Paket Langganan</Kicker>

      {fetching ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada paket langganan</EmptyState>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Panel key={plan.id} className="p-6 flex flex-col">
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="font-display text-[3rem] leading-[0.85] tnum">{plan.quota}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">foto</span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 mb-5">
                kuota / bulan
              </p>

              <div className="border-t hairline border-solid pt-4 space-y-2.5 mb-6">
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Monthly</span>
                  <span className="font-display text-lg tnum">
                    {formatPrice(plan.priceMonthly)}
                    <span className="font-mono text-[10px] text-ash-2 ml-1">/bln</span>
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Annual</span>
                  <span className="font-display text-lg tnum">
                    {formatPrice(plan.priceAnnual)}
                    <span className="font-mono text-[10px] text-ash-2 ml-1">/thn</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <Btn variant="ghost" onClick={() => openEdit(plan)} className="flex-1">Edit</Btn>
                <Btn variant="danger" onClick={() => handleDelete(plan.id)} className="flex-1">Hapus</Btn>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          kicker="Langganan"
          title={editPlan ? "Edit Paket" : "Tambah Paket"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.general && (
              <p className="text-safelight-dim text-xs font-mono">{errors.general}</p>
            )}

            <Field label="Kuota Download" error={errors.quota}>
              <input
                type="number"
                value={form.quota}
                onChange={(e) => setForm({ ...form, quota: e.target.value })}
                className={inputCls}
                placeholder="contoh: 10"
                autoFocus
              />
            </Field>

            <Field label="Harga Monthly (Rp)" error={errors.priceMonthly}>
              <input
                type="number"
                value={form.priceMonthly}
                onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                className={inputCls}
                placeholder="contoh: 2500000"
              />
            </Field>

            <Field label="Harga Annual (Rp)" error={errors.priceAnnual}>
              <input
                type="number"
                value={form.priceAnnual}
                onChange={(e) => setForm({ ...form, priceAnnual: e.target.value })}
                className={inputCls}
                placeholder="contoh: 22000000"
              />
            </Field>

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