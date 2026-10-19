/** Pencairan otomatis bagi hasil (API: /payouts/auto, /payouts/mine/auto — modul payout.auto). */

export type SkipReason =
	| 'NO_ACCOUNT'
	| 'UNSUPPORTED'
	| 'ACCOUNT_REJECTED'
	| 'PAUSED'
	| 'ACCOUNT_RECENT'
	| 'IN_FLIGHT'
	| 'BELOW_MIN';

export type AutoPayoutConfig = {
	enabled: boolean;
	day: number;
	minAmount: number;
	holdDays: number;
	feeContributor: number;
};

export type PreviewRow = {
	contributorId: string;
	name: string;
	email: string;
	pending: number;
	held: number;
	payable: number;
	eligible: boolean;
	net: number;
	reason: SkipReason | null;
	reasonLabel: string | null;
	paused: boolean;
	pausedReason: string | null;
	destination: string | null;
};

export type PayoutRun = {
	id: string;
	period: string | null;
	trigger: 'SCHEDULE' | 'ADMIN';
	startedAt: string;
	finishedAt: string | null;
	sent: number;
	succeeded: number;
	failed: number;
	skipped: number;
	totalAmount: number;
	summary: Array<{ contributorId: string; name: string; reason: SkipReason; payable: number }> | null;
};

export type ProcessingPayout = {
	id: string;
	amount: number;
	fee: number;
	partnerRef: string | null;
	gateway: string | null;
	failureReason: string | null;
	submittedAt: string | null;
	createdAt: string;
	destination: { provider: string; accountNumber: string; accountName: string; verifiedName?: string } | null;
	contributor: { id: string; email: string; realName: string | null } | null;
};

export type AutoPayoutOverview = {
	config: AutoPayoutConfig;
	gateway: { name: 'DOKU' | 'SIMULASI'; mode: string; configured: boolean } | null;
	ranThisPeriod: boolean;
	nextRunAt: string | null;
	preview: PreviewRow[];
	totals: { eligible: number; amount: number };
	processing: ProcessingPayout[];
	runs: PayoutRun[];
};

export type MyAutoPayout = {
	active: boolean;
	day: number;
	minAmount: number;
	holdDays: number;
	fee: number;
	nextRunAt: string | null;
	pending: number;
	held: number;
	payable: number;
	eligible: boolean;
	reason: SkipReason | null;
	reasonLabel: string | null;
};

/** Label pendek status kelayakan untuk daftar admin. */
export const SKIP_SHORT: Record<SkipReason, string> = {
	NO_ACCOUNT: 'Tanpa rekening',
	UNSUPPORTED: 'Cairkan manual',
	ACCOUNT_REJECTED: 'Rekening ditolak',
	PAUSED: 'Ditahan',
	ACCOUNT_RECENT: 'Rekening baru',
	IN_FLIGHT: 'Diproses',
	BELOW_MIN: 'Di bawah minimum'
};

/** "1 November 2026 10.00 WIB". */
export function fmtWib(iso: string | null): string {
	if (!iso) return '—';
	return (
		new Date(iso).toLocaleString('id-ID', {
			timeZone: 'Asia/Jakarta',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}) + ' WIB'
	);
}

/** Satu kunci per aksi: klik ganda/retry tak memicu run atau penuntasan kedua (API: middleware idempotent). */
export function idemHeaders(): HeadersInit {
	return { 'Idempotency-Key': crypto.randomUUID() };
}

/** Status payout → label Indonesia. */
export const PAYOUT_STATUS_LABEL: Record<string, string> = {
	COMPLETED: 'Terkirim',
	PROCESSING: 'Diproses',
	FAILED: 'Gagal',
	PENDING: 'Menunggu',
	REJECTED: 'Ditolak'
};
