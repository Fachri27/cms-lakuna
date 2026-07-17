"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import { SectionHeader, Btn, Skeleton, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Photo {
  id: string;
  title: string;
  thumbUrl: string;
  photographer: string;
  price: number;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PhotosClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const page = Number(searchParams.get("page") || "1");

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/photos?page=${page}&limit=12`);
      setPhotos(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus foto ini?")) return;
    setDeleting(id);
    try {
      await api.delete(`/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Gagal menghapus foto");
    } finally {
      setDeleting(null);
    }
  }

  const pages = Array.from({ length: meta.totalPages }, (_, i) => i + 1)
    .filter((p) => Math.abs(p - meta.page) <= 2 || p === 1 || p === meta.totalPages);

  return (
    <div className="rise">
      <SectionHeader
        index="01"
        kicker="Studio"
        title="Foto"
        action={
          <Link href="/dashboard/photos/create">
            <Btn variant="primary">+ Upload</Btn>
          </Link>
        }
        className="mb-8"
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState className="py-24">Belum ada foto</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="group bg-card border hairline rounded-[3px] overflow-hidden shadow-[0_1px_0_rgba(16,15,13,0.04)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ink/5">
                <img
                  src={photo.thumbUrl}
                  alt={photo.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <figcaption className="p-5">
                <h2 className="font-display text-xl leading-tight tracking-[-0.01em] line-clamp-1">
                  {photo.title}
                </h2>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
                  {photo.photographer || "—"}
                </p>
                <p className="mt-3 font-display text-2xl tnum">{formatPrice(photo.price)}</p>
                <div className="flex gap-2 mt-4">
                  <Link href={`/dashboard/photos/${photo.id}/edit`} className="flex-1">
                    <Btn variant="ghost" className="w-full">Edit</Btn>
                  </Link>
                  <Btn
                    variant="danger"
                    onClick={() => handleDelete(photo.id)}
                    disabled={deleting === photo.id}
                    className="flex-1"
                  >
                    {deleting === photo.id ? "…" : "Hapus"}
                  </Btn>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-10 font-mono text-[11px] tnum">
          {pages.map((p, idx, arr) => {
            const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
            return (
              <div key={p} className="flex items-center gap-1.5">
                {showEllipsis && <span className="text-ash-2">···</span>}
                <button
                  onClick={() => goToPage(p)}
                  className={cn(
                    "w-9 h-9 rounded-[3px] flex items-center justify-center transition-colors",
                    meta.page === p
                      ? "bg-ink text-paper"
                      : "border hairline border-solid text-ink hover:bg-ink/[0.04]",
                  )}
                >
                  {p}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}