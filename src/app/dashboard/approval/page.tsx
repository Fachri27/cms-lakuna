"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Th,
  Td,
  Btn,
  EmptyState,
  Skeleton,
} from "@/components/ui";

export default function ApprovalPage() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    try {
      const res = await api.get("/photos/pending");
      setPhotos(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await api.patch(`/photos/${id}/approve`, null);
      setPhotos(photos.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReject(id: string) {
    try {
      await api.patch(`/photos/${id}/reject`, null);
      setPhotos(photos.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="rise">
      <SectionHeader
        index="02"
        kicker="Studio"
        title="Persetujuan"
        className="mb-8"
      />

      {loading ? (
        <Panel className="p-7 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Panel>
      ) : photos.length === 0 ? (
        <Panel>
          <EmptyState>Tidak ada foto menunggu persetujuan</EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Foto</Th>
                <Th>Kontributor</Th>
                <Th>Tipe</Th>
                <Th>Harga</Th>
                <Th>Tanggal</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {photos.map((photo) => (
                <tr key={photo.id} className="hover:bg-ink/[0.02] transition-colors">
                  <Td>
                    <div className="flex items-center gap-3">
                      {photo.thumbUrl ? (
                        <img
                          src={photo.thumbUrl}
                          alt=""
                          className="w-11 h-11 object-cover rounded-[3px]"
                        />
                      ) : (
                        <div className="w-11 h-11 bg-ink text-paper rounded-[3px] flex items-center justify-center font-display">
                          {(photo.title || "·").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-ink">{photo.title}</span>
                    </div>
                  </Td>
                  <Td className="font-mono text-[11px] text-ash">
                    {photo.user?.username || photo.user?.email || "—"}
                  </Td>
                  <Td className="font-mono text-[11px] text-ash uppercase">{photo.type}</Td>
                  <Td className="font-display text-base tnum">
                    {formatPrice(photo.price ?? 0)}
                  </Td>
                  <Td className="font-mono text-[11px] text-ash">
                    {new Date(photo.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Btn variant="primary" onClick={() => handleApprove(photo.id)}>
                        Setujui
                      </Btn>
                      <Btn variant="danger" onClick={() => handleReject(photo.id)}>
                        Tolak
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}