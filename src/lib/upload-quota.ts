import { api } from '$lib/api';

/** Kuota unggah dari GET /upload-limits/me (lihat API modules/uploadLimit). limit 0 = tanpa batas. */
export type QuotaWindow = { limit: number; used: number; remaining: number | null; resetAt: string | null };
export type UploadQuota = {
	unlimited: boolean;
	blocked: boolean;
	reason: string | null;
	custom: boolean;
	daily: QuotaWindow;
	monthly: QuotaWindow;
	pending: QuotaWindow;
	photoMaxMb: number;
	videoMaxMb: number;
	canUpload: boolean;
	blockedBy: 'BLOCKED' | 'DAILY' | 'MONTHLY' | 'PENDING' | null;
};

export function fetchMyQuota(): Promise<UploadQuota> {
	return api<UploadQuota>('/upload-limits/me');
}

export function fmtMb(mb: number): string {
	return mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

/** "20 Okt, 00.00" (WIB) — kapan kuota pulih. */
export function fmtReset(iso: string | null): string {
	if (!iso) return '';
	return new Date(iso).toLocaleString('id-ID', {
		timeZone: 'Asia/Jakarta',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Alasan kontributor tak bisa mengunggah sekarang (null = boleh). */
export function blockedMessage(q: UploadQuota): string | null {
	switch (q.blockedBy) {
		case 'BLOCKED':
			return `Hak unggah akunmu sedang dinonaktifkan admin${q.reason ? `: ${q.reason}` : ''}.`;
		case 'DAILY':
			return `Batas unggah harian (${q.daily.limit} berkas) tercapai. Kuota pulih ${fmtReset(q.daily.resetAt)} WIB.`;
		case 'MONTHLY':
			return `Batas unggah bulanan (${q.monthly.limit} berkas) tercapai. Kuota pulih ${fmtReset(q.monthly.resetAt)} WIB.`;
		case 'PENDING':
			return `Sudah ada ${q.pending.used} karya yang menunggu kurasi (batas ${q.pending.limit}). Unggah lagi setelah sebagian ditinjau admin.`;
		default:
			return null;
	}
}

/** Pesan bila berkas melebihi batas ukuran kontributor (null = aman). Diperiksa juga di server. */
export function fileTooBig(file: File, q: UploadQuota | null): string | null {
	if (!q || q.unlimited) return null;
	const video = file.type.startsWith('video/');
	// Audio (Sounds) memakai batas video — sama dengan API (uploadLimit.middleware).
	const audio = file.type.startsWith('audio/');
	const maxMb = video || audio ? q.videoMaxMb : q.photoMaxMb;
	if (file.size <= maxMb * 1024 * 1024) return null;
	return `${video ? 'Video' : audio ? 'Audio' : 'Foto'} terlalu besar: ${fmtMb(Math.ceil(file.size / 1048576))} (maks ${fmtMb(maxMb)})`;
}
