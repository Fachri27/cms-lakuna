<script lang="ts">
	import { api } from '$lib/api';
	import { cn, inputCls } from '$lib/ui-classes';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Category {
		id: string;
		name: string;
	}

	let {
		selected = $bindable<string[]>([]),
		categories = [],
		invalid = false,
		error = '',
		min = 5,
		onChange = () => {}
	}: {
		selected?: string[];
		categories?: Category[];
		invalid?: boolean;
		error?: string;
		min?: number;
		onChange?: () => void;
	} = $props();

	let open = $state(false);
	let box = $state<HTMLDivElement | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let results = $state<Category[]>([]);
	let loading = $state(false);

	let list = $derived(query.trim() ? results : categories);
	let message = $derived(
		error || (invalid ? `Category minimal ${min} (sekarang ${selected.length})` : '')
	);

	function catName(id: string) {
		return (
			categories.find((c) => c.id === id)?.name ??
			results.find((c) => c.id === id)?.name ??
			'…'
		);
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
		onChange();
	}

	$effect(() => {
		if (open) {
			searchEl?.focus();
		}
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

	$effect(() => {
		const q = query.trim();
		if (!q) {
			results = [];
			loading = false;
			return;
		}
		loading = true;
		const timer = setTimeout(async () => {
			try {
				const data = await api<Category[]>(
					`/categories?search=${encodeURIComponent(q)}&limit=50`
				);
				results = data ?? [];
			} catch {
				results = [];
			} finally {
				loading = false;
			}
		}, 300);
		return () => {
			clearTimeout(timer);
		};
	});
</script>

<div class="relative" bind:this={box}>
	<button
		type="button"
		onclick={() => (open = !open)}
		class={cn(
			'w-full border hairline border-solid rounded-[3px] bg-card-2 px-3 py-2 cursor-pointer min-h-[42px] flex flex-wrap gap-1.5 items-center transition-colors text-left',
			invalid
				? 'border-safelight-dim'
				: 'focus-within:border-safelight focus-within:ring-2 focus-within:ring-safelight/15'
		)}
	>
		{#if selected.length === 0}
			<span class="text-ash-2 text-sm">Pilih category…</span>
		{:else}
			{#each selected as id (id)}
				<span class="inline-flex items-center gap-1.5 bg-ink/[0.06] px-2 py-1 rounded-[3px] text-xs">
					{catName(id)}
					<span
						role="button"
						tabindex="0"
						onclick={(e) => {
							e.stopPropagation();
							toggle(id);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								e.stopPropagation();
								toggle(id);
							}
						}}
						class="text-ash-2 hover:text-safelight-dim"
						aria-label="Hapus">✕</span
					>
				</span>
			{/each}
		{/if}
		<span
			aria-hidden
			class={cn('ml-auto font-mono text-[10px] text-ash-2 transition-transform', open && 'rotate-180')}
			>▾</span
		>
	</button>
	{#if open}
		<div
			class="absolute z-10 w-full mt-1 bg-paper border hairline border-solid rounded-[3px] shadow-[0_8px_24px_rgba(16,15,13,0.12)] max-h-60 overflow-y-auto"
		>
			<div class="p-2 sticky top-0 bg-paper">
				<input
					type="text"
					bind:this={searchEl}
					bind:value={query}
					placeholder="Cari category…"
					class={cn(inputCls, 'py-2 px-3')}
				/>
			</div>
			{#if loading}
				<div class="flex items-center justify-center px-4 py-3">
					<Spinner />
				</div>
			{:else if list.length === 0}
				<p class="px-4 py-3 font-mono text-xs text-ash-2">Tidak ada category cocok</p>
			{:else}
				{#each list as option (option.id)}
					<label class="flex items-center px-4 py-2 hover:bg-ink/[0.04] cursor-pointer">
						<input
							type="checkbox"
							checked={selected.includes(option.id)}
							onchange={() => toggle(option.id)}
							class="mr-2 accent-safelight"
						/>
						<span class="text-sm text-ink">{option.name}</span>
					</label>
				{/each}
			{/if}
		</div>
	{/if}
	{#if message}
		<p class="mt-1.5 text-safelight-dim text-xs font-mono">{message}</p>
	{/if}
</div>
