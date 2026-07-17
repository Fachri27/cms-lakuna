"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Kicker,
  Btn,
  Field,
  Skeleton,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export default function SettingsPage() {
  const [presets, setPresets] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [message, setMessage] = useState("");
  const [sharePct, setSharePct] = useState("70");
  const [shareSaving, setShareSaving] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    fetchPresets();
  }, []);

  async function fetchPresets() {
    try {
      const [presetRes, shareRes] = await Promise.all([
        api.get("/settings/photo_price_presets"),
        api.get("/settings/contributor_share_percentage"),
      ]);
      const raw = presetRes.data.data?.value || "[]";
      setPresets(JSON.parse(raw));
      setSharePct(shareRes.data.data?.value || "70");
    } catch {
      setPresets([50000, 100000, 150000, 200000, 250000, 350000, 500000]);
      setSharePct("70");
    } finally {
      setLoading(false);
    }
  }

  async function savePresets(values: number[]) {
    setSaving(true);
    setMessage("");
    try {
      await api.patch("/settings/photo_price_presets", {
        value: JSON.stringify(values),
      });
      setPresets(values);
      setMessage("Berhasil disimpan");
    } catch {
      setMessage("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  function addPreset() {
    const price = Number(newPrice);
    if (!price || price <= 0) return;
    if (presets.includes(price)) {
      setMessage("Harga sudah ada");
      return;
    }
    const updated = [...presets, price].sort((a, b) => a - b);
    savePresets(updated);
    setNewPrice("");
  }

  function removePreset(price: number) {
    savePresets(presets.filter((p) => p !== price));
  }

  async function saveSharePct() {
    const n = Number(sharePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setShareMsg("Harus angka 0–100");
      return;
    }
    setShareSaving(true);
    setShareMsg("");
    try {
      await api.patch("/settings/contributor_share_percentage", {
        value: String(Math.floor(n)),
      });
      setShareMsg("Berhasil disimpan");
    } catch {
      setShareMsg("Gagal menyimpan");
    } finally {
      setShareSaving(false);
    }
  }

  const msgTone = (m: string) => m.includes("Gagal") || m.includes("Harus") || m.includes("sudah");

  return (
    <div className="rise max-w-2xl">
      <SectionHeader
        index="08"
        kicker="Sistem"
        title="Pengaturan"
        className="mb-8"
      />

      <Panel className="p-7 mb-6">
        <Kicker className="mb-2">Preset</Kicker>
        <h2 className="font-display text-2xl tracking-[-0.01em] mb-2">Harga Foto</h2>
        <p className="text-sm text-ash mb-5">
          Pilihan harga cepat yang muncul saat upload / edit foto.
        </p>

        {loading ? (
          <Skeleton className="h-12" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {presets.map((price) => (
                <span
                  key={price}
                  className="inline-flex items-center gap-2 bg-ink/[0.06] px-2.5 py-1.5 rounded-[3px] text-xs tnum"
                >
                  {formatPrice(price)}
                  <button
                    type="button"
                    onClick={() => removePreset(price)}
                    className="text-ash-2 hover:text-safelight-dim"
                    aria-label="Hapus"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {presets.length === 0 && (
                <span className="font-mono text-[11px] text-ash-2 uppercase tracking-[0.14em]">
                  Belum ada preset
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPreset()}
                placeholder="Tambah harga…"
                className={cn(inputCls, "max-w-xs")}
              />
              <Btn variant="dark" onClick={addPreset} disabled={saving || !newPrice}>
                {saving ? <Spinner /> : null}
                Tambah
              </Btn>
            </div>

            {message && (
              <p
                className={cn(
                  "mt-3 font-mono text-[11px]",
                  msgTone(message) ? "text-safelight-dim" : "text-safelight",
                )}
              >
                {message}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel className="p-7">
        <Kicker className="mb-2">Bagi Hasil</Kicker>
        <h2 className="font-display text-2xl tracking-[-0.01em] mb-2">Persentase Kontributor</h2>
        <p className="text-sm text-ash mb-5">
          Persentase penghasilan untuk kontributor dari setiap penjualan / langganan. Sisanya untuk platform.
        </p>
        <div className="flex gap-3 items-end">
          <Field label="Persentase" className="w-36">
            <input
              type="number"
              min={0}
              max={100}
              value={sharePct}
              onChange={(e) => setSharePct(e.target.value)}
              className={cn(inputCls, "tnum")}
            />
          </Field>
          <span className="font-display text-3xl text-ash pb-2.5">%</span>
          <Btn variant="dark" onClick={saveSharePct} disabled={shareSaving}>
            {shareSaving ? <Spinner /> : null}
            {shareSaving ? "Menyimpan" : "Simpan"}
          </Btn>
        </div>
        {shareMsg && (
          <p
            className={cn(
              "mt-3 font-mono text-[11px]",
              msgTone(shareMsg) ? "text-safelight-dim" : "text-safelight",
            )}
          >
            {shareMsg}
          </p>
        )}
      </Panel>
    </div>
  );
}