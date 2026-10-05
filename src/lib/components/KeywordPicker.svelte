<script lang="ts">
	import { onMount } from 'svelte';
	import { api, ApiError } from '$lib/api';
	import { cn, labelCls } from '$lib/ui-classes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { recordUsage, topFrequent, recentUsed, syncStatIds } from '$lib/keyword-stats';

	let {
		selected = $bindable<string[]>([]),
		names = $bindable<Record<string, string>>({}),
		invalid = false,
		error = '',
		min = 5,
		lang = 'id',
		label = 'Keyword',
		onChange = () => {}
	}: {
		selected?: string[];
		names?: Record<string, string>;
		invalid?: boolean;
		error?: string;
		min?: number;
		/** Bahasa kata kunci yang dikelola picker ini: daftar, pencarian, pembuatan, dan statistik per bahasa. */
		lang?: 'id' | 'en';
		label?: string;
		onChange?: () => void;
	} = $props();

	interface Keyword {
		id: string;
		name: string;
	}

	let query = $state('');
	let suggestions = $state<Keyword[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let kwError = $state<string | null>(null);
	let open = $state(false);
	let box = $state<HTMLDivElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let statsTick = $state(0);

	let exactMatch = $derived(
		query
			.trim()
			.toLowerCase()
			.length > 0 &&
			(suggestions.some((k) => k.name.toLowerCase() === query.trim().toLowerCase()) ||
				selected.some((id) => (names[id] ?? '').toLowerCase() === query.trim().toLowerCase()))
	);

	let frequent = $derived.by(() => {
		void statsTick;
		const selectedNames = new Set(selected.map((id) => (names[id] ?? '').toLowerCase()));
		return topFrequent(8, lang).filter(
			(s) => !selected.includes(s.id) && !selectedNames.has(s.name.toLowerCase())
		);
	});

	let recent = $derived.by(() => {
		void statsTick;
		const selectedNames = new Set(selected.map((id) => (names[id] ?? '').toLowerCase()));
		const freqNames = new Set(frequent.map((s) => s.name.toLowerCase()));
		return recentUsed(8, lang).filter(
			(s) =>
				!selected.includes(s.id) &&
				!selectedNames.has(s.name.toLowerCase()) &&
				!freqNames.has(s.name.toLowerCase())
		);
	});

	let hint = $derived(
		error || (invalid && min > 0 ? `${label} minimal ${min} (sekarang ${selected.length})` : '')
	);

	onMount(() => {
		void fetchNames();

		function onDocClick(e: MouseEvent) {
			const t = e.target as Node;
			if (box && !box.contains(t)) open = false;
		}
		document.addEventListener('mousedown', onDocClick);
		return () => {
			document.removeEventListener('mousedown', onDocClick);
			if (timer) clearTimeout(timer);
		};
	});

	async function fetchNames() {
		try {
			const all = await api<Keyword[]>(`/keywords?limit=100&lang=${lang}`);
			if (!all) return;
			const next = { ...names };
			const idByName: Record<string, string> = {};
			for (const k of all) {
				next[k.id] = k.name;
				idByName[k.name] = k.id;
				idByName[k.name.toLowerCase()] = k.id;
			}
			names = next;
			syncStatIds(idByName, lang);
			statsTick++;
		} catch {
			/* nama keyword tetap tampil sebagai id */
		}
	}

	function handleKwSearch(value: string) {
		query = value;
		if (timer) clearTimeout(timer);
		timer = null;
		if (!value.trim()) {
			suggestions = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			loading = true;
			try {
				const q = new URLSearchParams({ search: value.trim(), limit: '20', lang });
				const res = await api<Keyword[]>(`/keywords?${q.toString()}`);
				const lower = value.trim().toLowerCase();
				suggestions = (res ?? []).filter(
					(k) => k.name.toLowerCase().includes(lower) && !selected.includes(k.id)
				);
				const next = { ...names };
				for (const k of res ?? []) next[k.id] = k.name;
				names = next;
				open = true;
			} catch {
				suggestions = [];
			} finally {
				loading = false;
			}
		}, 300);
	}

	async function addKeywordById(id: string, name: string) {
		if (selected.includes(id)) return;
		names = { ...names, [id]: name };
		selected = [...selected, id];
		query = '';
		suggestions = [];
		open = false;
		recordUsage(id, name, lang);
		statsTick++;
		onChange();
	}

	async function createByName(rawName: string) {
		const name = rawName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			const created = await api<Keyword>('/keywords', {
				method: 'POST',
				body: JSON.stringify({ name, lang })
			});
			await addKeywordById(created.id, created.name);
			kwError = null;
		} catch (err) {
			kwError = err instanceof ApiError ? err.message : 'Gagal menambahkan keyword';
		} finally {
			creating = false;
		}
	}

	function createKeyword() {
		void createByName(query);
	}

	async function addQuickByName(rawName: string) {
		const name = rawName.trim();
		if (!name) return;
		const lower = name.toLowerCase();
		const knownId = Object.keys(names).find((id) => (names[id] ?? '').toLowerCase() === lower);
		if (knownId) {
			await addKeywordById(knownId, names[knownId]);
			return;
		}
		loading = true;
		try {
			const q = new URLSearchParams({ search: name, limit: '5', lang });
			const res = await api<Keyword[]>(`/keywords?${q.toString()}`);
			const next = { ...names };
			for (const k of res ?? []) next[k.id] = k.name;
			names = next;
			const exact = (res ?? []).find((k) => k.name.toLowerCase() === lower);
			if (exact) {
				await addKeywordById(exact.id, exact.name);
				return;
			}
			await createByName(name);
		} catch (err) {
			kwError = err instanceof ApiError ? err.message : 'Gagal menambahkan keyword';
		} finally {
			loading = false;
		}
	}

	function removeKeyword(id: string) {
		selected = selected.filter((s) => s !== id);
		onChange();
	}
</script>

<div class="relative" bind:this={box}>
	<span class={labelCls}>
		{label}
		<span class="text-ash-2 normal-case tracking-normal"
			>{min > 0 ? `(minimal ${min})` : '(opsional)'}</span
		>
	</span>
	<div
		class={cn(
			'w-full border hairline border-solid rounded-[3px] bg-card-2 px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 items-center cursor-text transition-colors focus-within:border-safelight focus-within:ring-2 focus-within:ring-safelight/15',
			invalid && 'border-safelight-dim focus-within:border-safelight-dim focus-within:ring-safelight-dim/15'
		)}
	>
		{#each [...new Set(selected.filter((id) => !!id))] as id (id)}
			<span class="inline-flex items-center gap-1.5 bg-ink/[0.06] px-2 py-1 rounded-[3px] text-xs">
				{names[id] ?? id}
				<button
					type="button"
					onclick={() => removeKeyword(id)}
					class="text-ash-2 hover:text-safelight-dim"
					aria-label="Hapus">✕</button
				>
			</span>
		{/each}
		<input
			type="text"
			value={query}
			oninput={(e) => handleKwSearch((e.currentTarget as HTMLInputElement).value)}
			onfocus={() => {
				if (suggestions.length > 0) open = true;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') open = false;
			}}
			placeholder={selected.length === 0
				? lang === 'en'
					? 'Search or create an English keyword…'
					: 'Cari atau buat keyword…'
				: ''}
			class="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-ink placeholder:text-ash-2"
		/>
		{#if loading}<Spinner />{/if}
	</div>
	{#if open && (suggestions.length > 0 || (query.trim() && !exactMatch))}
		<div
			class="absolute z-10 w-full mt-1 bg-paper border hairline border-solid rounded-[3px] shadow-[0_8px_24px_rgba(16,15,13,0.12)] max-h-60 overflow-y-auto"
		>
			{#each suggestions as s (s.id)}
				<button
					type="button"
					onclick={() => void addKeywordById(s.id, s.name)}
					class="flex items-center w-full text-left px-4 py-2 hover:bg-ink/[0.04] text-sm gap-2"
				>
					<span aria-hidden="true" class="text-ash-2">⌕</span>
					<span class="text-ink">{s.name}</span>
				</button>
			{/each}
			{#if query.trim() && !exactMatch}
				<button
					type="button"
					onclick={() => void createKeyword()}
					disabled={creating}
					class="flex items-center w-full text-left px-4 py-2 hover:bg-ink/[0.04] text-sm gap-2 border-t hairline border-solid disabled:opacity-40"
				>
					{#if creating}<Spinner /><span class="text-ink">Membuat…</span>
					{:else}<span aria-hidden="true" class="text-safelight">+</span><span class="text-ink"
							>Buat keyword “{query.trim()}”</span
						>{/if}
				</button>
			{/if}
		</div>
	{/if}
	<!-- Saran keyword di BAWAH kolom ketik: bila di atas, kolom ID yang punya riwayat turun
	     sedangkan kolom EN tidak, dan keduanya tak lagi sejajar. -->
	{#if frequent.length > 0}
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2"
				>Sering dipakai</span
			>
			{#each frequent as s (s.name)}
				<button
					type="button"
					onclick={() => void addQuickByName(s.name)}
					class="rounded-full border hairline border-solid px-2.5 py-1 text-xs text-ink hover:border-safelight hover:text-safelight-dim"
				>
					{s.name}
				</button>
			{/each}
		</div>
	{/if}
	{#if recent.length > 0}
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2"
				>Terakhir dipakai</span
			>
			{#each recent as s (s.name)}
				<button
					type="button"
					onclick={() => void addQuickByName(s.name)}
					class="rounded-full border hairline border-solid px-2.5 py-1 text-xs text-ink hover:border-safelight hover:text-safelight-dim"
				>
					{s.name}
				</button>
			{/each}
		</div>
	{/if}
	{#if hint}
		<p class="mt-1.5 text-safelight-dim text-xs font-mono">{hint}</p>
	{/if}
	{#if kwError}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{kwError}</p>{/if}
</div>
