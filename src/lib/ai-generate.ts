/** AI Generate (API: /ai-generations — modul aiGenerate). */

export type AiAspect = '1:1' | '3:2' | '2:3' | '16:9' | '9:16';
export type AiType = 'FOTO' | 'VIDEO';
export type AiStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

export type AiProviderInfo = {
	provider: string;
	model: string;
	configured: boolean;
	aspects: AiAspect[];
	/** Server lokal: false = belum dinyalakan; null/undefined = penyedia cloud (tak dicek). */
	online?: boolean | null;
} | null;
export type AiLimit = { limit: number; used: number; remaining: number | null };

export type AiConfig = {
	image: AiProviderInfo;
	video: AiProviderInfo;
	metadata: string;
	maxImagesPerRequest: number;
	limits: { image: AiLimit; video: AiLimit };
};

export type AiPhoto = {
	id: string;
	title: string;
	titleEn: string | null;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	type: AiType;
	width: number | null;
	height: number | null;
	rejectNote: string | null;
	thumbUrl: string;
	watermarkUrl: string;
};

export type AiJob = {
	id: string;
	prompt: string;
	type: AiType;
	provider: string;
	model: string | null;
	aspectRatio: AiAspect;
	count: number;
	done: number;
	failed: number;
	status: AiStatus;
	error: string | null;
	price: number;
	title: string | null;
	keywords: string | null;
	categoryIds: string[] | null;
	createdAt: string;
	finishedAt: string | null;
	creator: { username: string } | null;
	photos: AiPhoto[];
};

export const ASPECT_LABEL: Record<AiAspect, string> = {
	'1:1': 'Persegi 1:1',
	'3:2': 'Lanskap 3:2',
	'2:3': 'Potret 2:3',
	'16:9': 'Lebar 16:9',
	'9:16': 'Vertikal 9:16'
};

export const STATUS_LABEL: Record<AiStatus, string> = {
	QUEUED: 'Antre',
	RUNNING: 'Membuat…',
	SUCCEEDED: 'Selesai',
	PARTIAL: 'Sebagian gagal',
	FAILED: 'Gagal'
};

export const PHOTO_STATUS_LABEL: Record<AiPhoto['status'], string> = {
	PENDING: 'Menunggu kurasi',
	APPROVED: 'Tayang',
	REJECTED: 'Ditolak'
};

export const isOpen = (s: AiStatus) => s === 'QUEUED' || s === 'RUNNING';
