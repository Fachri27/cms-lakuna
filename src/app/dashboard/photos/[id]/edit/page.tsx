"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/axios";
import KeywordInput from "@/components/KeywordInput";
import {
  SectionHeader,
  Panel,
  Field,
  Btn,
  Skeleton,
  inputCls,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

interface PhotoDetail {
  id: string;
  title: string;
  description?: string;
  photographer: string;
  price: number;
  thumbUrl: string;
  type: "FOTO" | "VIDEO";
  photoCategories?: Array<{ category: { id: string; name: string } }>;
  photoKeywords?: Array<{ keyword: { id: string; name: string } }>;
}

interface Category {
  id: string;
  name: string;
}

interface Keyword {
  id: string;
  name: string;
}

/* Custom Multi-Select Dropdown — Darkroom Editorial */
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
  error,
  min,
}: {
  label: string;
  options: Category[] | Keyword[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  error?: string;
  min?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const getOptionName = (id: string) => options.find((opt) => opt.id === id)?.name || "";
  const removeOption = (id: string) => onChange(selected.filter((s) => s !== id));

  const insufficient = min !== undefined && selected.length < min;
  const hasError = insufficient || !!error;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
        {label} <span className="text-ash-2 normal-case tracking-normal">(minimal {min ?? 0})</span>
      </label>

      <div
        className={cn(
          "w-full border hairline border-solid rounded-[3px] bg-card-2 px-3 py-2 cursor-pointer min-h-[42px] flex flex-wrap gap-1.5 items-center transition-colors",
          hasError
            ? "border-safelight-dim"
            : "focus-within:border-safelight focus-within:ring-2 focus-within:ring-safelight/15",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 ? (
          <span className="text-ash-2 text-sm">{placeholder}</span>
        ) : (
          selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 bg-ink/[0.06] px-2 py-1 rounded-[3px] text-xs"
            >
              {getOptionName(id)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(id);
                }}
                className="text-ash-2 hover:text-safelight-dim"
                aria-label="Hapus"
              >
                ✕
              </button>
            </span>
          ))
        )}
        <span
          aria-hidden
          className={cn(
            "ml-auto font-mono text-[10px] text-ash-2 transition-transform",
            isOpen && "rotate-180",
          )}
        >
          ▾
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-paper border hairline border-solid rounded-[3px] shadow-[0_8px_24px_rgba(16,15,13,0.12)] max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center px-4 py-2 hover:bg-ink/[0.04] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => toggleOption(option.id)}
                className="mr-2 accent-safelight"
              />
              <span className="text-sm text-ink">{option.name}</span>
            </label>
          ))}
        </div>
      )}

      {hasError && (
        <p className="mt-1.5 text-safelight-dim text-xs font-mono">
          {error || `${label} minimal ${min} (sekarang ${selected.length})`}
        </p>
      )}
    </div>
  );
}

export default function EditPhotoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    photographer: "",
    price: "",
    description: "",
    type: "FOTO" as "FOTO" | "VIDEO",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video">("image");
  const [watermark, setWatermark] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  const [pricePresets, setPricePresets] = useState<number[]>([]);
  const [photographers, setPhotographers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchPhoto() {
      try {
        const [catRes, presetRes, photoRes] = await Promise.all([
          api.get("/categories"),
          api.get("/settings/photo_price_presets").catch(() => ({ data: { data: null } })),
          api.get("/photographers", { params: { limit: 200 } }),
        ]);
        setCategories(catRes.data.data || []);
        setPhotographers(photoRes.data.data || []);
        const raw = presetRes.data.data?.value || "[]";
        setPricePresets(JSON.parse(raw));

        const res = await api.get(`/photos/${id}`);
        const photo: PhotoDetail = res.data.data;
        setForm({
          title: photo.title,
          photographer: photo.photographer,
          price: String(photo.price),
          description: photo.description || "",
          type: photo.type || "FOTO",
        });
        setPreview(photo.thumbUrl);

        setSelectedCategories(photo.photoCategories?.map((pc) => pc.category.id) || []);
        setSelectedKeywords(photo.photoKeywords?.map((pk) => pk.keyword.id) || []);

        setFileType("image");
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    fetchPhoto();
  }, [id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
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
    if (selectedCategories.length < 5) newErrors.categories = "Category minimal 5";
    if (selectedKeywords.length < 5) newErrors.keywords = "Keyword minimal 5";

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
      if (file) formData.append("photo", file);
      if (watermark) formData.append("watermark", watermark);

      await api.patch(`/photos/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Sync categories
      const currentCategoryIds = [...selectedCategories];
      const photoRes = await api.get(`/photos/${id}`);
      const photoData = photoRes.data.data as PhotoDetail;
      const existingCategoryIds = photoData.photoCategories?.map((pc) => pc.category.id) || [];

      for (const catId of existingCategoryIds) {
        if (!currentCategoryIds.includes(catId)) {
          await api.delete(`/photos/${id}/categories/${catId}`);
        }
      }
      const newCategoryIds = currentCategoryIds.filter((cid) => !existingCategoryIds.includes(cid));
      if (newCategoryIds.length > 0) {
        await api.post(`/photos/${id}/categories`, { categoryIds: newCategoryIds });
      }

      // Sync keywords
      const currentKeywordIds = [...selectedKeywords];
      const existingKeywordIds = photoData.photoKeywords?.map((pk) => pk.keyword.id) || [];

      for (const kwId of existingKeywordIds) {
        if (!currentKeywordIds.includes(kwId)) {
          await api.delete(`/photos/${id}/keywords/${kwId}`);
        }
      }
      const newKeywordIds = currentKeywordIds.filter((kid) => !existingKeywordIds.includes(kid));
      if (newKeywordIds.length > 0) {
        await api.post(`/photos/${id}/keywords`, { keywordIds: newKeywordIds });
      }

      router.refresh();
      router.replace(`/dashboard/photos?t=${Date.now()}`);
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

  if (fetching) {
    return (
      <div className="rise max-w-2xl">
        <Skeleton className="h-10 w-40 mb-6" />
        <Panel className="p-7 space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      </div>
    );
  }

  return (
    <div className="rise max-w-2xl">
      <SectionHeader
        index="01"
        kicker="Studio"
        title="Edit Photo / Video"
        action={
          <Link href="/dashboard/photos">
            <Btn variant="ghost">← Kembali</Btn>
          </Link>
        }
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

          <Field label={form.type === "VIDEO" ? "Video" : "Foto"}>
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
                  Klik untuk ganti {form.type === "VIDEO" ? "video" : "foto"}
                </p>
              )}
            </div>
            <input id="fileInput" type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
            <p className="mt-1 font-mono text-[10px] text-ash-2">
              JPG, PNG, GIF, MP4, WebM, MOV · maks 100MB untuk video
            </p>
          </Field>

          <Field label="Watermark" hint="(opsional — ganti watermark)">
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
                  Klik untuk upload watermark baru
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
              Kosongkan untuk tetap pakai watermark yang ada.
            </p>
          </Field>

          <Field label="Judul" error={errors.title}>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={100}
              className={inputCls}
              placeholder="Masukkan judul foto"
            />
            <span className="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
              {form.title.length}/100
            </span>
          </Field>

          <Field label="Fotografer" error={errors.photographer}>
            <select
              name="photographer"
              value={form.photographer}
              onChange={handleChange}
              className={inputCls}
            >
              <option value="">Pilih fotografer…</option>
              {photographers.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
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
                    onClick={() => {
                      setForm({ ...form, price: String(p) });
                      setErrors({ ...errors, price: "" });
                    }}
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
              placeholder="Deskripsi foto…"
            />
            <span className="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
              {form.description.length}/500
            </span>
          </Field>

          <MultiSelectDropdown
            label="Category"
            options={categories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Pilih category…"
            error={errors.categories}
            min={5}
          />

          <KeywordInput
            selected={selectedKeywords}
            onChange={setSelectedKeywords}
            error={errors.keywords}
            min={5}
          />

          <Btn type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? <Spinner /> : null}
            {loading ? "Menyimpan" : "Simpan Perubahan"}
          </Btn>
        </form>
      </Panel>
    </div>
  );
}