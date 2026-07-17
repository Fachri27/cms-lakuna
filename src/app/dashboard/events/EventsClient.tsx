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

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  valueType: "PERCENT" | "NOMINAL";
  value: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  targetType: "PHOTO" | "PLAN";
  _count?: { eventPhotos: number; eventPlans: number };
}

interface EventDetail extends EventRow {
  eventPhotos: Array<{ photo: { id: string; title: string } }>;
  eventPlans: Array<{ plan: { id: string; quota: number } }>;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PhotoOption {
  id: string;
  title: string;
  thumbUrl: string | null;
  price: number;
}

interface PlanOption {
  id: string;
  quota: number;
  priceMonthly: number;
  priceAnnual: number;
  isActive: boolean;
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatValue(v: EventRow) {
  if (v.valueType === "PERCENT") {
    const base = `${v.value}%`;
    if (v.maxDiscount) return `${base} · max ${formatPrice(v.maxDiscount)}`;
    return base;
  }
  return formatPrice(v.value);
}

const emptyForm = {
  name: "",
  description: "",
  valueType: "PERCENT" as EventRow["valueType"],
  value: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  targetType: "PHOTO" as EventRow["targetType"],
};

export default function EventsClient() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<EventDetail | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // target picker state
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [photoSearch, setPhotoSearch] = useState("");
  const [photoOptions, setPhotoOptions] = useState<PhotoOption[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [fetchingTargets, setFetchingTargets] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [page, search]);

  async function fetchEvents() {
    setFetching(true);
    try {
      const res = await api.get("/events", {
        params: { page, limit: 10, search: search || undefined },
      });
      setEvents(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  // Fetch plans once when modal opens & targetType PLAN
  useEffect(() => {
    if (!showForm) return;
    if (planOptions.length > 0) return;
    api
      .get("/plans")
      .then((res) => setPlanOptions(res.data.data || []))
      .catch(() => {});
  }, [showForm, planOptions.length]);

  // Fetch photos (with search) when targetType PHOTO
  useEffect(() => {
    if (!showForm || form.targetType !== "PHOTO") return;
    setFetchingTargets(true);
    const t = setTimeout(() => {
      api
        .get("/photos", { params: { search: photoSearch || undefined, limit: 40 } })
        .then((res) => setPhotoOptions(res.data.data || []))
        .catch(() => setPhotoOptions([]))
        .finally(() => setFetchingTargets(false));
    }, 300);
    return () => clearTimeout(t);
  }, [showForm, form.targetType, photoSearch]);

  function openCreate() {
    setEditEvent(null);
    setForm({ ...emptyForm });
    setTargetIds([]);
    setPhotoSearch("");
    setErrors({});
    setShowForm(true);
  }

  async function openEdit(e: EventRow) {
    try {
      const res = await api.get(`/events/${e.id}`);
      const detail: EventDetail = res.data.data;
      setEditEvent(detail);
      setForm({
        name: detail.name,
        description: detail.description || "",
        valueType: detail.valueType,
        value: String(detail.value),
        maxDiscount: detail.maxDiscount != null ? String(detail.maxDiscount) : "",
        startsAt: toLocalInput(detail.startsAt),
        endsAt: toLocalInput(detail.endsAt),
        isActive: detail.isActive,
        targetType: detail.targetType,
      });
      setTargetIds(
        detail.targetType === "PHOTO"
          ? detail.eventPhotos.map((ep) => ep.photo.id)
          : detail.eventPlans.map((ep) => ep.plan.id),
      );
      setPhotoSearch("");
      setErrors({});
      setShowForm(true);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal memuat event");
    }
  }

  function toggleTarget(id: string) {
    setTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nama wajib diisi";
    if (!form.value || Number(form.value) <= 0) newErrors.value = "Value harus > 0";
    if (form.valueType === "PERCENT" && Number(form.value) > 100)
      newErrors.value = "Persen maks 100";
    if (!form.startsAt) newErrors.startsAt = "Mulai wajib diisi";
    if (!form.endsAt) newErrors.endsAt = "Berakhir wajib diisi";
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt))
      newErrors.endsAt = "Berakhir harus setelah mulai";
    if (targetIds.length === 0) newErrors.targets = "Pilih minimal 1 target";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        valueType: form.valueType,
        value: Number(form.value),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        isActive: form.isActive,
        targetType: form.targetType,
        ...(form.targetType === "PHOTO" ? { photoIds: targetIds } : { planIds: targetIds }),
      };

      if (editEvent) {
        await api.patch(`/events/${editEvent.id}`, payload);
      } else {
        await api.post("/events", payload);
      }

      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus event ini?")) return;
    try {
      await api.delete(`/events/${id}`);
      fetchEvents();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus event");
    }
  }

  async function toggleActive(e: EventRow) {
    try {
      await api.patch(`/events/${e.id}`, { isActive: !e.isActive });
      fetchEvents();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal mengubah status");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="07"
        kicker="Diskon"
        title="Event Diskon"
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
          placeholder="Cari event…"
        />
      </div>

      {fetching ? (
        <Panel className="p-7 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : events.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada event</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Target</Th>
                  <Th>Nilai</Th>
                  <Th>Periode</Th>
                  <Th>Status</Th>
                  <Th align="right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const now = Date.now();
                  const ended = new Date(e.endsAt).getTime() < now;
                  const started = new Date(e.startsAt).getTime() <= now;
                  const status = !e.isActive ? "CANCELLED" : ended ? "EXPIRED" : started ? "ACTIVE" : "PENDING";
                  const targetCount =
                    e.targetType === "PHOTO" ? e._count?.eventPhotos ?? 0 : e._count?.eventPlans ?? 0;
                  return (
                    <tr key={e.id} className="hover:bg-ink/[0.02] transition-colors">
                      <Td className="text-ink">{e.name}</Td>
                      <Td className="text-ash">
                        {e.targetType === "PHOTO" ? "Foto" : "Plan"} · {targetCount} item
                      </Td>
                      <Td className="text-ink tnum">{formatValue(e)}</Td>
                      <Td className="text-ash-2 font-mono text-[11px]">
                        {toLocalInput(e.startsAt).slice(0, 10)} → {toLocalInput(e.endsAt).slice(0, 10)}
                      </Td>
                      <Td>
                        <Badge status={status} />
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-2">
                          <Btn variant="ghost" onClick={() => toggleActive(e)}>
                            {e.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Btn>
                          <Btn variant="ghost" onClick={() => openEdit(e)}>Edit</Btn>
                          <Btn variant="danger" onClick={() => handleDelete(e.id)}>Hapus</Btn>
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
          title={editEvent ? "Edit Event" : "Tambah Event"}
          onClose={() => setShowForm(false)}
          className="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.general && (
              <p className="text-safelight-dim text-xs font-mono">{errors.general}</p>
            )}

            <Field label="Nama event" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
                className={inputCls}
                placeholder="cth. Flash Sale Lebaran"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipe nilai">
                <select
                  value={form.valueType}
                  onChange={(e) => setForm({ ...form, valueType: e.target.value as EventRow["valueType"] })}
                  className={inputCls}
                >
                  <option value="PERCENT">Persen (%)</option>
                  <option value="NOMINAL">Nominal (Rp)</option>
                </select>
              </Field>

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
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <Field label="Mulai" error={errors.startsAt}>
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

            <Field label="Target diskon">
              <div className="flex gap-2 mb-3">
                {(["PHOTO", "PLAN"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, targetType: t });
                      setTargetIds([]);
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-[3px] text-xs font-mono uppercase tracking-[0.14em] border hairline border-solid transition-colors",
                      form.targetType === t
                        ? "bg-ink text-paper border-ink"
                        : "text-ink hover:bg-ink/[0.04]",
                    )}
                  >
                    {t === "PHOTO" ? "Foto tertentu" : "Plan langganan"}
                  </button>
                ))}
              </div>

              {form.targetType === "PHOTO" ? (
                <>
                  <div className="mb-2">
                    <SearchInput
                      value={photoSearch}
                      onChange={setPhotoSearch}
                      placeholder="Cari foto…"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto border hairline border-solid rounded-[3px] divide-y hairline">
                    {fetchingTargets ? (
                      <div className="p-4"><Skeleton className="h-8" /></div>
                    ) : photoOptions.length === 0 ? (
                      <div className="p-4 font-mono text-[11px] text-ash-2 text-center">Tidak ada foto</div>
                    ) : (
                      photoOptions.map((p) => {
                        const checked = targetIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-ink/[0.03]",
                              checked && "bg-ink/[0.04]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTarget(p.id)}
                              className="accent-safelight"
                            />
                            {p.thumbUrl && (
                              <img
                                src={p.thumbUrl}
                                alt={p.title}
                                className="w-10 h-10 rounded-[3px] object-cover"
                              />
                            )}
                            <span className="text-sm text-ink flex-1 truncate">{p.title}</span>
                            <span className="font-mono text-[10px] text-ash-2 tnum">{formatPrice(p.price)}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="max-h-56 overflow-y-auto border hairline border-solid rounded-[3px] divide-y hairline">
                  {planOptions.length === 0 ? (
                    <div className="p-4 font-mono text-[11px] text-ash-2 text-center">Tidak ada plan</div>
                  ) : (
                    planOptions.map((p) => {
                      const checked = targetIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-ink/[0.03]",
                            checked && "bg-ink/[0.04]",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTarget(p.id)}
                            className="accent-safelight"
                          />
                          <span className="text-sm text-ink flex-1">
                            Quota <span className="tnum">{p.quota}</span>
                          </span>
                          <span className="font-mono text-[10px] text-ash-2 tnum">
                            {formatPrice(p.priceMonthly)}/bln
                          </span>
                          {!p.isActive && (
                            <span className="font-mono text-[9px] uppercase tracking-wider text-safelight-dim">nonaktif</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              {errors.targets && (
                <p className="mt-1.5 text-safelight-dim text-xs font-mono">{errors.targets}</p>
              )}
              <p className="mt-1.5 font-mono text-[10px] text-ash-2">
                {targetIds.length} target terpilih
              </p>
            </Field>

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