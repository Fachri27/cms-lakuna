"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import {
  SectionHeader,
  Panel,
  Field,
  Btn,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

export default function ContributorUploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    photographer: "",
    price: "",
    description: "",
    type: "FOTO",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video">("image");
  const [watermark, setWatermark] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [pricePresets, setPricePresets] = useState<number[]>([]);

  useEffect(() => {
    api
      .get("/settings/photo_price_presets")
      .then((presetRes) => {
        const raw = presetRes.data.data?.value || "[]";
        setPricePresets(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith("video/")) {
      setFileType("video");
      setPreview(URL.createObjectURL(selected));
    } else {
      setFileType("image");
      setPreview(URL.createObjectURL(selected));
    }
  }

  function handleWatermark(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setWatermark(selected);
    setWatermarkPreview(URL.createObjectURL(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = "Title harus diisi";
    if (!form.photographer) newErrors.photographer = "Photographer harus diisi";
    if (!form.price) newErrors.price = "Price harus diisi";
    if (!file) newErrors.file = "Photo/Video harus diupload";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("photographer", form.photographer);
      formData.append("price", form.price);
      formData.append("type", form.type);
      if (form.description) formData.append("description", form.description);
      formData.append("photo", file!);
      if (watermark) formData.append("watermark", watermark);

      await api.post("/photos", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Foto berhasil diupload dan menunggu persetujuan admin.");
      router.push("/dashboard/contributor");
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (typeof msg === "object") {
        setErrors(msg);
      } else {
        setErrors({ general: msg || "Terjadi kesalahan" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rise max-w-2xl">
      <SectionHeader
        index="01"
        kicker="Kontribusi"
        title="Upload Foto"
        className="mb-8"
      />

      <Panel className="p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <p className="text-safelight-dim text-xs font-mono">{errors.general}</p>
          )}

          <Field label="Tipe">
            <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
              <option value="FOTO">Foto</option>
              <option value="VIDEO">Video</option>
            </select>
          </Field>

          <Field label={form.type === "VIDEO" ? "Video" : "Foto"} error={errors.file}>
            <div
              className="border border-dashed border-ink/20 rounded-[3px] p-5 text-center cursor-pointer hover:border-safelight hover:bg-ink/[0.02] transition-colors"
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              {preview ? (
                fileType === "video" ? (
                  <video src={preview} className="mx-auto max-h-60 rounded-[3px] object-cover" controls />
                ) : (
                  <img src={preview} alt="preview" className="mx-auto max-h-60 rounded-[3px] object-cover" />
                )
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
                  Klik untuk upload {form.type === "VIDEO" ? "video" : "foto"}
                </p>
              )}
            </div>
            <input id="fileInput" type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          </Field>

          <Field label="Watermark" hint="(opsional — gambar PNG transparan)">
            <div
              className="border border-dashed border-ink/20 rounded-[3px] p-5 text-center cursor-pointer hover:border-safelight hover:bg-ink/[0.02] transition-colors"
              onClick={() => document.getElementById("watermarkInput")?.click()}
            >
              {watermarkPreview ? (
                <img
                  src={watermarkPreview}
                  alt="watermark preview"
                  className="mx-auto max-h-32 rounded-[3px] object-contain"
                />
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
                  Klik untuk upload watermark sendiri
                </p>
              )}
            </div>
            <input
              id="watermarkInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWatermark}
            />
            <p className="mt-1 font-mono text-[10px] text-ash-2">
              Kosongkan untuk pakai watermark default LAKUNA.
            </p>
          </Field>

          <Field label="Judul" error={errors.title}>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={100}
              className={inputCls}
              placeholder="Masukkan judul"
            />
            <span className="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
              {form.title.length}/100
            </span>
          </Field>

          <Field label="Fotografer" error={errors.photographer}>
            <input
              name="photographer"
              type="text"
              value={form.photographer}
              onChange={handleChange}
              maxLength={100}
              className={inputCls}
              placeholder="Nama fotografer (bebas)"
            />
          </Field>

          <Field label="Harga" error={errors.price}>
            <input
              name="price"
              type="number"
              min={0}
              value={form.price}
              onChange={handleChange}
              className={cn(inputCls, "tnum")}
              placeholder="0"
            />
            {pricePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pricePresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setForm({ ...form, price: String(p) }); setErrors({ ...errors, price: "" }); }}
                    className={cn(
                      "px-2.5 py-1 rounded-[3px] text-xs border hairline border-solid transition-colors tnum",
                      Number(form.price) === p
                        ? "bg-ink text-paper border-ink"
                        : "text-ink hover:bg-ink/[0.04]",
                    )}
                  >
                    {formatPrice(p)}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Deskripsi" hint="(opsional)">
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              maxLength={500}
              rows={4}
              className={cn(inputCls, "resize-none")}
              placeholder="Deskripsi…"
            />
            <span className="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
              {form.description.length}/500
            </span>
          </Field>

          <Btn type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? <Spinner /> : null}
            {loading ? "Mengupload" : "Upload"}
          </Btn>
        </form>
      </Panel>
    </div>
  );
}