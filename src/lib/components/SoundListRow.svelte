<script lang="ts">
	import { cn } from '$lib/ui-classes';
	import { formatPrice } from '$lib/format';
	import { fmtDuration, soundKindLabel } from '$lib/sound-types';
	import Badge from './Badge.svelte';

	/**
	 * Satu baris daftar audio di Studio (admin › Sounds, kontributor › Sounds): sampul, putar pratinjau, gelombang
	 * kecil dengan progres, data audio, dan slot aksi. Pemutarannya diatur halaman (satu <audio> per halaman).
	 */
	export interface SoundRowData {
		id: string;
		title: string;
		photographer?: string | null;
		thumbUrl?: string | null;
		watermarkUrl?: string | null;
		price: number;
		duration?: number | null;
		bpm?: number | null;
		audioKind?: string | null;
		waveform?: number[] | null;
		status?: string;
		rejectNote?: string | null;
	}

	let {
		sound,
		playing = false,
		progress = 0,
		onToggle,
		showStatus = false,
		actions
	}: {
		sound: SoundRowData;
		playing?: boolean;
		/** 0–1 bila baris ini yang sedang aktif. */
		progress?: number;
		onToggle: () => void;
		showStatus?: boolean;
		actions?: import('svelte').Snippet;
	} = $props();

	const BARS = 64;
	const bars = $derived.by(() => {
		const src = sound.waveform ?? [];
		return Array.from({ length: BARS }, (_, i) => {
			if (!src.length) return 6;
			const a = Math.floor((i * src.length) / BARS);
			const b = Math.max(a + 1, Math.floor(((i + 1) * src.length) / BARS));
			return Math.max(6, ...src.slice(a, b));
		});
	});
</script>

<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[3px] border hairline border-solid bg-card p-3 sm:p-4 lg:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)_auto_auto]">
	<button
		type="button"
		onclick={onToggle}
		aria-label={playing ? `Jeda ${sound.title}` : `Putar ${sound.title}`}
		class="group relative h-14 w-14 shrink-0 overflow-hidden rounded-[3px] bg-ink"
	>
		{#if sound.thumbUrl}
			<img src={sound.thumbUrl} alt="" class="h-full w-full object-cover object-top" />
		{/if}
		<span class={cn('absolute inset-0 grid place-items-center bg-ink/45 text-paper transition-opacity', playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
			{#if playing}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.03-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" /></svg>
			{/if}
		</span>
	</button>

	<div class="min-w-0">
		<p class="truncate font-display text-lg leading-tight tracking-[-0.01em]">{sound.title}</p>
		<p class="mt-1 truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
			{sound.photographer || '—'} · {soundKindLabel(sound.audioKind)} · {fmtDuration(sound.duration)}{sound.bpm ? ` · ${sound.bpm} BPM` : ''}
		</p>
		{#if showStatus && sound.status}
			<div class="mt-1.5 flex flex-wrap items-center gap-2">
				<Badge status={sound.status}>{sound.status === 'APPROVED' ? 'Tayang' : sound.status === 'PENDING' ? 'Menunggu kurasi' : 'Ditolak'}</Badge>
				{#if sound.status === 'REJECTED' && sound.rejectNote}<span class="text-xs text-safelight-dim">{sound.rejectNote}</span>{/if}
			</div>
		{/if}
	</div>

	<svg viewBox={`0 0 ${BARS * 4} 100`} preserveAspectRatio="none" class="hidden h-9 w-full lg:block" aria-hidden="true">
		{#each bars as v, i (i)}
			<rect x={i * 4 + 0.6} y={(100 - v) / 2} width="2.8" height={v} rx="1.4" class={i / BARS < progress ? 'fill-safelight' : 'fill-ink/25'} />
		{/each}
	</svg>

	<p class="hidden font-display text-xl tnum lg:block">{formatPrice(sound.price)}</p>

	<div class="flex shrink-0 items-center gap-2">
		{@render actions?.()}
	</div>
</div>
