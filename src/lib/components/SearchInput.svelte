<script lang="ts">
	import { cn, inputCls } from '$lib/ui-classes';
	let {
		value = $bindable(''),
		placeholder = 'Cari…',
		class: cls = ''
	}: { value?: string; placeholder?: string; class?: string } = $props();
</script>

<div class={cn('relative', cls)}>
	<span aria-hidden class="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ash-2">⌕</span>
	<input type="text" bind:value {placeholder} class={cn(inputCls, 'pl-8')} />
</div>
