<script lang="ts">
	import { cn } from '$lib/cn';
	let { children, class: cls = '' }: { children: import('svelte').Snippet; class?: string } = $props();
</script>

<div class={cn('bg-card border hairline rounded-[3px] shadow-[0_1px_0_rgba(16,15,13,0.04)]', cls)}>
	{@render children()}
</div>
