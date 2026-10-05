<script lang="ts">
	import { cn } from '$lib/cn';
	let { class: cls = '' }: { class?: string } = $props();
</script>

<div class={cn('bg-ink/[0.06] rounded-[3px] animate-pulse', cls)}></div>
