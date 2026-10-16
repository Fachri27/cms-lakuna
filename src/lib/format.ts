export function formatPrice(n: number | string): string {
	const num = typeof n === 'string' ? Number(n) : n;
	if (Number.isNaN(num)) return 'Rp 0';
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0
	}).format(num);
}

// ── Tanggal & waktu pengambilan (takenAt) ────────────────────────────────────
// <input type="datetime-local"> memakai waktu LOKAL browser ("YYYY-MM-DDTHH:mm"); API menyimpan ISO (UTC).

/** ISO dari API → nilai datetime-local (waktu lokal browser). Kosong bila null/tidak valid. */
export function isoToLocalInput(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const two = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Nilai datetime-local (waktu lokal browser) → ISO untuk API. "" bila kosong/tidak valid (= dikosongkan). */
export function localInputToIso(value: string): string {
	if (!value.trim()) return '';
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Batas atas input (hari ini + 1 hari, waktu lokal) — sama dengan validasi API. */
export function takenAtMax(): string {
	return isoToLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
}
export const TAKEN_AT_MIN = '1900-01-01T00:00';

/** Pesan galat bila di luar batas wajar (sebelum 1900 / lebih dari 1 hari ke depan); '' bila aman/kosong. */
export function takenAtError(value: string): string {
	if (!value.trim()) return '';
	const t = new Date(value).getTime();
	if (Number.isNaN(t)) return 'Tanggal pengambilan tidak valid';
	if (t < new Date(TAKEN_AT_MIN).getTime() || t > Date.now() + 24 * 60 * 60 * 1000)
		return 'Tanggal pengambilan harus setelah 1900 dan tidak di masa depan';
	return '';
}

/** Tampilan tanggal & waktu pengambilan, mis. "12 Okt 2026, 06.30". */
export function formatTakenAt(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
