/**
 * Sounds (aset AUDIO) di CMS — terpisah dari Foto / Video. Jenis audio menentukan harga bawaan; harga tetap bisa
 * diganti dari daftar preset (Settings › photo_price_presets).
 */
export type SoundKind = 'MUSIC' | 'SFX';

export const SOUND_KINDS: { key: SoundKind; label: string; price: number }[] = [
	{ key: 'MUSIC', label: 'Musik', price: 150_000 },
	{ key: 'SFX', label: 'Efek suara', price: 50_000 }
];

export const soundKindLabel = (k: string | null | undefined): string => (k === 'SFX' ? 'Efek suara' : 'Musik');
export const defaultSoundPrice = (k: SoundKind): number => SOUND_KINDS.find((x) => x.key === k)!.price;

/** Pilihan berkas di form unggah — sejalan dengan daftar MIME audio di API (middlewares/upload.ts). */
export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.flac,.aif,.aiff,.ogg,.oga,.opus,.m4a,.aac';
export const AUDIO_HINT = 'MP3, WAV, FLAC, AIFF, OGG, M4A · maks 20 menit';

const EXT_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	flac: 'audio/flac',
	aif: 'audio/aiff',
	aiff: 'audio/aiff',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	opus: 'audio/ogg',
	m4a: 'audio/mp4',
	aac: 'audio/aac'
};

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

export function isAudioFile(f: File): boolean {
	return f.type.startsWith('audio/') || extOf(f.name) in EXT_MIME;
}

/**
 * Beberapa peramban/OS memberi `type` kosong untuk FLAC/AIFF → terkirim sebagai application/octet-stream dan
 * ditolak API. Beri MIME dari ekstensinya (isinya tetap diverifikasi ffprobe di server).
 */
export function withAudioMime(f: File): File {
	if (f.type.startsWith('audio/')) return f;
	const mime = EXT_MIME[extOf(f.name)];
	return mime ? new File([f], f.name, { type: mime, lastModified: f.lastModified }) : f;
}

/** 92.4 → "1:32". */
export function fmtDuration(sec: number | null | undefined): string {
	if (!sec || !(sec > 0)) return '—';
	const s = Math.round(sec);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Durasi berkas lokal (detik) dari metadata peramban; 0 bila tak terbaca (mis. AIFF di Chrome). */
export function readDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const a = new Audio();
		const done = (v: number) => {
			a.removeAttribute('src');
			resolve(v);
		};
		a.preload = 'metadata';
		a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
		a.onerror = () => done(0);
		a.src = url;
	});
}
