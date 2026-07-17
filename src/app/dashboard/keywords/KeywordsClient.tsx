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

interface Keyword {
  id: string;
  name: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function KeywordsClient() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editKeyword, setEditKeyword] = useState<Keyword | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchKeywords();
  }, [page, search]);

  async function fetchKeywords() {
    setFetching(true);
    try {
      const res = await api.get("/keywords", {
        params: { page, limit: 10, search: search || undefined },
      });
      setKeywords(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  function openCreate() {
    setEditKeyword(null);
    setForm({ name: "" });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(keyword: Keyword) {
    setEditKeyword(keyword);
    setForm({ name: keyword.name });
    setErrors({});
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nama keyword wajib diisi";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = { name: form.name.trim() };

      if (editKeyword) {
        await api.patch(`/keywords/${editKeyword.id}`, payload);
      } else {
        await api.post("/keywords", payload);
      }

      setShowForm(false);
      fetchKeywords();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setErrors({ general: msg || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus keyword ini?")) return;
    try {
      await api.delete(`/keywords/${id}`);
      fetchKeywords();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus keyword");
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="06"
        kicker="Taksonomi"
        title="Keyword"
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
          placeholder="Cari keyword…"
        />
      </div>

      {fetching ? (
        <Panel className="p-7 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : keywords.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada keyword</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th align="right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-ink/[0.02] transition-colors">
                    <Td className="text-ink">{kw.name}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <Btn variant="ghost" onClick={() => openEdit(kw)}>Edit</Btn>
                        <Btn variant="danger" onClick={() => handleDelete(kw.id)}>Hapus</Btn>
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
          title={editKeyword ? "Edit Keyword" : "Tambah Keyword"}
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
                placeholder="Nama keyword"
                autoFocus
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