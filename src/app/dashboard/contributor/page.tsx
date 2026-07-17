"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import {
  SectionHeader,
  Panel,
  Stat,
  Badge,
  EmptyState,
  Skeleton,
  Kicker,
} from "@/components/ui";

export default function ContributorDashboard() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyPhotos();
  }, []);

  async function fetchMyPhotos() {
    try {
      const res = await api.get("/photos/my");
      setPhotos(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const pending = photos.filter((p) => p.status === "PENDING");
  const approved = photos.filter((p) => p.status === "APPROVED");
  const rejected = photos.filter((p) => p.status === "REJECTED");

  const statusLabel = (s: string) =>
    s === "APPROVED" ? "Disetujui" : s === "REJECTED" ? "Ditolak" : "Menunggu";

  return (
    <div className="rise">
      <SectionHeader
        index="01"
        kicker="Ringkasan"
        title="Studio Kontributor"
        className="mb-10"
      />

      {/* Status strip */}
      <Panel className="p-7 mb-10">
        <Kicker className="mb-7">Status Foto</Kicker>
        {loading ? (
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <Stat
              index="01"
              label="Menunggu"
              value={pending.length}
              className="sm:pr-6 pb-6 sm:pb-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
            />
            <Stat
              index="02"
              label="Disetujui"
              value={approved.length}
              tone="safelight"
              className="sm:px-6 py-6 sm:py-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
            />
            <Stat
              index="03"
              label="Ditolak"
              value={rejected.length}
              className="sm:pl-6 pt-6 sm:pt-0"
            />
          </div>
        )}
      </Panel>

      {/* Photo list */}
      <Panel>
        <div className="px-7 py-5 border-b hairline border-solid">
          <Kicker className="mb-1.5">02 — Katalog</Kicker>
          <p className="font-display text-lg">Foto saya</p>
        </div>

        {loading ? (
          <div className="p-7 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState>Belum ada foto diunggah</EmptyState>
        ) : (
          <ul className="divide-y divide-ink/10">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="flex items-center gap-4 px-7 py-4 hover:bg-ink/[0.02] transition-colors"
              >
                <div className="w-12 h-12 shrink-0 bg-ink text-paper rounded-[3px] flex items-center justify-center font-display text-lg">
                  {(photo.title || "·").trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink truncate">{photo.title}</p>
                  <p className="font-mono text-[11px] text-ash-2 uppercase tracking-wider">
                    {photo.type}
                  </p>
                </div>
                <Badge status={photo.status}>
                  {statusLabel(photo.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}