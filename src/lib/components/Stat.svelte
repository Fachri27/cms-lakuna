<script lang="ts">
	import { cn } from '$lib/cn';
	let {
		index,
		label,
		value,
		class: cls = ''
	}: { index?: string; label: string; value: string; class?: string } = $props();
</script>

<div class={cn('relative', cls)}>
	{#if index}<span class="absolute top-0 right-0 font-mono text-[10px] text-ash-2">{index}</span>{/if}
	<p class="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash mb-3">{label}</p>
	<span class="font-display text-[2.6rem] leading-[0.9] tracking-[-0.02em] tnum text-ink">{value}</span>
</div>
