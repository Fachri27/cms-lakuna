<script lang="ts">
	import { cn } from '$lib/cn';
	export const inputCls =
		'w-full border hairline border-solid rounded-[3px] bg-card-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-safelight placeholder:text-ash-2';
	export const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2';
	let {
		label,
		class: cls = '',
		children
	}: { label: string; class?: string; children: import('svelte').Snippet } = $props();
</script>

<div class={cn(cls)}>
	<label class={labelCls}>{label}</label>
	{@render children()}
</div>
