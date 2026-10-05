<script lang="ts">
	import { cn } from '$lib/cn';
	let { children, class: cls = '' }: { children: import('svelte').Snippet; class?: string } = $props();
</script>

<div class={cn('py-16 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ash-2', cls)}>
	{@render children()}
</div>
