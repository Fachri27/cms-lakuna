import { api } from './api';

/**
 * Tipe aset di form foto/video. "Eksklusif" bukan tipe baru di database: ia adalah tipe FOTO/VIDEO
 * ditambah penanda `isExclusive` (galeri dan filter tak berubah). Form menampilkannya sebagai satu pilihan.
 *
 * Tiap tipe punya harga bawaan; memilih tipe otomatis memilih harganya (masih bisa diubah manual).
 */
export type PhotoTypeKey = 'FOTO' | 'FOTO_EKSKLUSIF' | 'VIDEO' | 'VIDEO_EKSKLUSIF';

export const PHOTO_TYPES: { key: PhotoTypeKey; label: string; price: number }[] = [
	{ key: 'FOTO', label: 'Foto', price: 250_000 },
	{ key: 'FOTO_EKSKLUSIF', label: 'Foto eksklusif', price: 500_000 },
	{ key: 'VIDEO', label: 'Video', price: 500_000 },
	{ key: 'VIDEO_EKSKLUSIF', label: 'Video eksklusif', price: 1_000_000 }
];

/** Gabung daftar harga (unik, naik) + selalu sertakan harga bawaan tiap tipe di atas. */
export function priceOptionsFrom(...lists: number[][]): number[] {
	const all = [...PHOTO_TYPES.map((t) => t.price), ...lists.flat()].filter((n) => Number.isFinite(n) && n > 0);
	return [...new Set(all)].sort((a, b) => a - b);
}

/**
 * Pilihan harga di form = preset yang diatur admin (Settings › photo_price_presets; bawaannya ada di API) + harga
 * bawaan tiap tipe. Dulu form memakai daftar tertulis sendiri, jadi mengubah preset di Settings tak berpengaruh.
 */
export async function loadPriceOptions(): Promise<number[]> {
	try {
		const r = await api<{ value?: string }>('/settings/photo_price_presets');
		const presets: unknown = JSON.parse(r?.value || '[]');
		return priceOptionsFrom(Array.isArray(presets) ? presets.map(Number) : []);
	} catch {
		return priceOptionsFrom();
	}
}

export const defaultPriceFor = (key: PhotoTypeKey): number => PHOTO_TYPES.find((t) => t.key === key)!.price;

/** Kunci form → nilai untuk API (`type` + `isExclusive`). */
export function toApi(key: PhotoTypeKey): { type: 'FOTO' | 'VIDEO'; isExclusive: boolean } {
	return { type: key.startsWith('VIDEO') ? 'VIDEO' : 'FOTO', isExclusive: key.endsWith('EKSKLUSIF') };
}

/** Nilai dari API → kunci form. */
export function fromApi(type: string | undefined | null, isExclusive: boolean | undefined | null): PhotoTypeKey {
	const video = type === 'VIDEO';
	if (isExclusive) return video ? 'VIDEO_EKSKLUSIF' : 'FOTO_EKSKLUSIF';
	return video ? 'VIDEO' : 'FOTO';
}

export const isVideoKey = (key: PhotoTypeKey): boolean => key.startsWith('VIDEO');
