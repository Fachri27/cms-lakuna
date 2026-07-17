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
  EmptyState,
  Skeleton,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface Photographer {
  id: string;
  name: string;
  bio: string | null;
}

export default function PhotographersClient() {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Photographer | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", bio: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPhotographers();
  }, [search]);

  async function fetchPhotographers() {
    setFetching(true);
    try {
      const res = await api.get("/photographers", {
        params: { search: search || undefined, limit: 100 },
      });
      setPhotographers(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  function openCreate() {
    setEditItem(null);
    setForm({ name: "", bio: "" });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(item: Photographer) {
    setEditItem(item);
    setForm({ name: item.name, bio: item.bio || "" });
    setErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nama fotografer wajib diisi";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = { name: form.name.trim(), bio: form.bio.trim() || undefined };

      if (editItem) {
        await api.patch(`/photographers/${editItem.id}`, payload);
      } else {
        await api.post("/photographers", payload);
      }

      setShowForm(false);
      fetchPhotographers();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus fotografer ini?")) return;
    try {
      await api.delete(`/photographers/${id}`);
      fetchPhotographers();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus fotografer");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="07"
        kicker="Studio"
        title="Fotografer"
        action={<Btn variant="primary" onClick={openCreate}>+ Tambah</Btn>}
        className="mb-8"
      />

      <div className="mb-6 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari fotografer…" />
      </div>

      {fetching ? (
        <Panel className="p-7 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : photographers.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada fotografer</EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Bio</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {photographers.map((item) => (
                <tr key={item.id} className="hover:bg-ink/[0.02] transition-colors">
                  <Td className="text-ink">{item.name}</Td>
                  <Td className="text-ash">{item.bio || "—"}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Btn variant="ghost" onClick={() => openEdit(item)}>Edit</Btn>
                      <Btn variant="danger" onClick={() => handleDelete(item.id)}>Hapus</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {showForm && (
        <Modal
          kicker="Studio"
          title={editItem ? "Edit Fotografer" : "Tambah Fotografer"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.general && (
              <p className="text-safelight-dim text-xs font-mono">{errors.general}</p>
            )}

            <Field label="Nama" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
                placeholder="Nama fotografer"
                autoFocus
              />
            </Field>

            <Field label="Bio" hint="(opsional)">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                className={cn(inputCls, "resize-none")}
                placeholder="Bio fotografer…"
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