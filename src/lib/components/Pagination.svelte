<script lang="ts">
	let {
		page,
		totalPages,
		onchange
	}: { page: number; totalPages: number; onchange: (p: number) => void } = $props();
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-center gap-3 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ash">
		<button
			onclick={() => onchange(page - 1)}
			disabled={page <= 1}
			class="px-3 py-1.5 border hairline border-solid rounded-[3px] disabled:opacity-30 hover:bg-ink/[0.04] transition-colors"
		>← Prev</button>
		<span class="tnum text-ink">{page} / {totalPages}</span>
		<button
			onclick={() => onchange(page + 1)}
			disabled={page >= totalPages}
			class="px-3 py-1.5 border hairline border-solid rounded-[3px] disabled:opacity-30 hover:bg-ink/[0.04] transition-colors"
		>Next →</button>
	</div>
{/if}
