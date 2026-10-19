<script lang="ts">
	import { cn } from '$lib/cn';
	import { blockedMessage, fmtMb, fmtReset, type QuotaWindow, type UploadQuota } from '$lib/upload-quota';
	import Kicker from './Kicker.svelte';

	/** Meteran kuota unggah kontributor — halaman Upload (`self`) dan modal batas unggah admin (`admin`, ringkas). */
	let {
		quota,
		viewer = 'self',
		class: cls = ''
	}: { quota: UploadQuota; viewer?: 'self' | 'admin'; class?: string } = $props();
	const admin = $derived(viewer === 'admin');

	const rows = $derived<{ label: string; w: QuotaWindow; hint: string }[]>([
		{ label: 'Hari ini', w: quota.daily, hint: quota.daily.resetAt ? `pulih ${fmtReset(quota.daily.resetAt)} WIB` : '' },
		{ label: 'Bulan ini', w: quota.monthly, hint: quota.monthly.resetAt ? `pulih ${fmtReset(quota.monthly.resetAt)} WIB` : '' },
		{ label: 'Menunggu kurasi', w: quota.pending, hint: 'berkurang saat karya ditinjau' }
	]);
	const blocked = $derived(
		admin && quota.blockedBy === 'BLOCKED'
			? `Hak unggah dicabut${quota.reason ? `: ${quota.reason}` : ''}`
			: blockedMessage(quota)
	);

	const pct = (w: QuotaWindow) => (w.limit === 0 ? 0 : Math.min(100, Math.round((w.used / w.limit) * 100)));
</script>

<div class={cn('rounded-[3px] border hairline border-solid p-5', cls)}>
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
		<Kicker>{admin ? 'Pemakaian' : 'Kuota unggah'}{quota.custom ? (admin ? ' · batas khusus' : ' · khusus akunmu') : ''}</Kicker>
		<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
			Maks foto {fmtMb(quota.photoMaxMb)} · video {fmtMb(quota.videoMaxMb)}
		</span>
	</div>

	{#if blocked}
		<p class="mb-4 rounded-[3px] bg-safelight/10 px-3.5 py-2.5 text-sm text-safelight-dim" role="alert">{blocked}</p>
	{/if}

	<div class={cn('grid', admin ? 'gap-3' : 'gap-4 sm:grid-cols-3')}>
		{#each rows as r (r.label)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between gap-2">
					<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">{r.label}</span>
					<span class="tnum text-sm text-ink">
						{#if r.w.limit === 0}{r.w.used} <span class="text-ash-2">/ ∞</span>{:else}{r.w.used} <span class="text-ash-2">/ {r.w.limit}</span>{/if}
					</span>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
					<div
						class={cn('h-full rounded-full transition-[width]', r.w.remaining === 0 ? 'bg-safelight-dim' : 'bg-safelight')}
						style="width: {pct(r.w)}%"
					></div>
				</div>
				{#if r.hint && r.w.limit !== 0 && !admin}
					<p class="mt-1 font-mono text-[10px] text-ash-2">{r.hint}</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
