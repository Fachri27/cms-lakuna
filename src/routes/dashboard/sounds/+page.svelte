<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { apiEnvelope, apiFetch, ApiError } from '$lib/api';
	import { cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SoundListRow, { type SoundRowData } from '$lib/components/SoundListRow.svelte';

	/**
	 * Studio › Sounds — daftar musik & efek suara yang tayang (terpisah dari Foto / Video). Audio unggahan
	 * kontributor masuk lewat menu Persetujuan dulu.
	 */
	const LIMIT = 15;
	let sounds = $state<SoundRowData[]>([]);
	let meta = $state({ page: 1, total: 0, totalPages: 1 });
	let loading = $state(true);
	let deleting = $state<string | null>(null);
	let kind = $state<'' | 'MUSIC' | 'SFX'>('');
	let search = $state('');
	let query = $state('');

	// Satu pemutar untuk seluruh halaman.
	let audio: HTMLAudioElement | undefined = $state();
	let current = $state<string | null>(null);
	let playing = $state(false);
	let progress = $state(0);

	async function load(p: number) {
		loading = true;
		try {
			const q = new URLSearchParams({ type: 'AUDIO', page: String(p), limit: String(LIMIT) });
			if (kind) q.set('audioKind', kind);
			if (query) q.set('search', query);
			const res = await apiEnvelope<SoundRowData[]>(`/photos?${q}`);
			sounds = res.data ?? [];
			meta = { page: res.meta?.page ?? p, total: res.meta?.total ?? sounds.length, totalPages: res.meta?.totalPages ?? 1 };
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load(Number(page.url.searchParams.get('page') ?? '1') || 1);
		return () => audio?.pause();
	});

	// Pencarian: jeda 350 ms setelah berhenti mengetik.
	$effect(() => {
		const v = search.trim();
		const t = setTimeout(() => {
			if (v !== query) {
				query = v;
				void load(1);
			}
		}, 350);
		return () => clearTimeout(t);
	});

	function pickKind(k: typeof kind) {
		kind = k;
		void load(1);
	}

	function goToPage(p: number) {
		if (p < 1 || p > meta.totalPages || p === meta.page) return;
		const url = new URL(page.url);
		url.searchParams.set('page', String(p));
		void goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
		void load(p);
	}

	function toggle(s: SoundRowData) {
		if (!audio || !s.watermarkUrl) return;
		if (current === s.id) {
			if (audio.paused) void audio.play();
			else audio.pause();
			return;
		}
		current = s.id;
		progress = 0;
		audio.src = s.watermarkUrl;
		void audio.play().catch(() => {});
	}

	async function handleDelete(s: SoundRowData) {
		if (!confirm(`Hapus audio "${s.title}"? Audio tak lagi tampil di situs.`)) return;
		deleting = s.id;
		try {
			const res = await apiFetch(`/photos/${s.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
				alert(j?.error?.message ?? `Gagal menghapus (${res.status})`);
				return;
			}
			if (current === s.id) audio?.pause();
			sounds = sounds.filter((x) => x.id !== s.id);
			meta.total = Math.max(0, meta.total - 1);
		} catch (err) {
			alert(err instanceof ApiError ? err.message : 'Gagal menghapus audio');
		} finally {
			deleting = null;
		}
	}
</script>

<audio
	bind:this={audio}
	preload="none"
	class="hidden"
	onplay={() => (playing = true)}
	onpause={() => (playing = false)}
	onended={() => ((playing = false), (progress = 0))}
	ontimeupdate={(e) => {
		const a = e.currentTarget;
		progress = a.duration > 0 ? a.currentTime / a.duration : 0;
	}}
></audio>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Sounds" class="mb-3">
		<a href="/dashboard/sounds/create"><Btn variant="primary">+ Upload audio</Btn></a>
	</SectionHeader>
	<p class="mb-8 max-w-2xl text-sm text-ash">
		Musik &amp; efek suara untuk halaman <span class="font-mono text-ink">/sounds</span> — terpisah dari Foto / Video. Pratinjau
		yang diputar di sini sama dengan di situs (MP3 bertanda suara). Audio dari kontributor tampil setelah disetujui di
		<a href="/dashboard/approval" class="underline underline-offset-2 hover:text-safelight">Persetujuan</a>.
	</p>

	<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex gap-2" role="radiogroup" aria-label="Jenis audio">
			{#each [['', 'Semua'], ['MUSIC', 'Musik'], ['SFX', 'Efek suara']] as const as [k, label] (k)}
				<button
					type="button"
					role="radio"
					aria-checked={kind === k}
					onclick={() => pickKind(k)}
					class={cn(
						'rounded-[3px] px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors',
						kind === k ? 'bg-ink text-paper' : 'border hairline border-solid text-ash hover:text-ink'
					)}
				>
					{label}
				</button>
			{/each}
		</div>
		<SearchInput bind:value={search} placeholder="Cari judul, kreator, keyword…" class="sm:w-80" />
	</div>

	{#if loading && sounds.length === 0}
		<div class="space-y-3">
			{#each Array.from({ length: 5 }) as _, i (i)}
				<Skeleton class="h-20" />
			{/each}
		</div>
	{:else if sounds.length === 0}
		<Panel>
			<EmptyState class="py-24">{query || kind ? 'Tidak ada audio yang cocok' : 'Belum ada audio — unggah musik atau efek suara pertama'}</EmptyState>
		</Panel>
	{:else}
		<p class="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash-2 tnum">{meta.total} audio tayang</p>
		<div class={cn('space-y-2 transition-opacity', loading && 'opacity-60')}>
			{#each sounds as s (s.id)}
				<SoundListRow sound={s} playing={current === s.id && playing} progress={current === s.id ? progress : 0} onToggle={() => toggle(s)}>
					{#snippet actions()}
						<a href={`/dashboard/sounds/${s.id}/edit`}><Btn variant="ghost">Edit</Btn></a>
						<Btn variant="danger" onclick={() => void handleDelete(s)} disabled={deleting === s.id}>{deleting === s.id ? '…' : 'Hapus'}</Btn>
					{/snippet}
				</SoundListRow>
			{/each}
		</div>
		<Pagination page={meta.page} totalPages={meta.totalPages} onchange={goToPage} />
	{/if}
</div>
