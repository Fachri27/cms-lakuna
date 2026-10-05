export function formatPrice(n: number | string): string {
	const num = typeof n === 'string' ? Number(n) : n;
	if (Number.isNaN(num)) return 'Rp 0';
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0
	}).format(num);
}
