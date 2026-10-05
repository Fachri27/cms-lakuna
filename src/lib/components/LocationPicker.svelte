<script lang="ts">
	import { api } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';

	/**
	 * Combobox lokasi: ketik untuk menyaring lokasi yang sudah ada
	 * (GET /photos/locations), klik untuk memakai; teks bebas tetap boleh
	 * (lokasi baru).
	 */
	let {
		value = $bindable(''),
		placeholder = 'Contoh: Bromo, Jawa Timur'
	}: {
		value?: string;
		placeholder?: string;
	} = $props();

	let open = $state(false);
	let box = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let suggestions = $state<string[]>([]);
	let loading = $state(false);
	let seq = 0;

	$effect(() => {
		const q = value.trim();
		const cur = ++seq;
		if (!open) return;
		if (!q) {
			suggestions = [];
			return;
		}
		loading = true;
		const timer = setTimeout(async () => {
			try {
				const data = await api<string[]>(
					`/photos/locations?q=${encodeURIComponent(q)}&limit=20`
				);
				if (cur === seq) suggestions = (data ?? []).filter((s) => s.toLowerCase() !== q.toLowerCase());
			} catch {
				if (cur === seq) suggestions = [];
			} finally {
				if (cur === seq) loading = false;
			}
		}, 300);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		function onDocMouse(e: MouseEvent) {
			const t = e.target as Node;
			if (box && !box.contains(t)) open = false;
		}
		function onDocKey(e: KeyboardEvent) {
			if (e.key === 'Escape') open = false;
		}
		document.addEventListener('mousedown', onDocMouse);
		document.addEventListener('keydown', onDocKey);
		return () => {
			document.removeEventListener('mousedown', onDocMouse);
			document.removeEventListener('keydown', onDocKey);
		};
	});

	function pick(s: string) {
		value = s;
		open = false;
		inputEl?.focus();
	}
</script>

<div class="relative" bind:this={box}>
	<input
		name="location"
		bind:value
		bind:this={inputEl}
		maxlength={200}
		class={inputCls}
		{placeholder}
		autocomplete="off"
		role="combobox"
		aria-expanded={open && suggestions.length > 0}
		aria-autocomplete="list"
		onfocus={() => (open = true)}
		oninput={() => (open = true)}
	/>
	{#if open && (suggestions.length > 0 || loading)}
		<ul
			role="listbox"
			class="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-hair bg-paper shadow-xl"
		>
			{#each suggestions as s (s)}
				<li role="option" aria-selected="false">
					<button
						type="button"
						class="block w-full truncate px-4 py-2.5 text-left text-sm text-fg hover:bg-safelight/10 hover:text-safelight"
						onclick={() => pick(s)}
					>
						{s}
					</button>
				</li>
			{/each}
			{#if loading}
				<li class="px-4 py-2.5 text-xs text-fg-muted">Mencari…</li>
			{/if}
		</ul>
	{/if}
</div>
