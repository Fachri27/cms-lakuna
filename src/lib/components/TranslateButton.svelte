<script lang="ts">
	import { ApiError } from '$lib/api';
	import Spinner from './Spinner.svelte';

	/**
	 * Tombol kecil "Terjemahkan dari ID" — mengurus status memuat, galat, dan penanda hasil sendiri:
	 * - sesudah berhasil: "✓ Sudah diterjemahkan" + tombol jadi "Terjemahkan ulang";
	 * - teks ID diubah sesudahnya (`source` berbeda dari yang diterjemahkan): "Teks ID berubah";
	 * - kolom tujuan (`target` = atribut name) berkedip sebentar supaya terlihat apa yang terisi.
	 */
	let {
		run,
		disabled = false,
		label = 'Terjemahkan dari ID',
		source = '',
		target = ''
	}: {
		run: () => Promise<void>;
		disabled?: boolean;
		label?: string;
		/** Teks/isi ID saat ini — dibandingkan dengan yang terakhir diterjemahkan. */
		source?: string;
		/** Atribut `name` kolom yang diisi hasil terjemahan (untuk sorotan sesaat). */
		target?: string;
	} = $props();

	let busy = $state(false);
	let error = $state('');
	/** Isi ID yang terakhir berhasil diterjemahkan (null = belum pernah di sesi ini). */
	let doneFor = $state<string | null>(null);
	const status = $derived(doneFor === null ? 'none' : doneFor === source ? 'done' : 'stale');

	function flash() {
		if (!target) return;
		const el = document.querySelector<HTMLElement>(`[name="${target}"]`);
		if (!el) return;
		el.classList.add('translate-flash');
		window.setTimeout(() => el.classList.remove('translate-flash'), 1600);
	}

	async function onclick() {
		if (busy || disabled) return;
		busy = true;
		error = '';
		const from = source;
		try {
			await run();
			doneFor = from;
			flash();
		} catch (err) {
			error = err instanceof ApiError || err instanceof Error ? err.message : 'Gagal menerjemahkan';
		} finally {
			busy = false;
		}
	}
</script>

<span class="flex items-center gap-2" aria-live="polite">
	{#if error}
		<span class="font-mono text-[10.5px] text-safelight-dim" role="alert">{error}</span>
	{:else if status === 'done'}
		<span class="font-mono text-[10.5px] text-ink">✓ Sudah diterjemahkan</span>
	{:else if status === 'stale'}
		<span class="font-mono text-[10.5px] text-safelight-dim">Teks ID berubah</span>
	{/if}
	<button
		type="button"
		{onclick}
		disabled={busy || disabled}
		title={disabled ? 'Isi versi Indonesia dulu' : undefined}
		class="inline-flex items-center gap-1.5 rounded-[3px] border hairline px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-safelight hover:text-safelight-dim disabled:cursor-not-allowed disabled:opacity-40"
	>
		{#if busy}<Spinner />Menerjemahkan…{:else if status === 'none'}{label}{:else}Terjemahkan ulang{/if}
	</button>
</span>

<style>
	/* Sorotan sesaat pada kolom yang baru terisi hasil terjemahan. */
	:global(.translate-flash) {
		animation: translate-flash 1.6s ease-out;
	}
	@keyframes translate-flash {
		0%,
		35% {
			border-color: var(--color-safelight);
			box-shadow: 0 0 0 3px var(--color-safelight-soft);
			background-color: color-mix(in oklab, var(--color-safelight) 6%, transparent);
		}
		100% {
			box-shadow: 0 0 0 3px transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.translate-flash) {
			animation: none;
		}
	}
</style>
