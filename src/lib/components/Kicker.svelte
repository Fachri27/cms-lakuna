<script lang="ts">
	import { cn } from '$lib/cn';
	let { children, class: cls = '', tone = 'ash' }: { children: import('svelte').Snippet; class?: string; tone?: 'ash' | 'safelight' | 'paper' } = $props();
	const toneCls = tone === 'safelight' ? 'text-safelight' : tone === 'paper' ? 'text-paper/50' : 'text-ash';
</script>

<p class={cn('font-mono text-[10.5px] uppercase tracking-[0.22em] flex items-center gap-2', toneCls, cls)}>
	<span aria-hidden class="text-safelight">▍</span>
	{@render children()}
</p>
