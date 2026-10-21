import { defaultSoundPrice, type SoundKind } from './sound-types';

/**
 * Satu berkas di form unggah Sounds (multi-berkas): tiap audio membawa isiannya sendiri dan diunggah sebagai satu
 * POST /photos (tipe AUDIO otomatis dari berkasnya) lalu kategori & keyword.
 */
export type SoundUploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface SoundItem {
	id: string;
	file: File;
	/** blob: URL pemutar pratinjau lokal — dilepas saat item dihapus / halaman ditinggalkan. */
	preview: string;
	/** Durasi terbaca peramban (0 = belum/tak terbaca). */
	duration: number;
	kind: SoundKind;
	title: string;
	titleEn: string;
	photographer: string;
	price: number;
	/** '' = tidak diisi. */
	bpm: string;
	description: string;
	descriptionEn: string;
	/** Sampul persegi opsional (tanpa sampul → gambar waveform otomatis). */
	cover: File | null;
	coverPreview: string | null;
	categories: string[];
	keywords: string[];
	keywordsEn: string[];
	errors: Record<string, string>;
	status: SoundUploadStatus;
	/** Diisi begitu berkasnya tersimpan; "Upload" berikutnya hanya mengulang kategori/keyword. */
	photoId: string | null;
	message: string;
	open: boolean;
}

let seq = 0;

/** Judul awal dari nama berkas ("hujan-tropis_01.wav" → "Hujan tropis 01"). */
function titleFromName(name: string): string {
	const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
	return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 100);
}

export function newSoundItem(file: File, open = false): SoundItem {
	// Musik dulu; begitu durasinya terbaca, berkas < 30 dtk dianggap efek suara (SoundUploader). Tetap bisa diganti.
	const kind: SoundKind = 'MUSIC';
	return {
		id: `s${Date.now().toString(36)}${(seq++).toString(36)}`,
		file,
		preview: URL.createObjectURL(file),
		duration: 0,
		kind,
		title: titleFromName(file.name),
		titleEn: '',
		photographer: '',
		price: defaultSoundPrice(kind),
		bpm: '',
		description: '',
		descriptionEn: '',
		cover: null,
		coverPreview: null,
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

export const SOUND_MIN_CATEGORIES = 1;
export const SOUND_MIN_KEYWORDS = 3;

export function validateSound(it: SoundItem): Record<string, string> {
	const e: Record<string, string> = {};
	if (!it.title.trim()) e.title = 'Judul harus diisi';
	if (!it.photographer.trim()) e.photographer = 'Kreator / komposer harus diisi';
	if (!(it.price > 0)) e.price = 'Harga harus diisi';
	const bpm = it.bpm.trim();
	if (bpm && !(/^\d{2,3}$/.test(bpm) && Number(bpm) >= 20 && Number(bpm) <= 300)) e.bpm = 'BPM 20–300 (angka bulat)';
	if (it.categories.length < SOUND_MIN_CATEGORIES) e.categories = `Kategori minimal ${SOUND_MIN_CATEGORIES}`;
	if (it.keywords.length < SOUND_MIN_KEYWORDS) e.keywords = `Keyword minimal ${SOUND_MIN_KEYWORDS}`;
	return e;
}

export function releaseSoundItem(it: SoundItem) {
	URL.revokeObjectURL(it.preview);
	if (it.coverPreview) URL.revokeObjectURL(it.coverPreview);
}
