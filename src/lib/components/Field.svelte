<script lang="ts">
	import { cn } from '$lib/cn';
	export const inputCls =
		'w-full border hairline border-solid rounded-[3px] bg-card-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-safelight placeholder:text-ash-2';
	export const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2';
	let {
		label,
		class: cls = '',
		children,
		action
	}: {
		label: string;
		class?: string;
		children: import('svelte').Snippet;
		/** Kontrol kecil di sisi kanan label (mis. tombol terjemahkan). */
		action?: import('svelte').Snippet;
	} = $props();
</script>

<div class={cn(cls)}>
	{#if action}
		<!-- Tinggi baris = tinggi label saja: tombol aksi "melayang" supaya kotak isian tetap sejajar dengan kolom sebelahnya. -->
		<div class="mb-2 flex h-[15px] items-center justify-between gap-3">
			<label class={cn(labelCls, 'mb-0')}>{label}</label>
			<span class="flex h-[15px] items-center">{@render action()}</span>
		</div>
	{:else}
		<label class={labelCls}>{label}</label>
	{/if}
	{@render children()}
</div>
