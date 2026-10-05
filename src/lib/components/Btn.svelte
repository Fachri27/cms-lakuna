<script lang="ts">
	import { cn } from '$lib/cn';
	let {
		children,
		variant = 'ghost',
		disabled = false,
		type = 'button',
		class: cls = '',
		onclick
	}: {
		children: import('svelte').Snippet;
		variant?: 'primary' | 'ghost' | 'dark' | 'danger';
		disabled?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		onclick?: (e: MouseEvent) => void;
	} = $props();
	const base =
		'inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] px-4 py-2.5 rounded-[3px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
	const v =
		variant === 'primary'
			? 'bg-safelight text-white hover:bg-safelight-dim'
			: variant === 'dark'
				? 'bg-ink text-paper hover:bg-ink-3'
				: variant === 'danger'
					? 'border border-safelight/30 text-safelight-dim hover:bg-safelight/[0.06]'
					: 'border hairline text-ink hover:bg-ink/[0.04]';
</script>

<button {type} {disabled} class={cn(base, v, cls)} {onclick}>
	{@render children()}
</button>
