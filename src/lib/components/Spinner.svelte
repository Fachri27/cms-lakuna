<script lang="ts">
	import { cn } from '$lib/cn';
	let { class: cls = '' }: { class?: string } = $props();
</script>

<span class={cn('inline-block w-3.5 h-3.5 border border-ink/30 border-t-safelight rounded-full animate-spin', cls)} aria-hidden></span>
