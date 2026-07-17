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
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
  }, [page, search]);

  async function fetchCategories() {
    setFetching(true);
    try {
      const res = await api.get("/categories", {
        params: { page, limit: 10, search: search || undefined },
      });
      setCategories(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  function openCreate() {
    setEditCategory(null);
    setForm({ name: "", description: "" });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setEditCategory(category);
    setForm({ name: category.name, description: category.description || "" });
    setErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nama category wajib diisi";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      };

      if (editCategory) {
        await api.patch(`/categories/${editCategory.id}`, payload);
      } else {
        await api.post("/categories", payload);
      }

      setShowForm(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus category ini?")) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus category");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="05"
        kicker="Taksonomi"
        title="Kategori"
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
          placeholder="Cari kategori…"
        />
      </div>

      {fetching ? (
        <Panel className="p-7 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : categories.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada kategori</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Deskripsi</Th>
                  <Th align="right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-ink/[0.02] transition-colors">
                    <Td className="text-ink">{cat.name}</Td>
                    <Td className="text-ash">{cat.description || "—"}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <Btn variant="ghost" onClick={() => openEdit(cat)}>Edit</Btn>
                        <Btn variant="danger" onClick={() => handleDelete(cat.id)}>Hapus</Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {meta && (
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onChange={setPage}
            />
          )}
        </>
      )}

      {showForm && (
        <Modal
          kicker="Taksonomi"
          title={editCategory ? "Edit Kategori" : "Tambah Kategori"}
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
                placeholder="Nama kategori"
                autoFocus
              />
            </Field>

            <Field label="Deskripsi" hint="(opsional)">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={cn(inputCls, "resize-none")}
                placeholder="Deskripsi kategori…"
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