<script lang="ts">
	import Kicker from './Kicker.svelte';
	import { cn } from '$lib/cn';
	let {
		index,
		kicker,
		title,
		class: cls = '',
		children
	}: {
		index?: string;
		kicker?: string;
		title: string;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class={cn('flex items-end justify-between gap-6', cls)}>
	<div>
		{#if kicker}<Kicker class="mb-2">{index ? `${index} — ${kicker}` : kicker}</Kicker>{/if}
		<h1 class="font-display text-[2.1rem] leading-[1.05] tracking-[-0.01em]">{title}</h1>
	</div>
	{#if children}<div class="shrink-0">{@render children()}</div>{/if}
</div>
