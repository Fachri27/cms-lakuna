<script lang="ts">
	import { cn } from '$lib/cn';
	const DOT: Record<string, string> = {
		PAID: 'bg-safelight',
		APPROVED: 'bg-safelight',
		COMPLETED: 'bg-safelight',
		ACTIVE: 'bg-safelight',
		PENDING: 'bg-ash',
		REJECTED: 'bg-ink',
		CANCELLED: 'bg-ink/30',
		EXPIRED: 'bg-ink/30'
	};
	let {
		status,
		class: cls = '',
		children
	}: { status: string; class?: string; children?: import('svelte').Snippet } = $props();
	const dot = DOT[status] ?? 'bg-ash-2';
</script>

<span class={cn('inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70', cls)}>
	<span class={cn('inline-block w-1.5 h-1.5 rounded-full', dot)}></span>
	{#if children}{@render children()}{:else}{status}{/if}
</span>
