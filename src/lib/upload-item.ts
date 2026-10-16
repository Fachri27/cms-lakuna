import type { PhotoTypeKey } from './photo-types';
import { takenAtError } from './format';

/**
 * Satu berkas di form upload multi-berkas: tiap foto/video membawa isiannya sendiri (judul, deskripsi,
 * fotografer, lokasi, tanggal pengambilan, kategori, keyword) dan diunggah sebagai satu POST /photos terpisah.
 */
export type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface UploadItem {
	id: string;
	file: File;
	/** blob: URL pratinjau — dilepas (revoke) saat item dihapus / halaman ditinggalkan. */
	preview: string;
	kind: 'image' | 'video';
	type: PhotoTypeKey;
	title: string;
	titleEn: string;
	photographer: string;
	location: string;
	/** Tanggal & waktu pengambilan: nilai datetime-local (waktu lokal browser), '' = tidak diisi. */
	takenAt: string;
	description: string;
	descriptionEn: string;
	categories: string[];
	keywords: string[];
	keywordsEn: string[];
	errors: Record<string, string>;
	status: UploadStatus;
	/**
	 * Diisi begitu berkasnya tersimpan. Bila kategori/keyword sesudahnya gagal, "Upload" berikutnya hanya
	 * mengulang langkah itu — berkas tidak diunggah dua kali.
	 */
	photoId: string | null;
	/** Pesan status/galat tingkat item (bukan per kolom). */
	message: string;
	open: boolean;
}

let seq = 0;

export function newUploadItem(file: File, open = false): UploadItem {
	const kind = file.type.startsWith('video/') ? 'video' : 'image';
	return {
		id: `u${Date.now().toString(36)}${(seq++).toString(36)}`,
		file,
		preview: URL.createObjectURL(file),
		kind,
		type: kind === 'video' ? 'VIDEO' : 'FOTO',
		title: '',
		titleEn: '',
		photographer: '',
		location: '',
		takenAt: '',
		description: '',
		descriptionEn: '',
		categories: [],
		keywords: [],
		keywordsEn: [],
		errors: {},
		status: 'idle',
		photoId: null,
		message: '',
		open
	};
}

/** Aturan sama dengan form satu berkas sebelumnya. */
export function validateItem(it: UploadItem): Record<string, string> {
	const e: Record<string, string> = {};
	if (!it.title.trim()) e.title = 'Title harus diisi';
	if (!it.photographer) e.photographer = 'Photographer harus diisi';
	if (it.categories.length < 5) e.categories = 'Category minimal 5';
	if (it.keywords.length < 5) e.keywords = 'Keyword minimal 5';
	const taken = takenAtError(it.takenAt);
	if (taken) e.takenAt = taken;
	return e;
}

export function fileSizeLabel(bytes: number): string {
	return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
