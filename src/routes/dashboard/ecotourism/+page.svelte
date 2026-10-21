<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, ApiError } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';
	import { ECO_ZONES, siteUrl, zoneLabel, type EcoRow, type EcoZone } from '$lib/eco';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	/** Studio › Ekowisata: daftar destinasi (draf & terbit) untuk halaman situs /ecotourism dan /ecotourism/<slug>. */
	let rows = $state<EcoRow[]>([]);
	let meta = $state<{ page: number; totalPages: number; total: number } | null>(null);
	let fetching = $state(true);
	let search = $state('');
	let zone = $state<EcoZone | ''>('');
	let page = $state(1);
	let busy = $state<string | null>(null);
	let notice = $state('');
	const site = siteUrl();

	async function load() {
		fetching = true;
		try {
			const q = new URLSearchParams({ page: String(page), limit: '20' });
			if (search.trim()) q.set('search', search.trim());
			if (zone) q.set('zone', zone);
			const res = await apiEnvelope<EcoRow[]>(`/ecotourism/admin/list?${q}`);
			rows = res.data ?? [];
			meta = (res.meta as typeof meta) ?? null;
		} catch (err) {
			notice = err instanceof ApiError ? err.message : 'Gagal memuat destinasi';
		} finally {
			fetching = false;
		}
	}

	onMount(() => void load());
	let lastSearch = '';
	$effect(() => {
		if (search !== lastSearch) {
			lastSearch = search;
			page = 1;
		}
	});
	let first = true;
	$effect(() => {
		void page;
		void zone;
		const s = search;
		if (first) {
			first = false;
			return;
		}
		const t = setTimeout(() => void load(), s ? 300 : 0);
		return () => clearTimeout(t);
	});

	async function togglePublish(r: EcoRow) {
		if (!r.published && r.photoCount === 0) {
			notice = `"${r.name}" belum punya foto — tambahkan foto dulu sebelum menerbitkan.`;
			return;
		}
		busy = r.id;
		notice = '';
		try {
			await api(`/ecotourism/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ published: !r.published }) });
			rows = rows.map((x) => (x.id === r.id ? { ...x, published: !r.published } : x));
		} catch (err) {
			notice = err instanceof ApiError ? err.message : 'Gagal mengubah status';
		} finally {
			busy = null;
		}
	}

	async function remove(r: EcoRow) {
		if (!confirm(`Hapus destinasi "${r.name}"? Foto arsipnya tidak ikut terhapus.`)) return;
		busy = r.id;
		notice = '';
		try {
			await api(`/ecotourism/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
			await load();
		} catch (err) {
			notice = err instanceof ApiError ? err.message : 'Gagal menghapus';
		} finally {
			busy = null;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Ekowisata" class="mb-3">
		<a href="/dashboard/ecotourism/create"><Btn variant="primary">+ Tambah destinasi</Btn></a>
	</SectionHeader>
	<p class="mb-8 max-w-2xl text-sm text-ash">
		Destinasi untuk halaman <span class="font-mono text-ink">/ecotourism</span> — tiap destinasi punya halamannya sendiri
		(<span class="font-mono text-ink">/ecotourism/&lt;slug&gt;</span>) dan tampil di zonanya. Foto &amp; video diambil dari arsip.
	</p>

	<div class="mb-5 flex flex-wrap items-center gap-3">
		<div class="w-full max-w-sm"><SearchInput bind:value={search} placeholder="Cari nama, provinsi, kawasan…" /></div>
		<div class="w-56">
			<select class={inputCls} bind:value={zone} onchange={() => (page = 1)} aria-label="Saring zona">
				<option value="">Semua zona</option>
				{#each ECO_ZONES as z (z.value)}<option value={z.value}>{z.label}</option>{/each}
			</select>
		</div>
		{#if meta}<span class="ml-auto font-mono text-[11px] text-ash">{meta.total} destinasi</span>{/if}
	</div>

	{#if notice}<p class="mb-4 text-sm text-safelight-dim" role="alert">{notice}</p>{/if}

	<Panel>
		{#if fetching && !rows.length}
			<div class="space-y-3 p-5">{#each Array.from({ length: 4 }) as _, i (i)}<Skeleton class="h-16" />{/each}</div>
		{:else if !rows.length}
			<EmptyState>{search || zone ? 'Tidak ada destinasi yang cocok' : 'Belum ada destinasi — tambahkan yang pertama'}</EmptyState>
		{:else}
			<ul class="divide-y hairline">
				{#each rows as r (r.id)}
					<li class="flex flex-wrap items-center gap-4 px-5 py-4">
						<div class="relative h-14 w-20 shrink-0 overflow-hidden rounded-[3px] bg-ink/5">
							{#if r.cover?.thumbUrl}<img src={r.cover.thumbUrl} alt="" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />{/if}
						</div>
						<div class="min-w-0 flex-1">
							<a href={`/dashboard/ecotourism/${r.id}/edit`} class="block truncate font-display text-lg text-ink hover:text-safelight">{r.name}</a>
							<p class="truncate text-[12.5px] text-ash">
								{zoneLabel(r.zone)} · {r.region}{r.area ? ` · ${r.area}` : ''} · {r.photoCount} foto
							</p>
						</div>
						<Badge status={r.published ? 'ACTIVE' : 'PENDING'}>{r.published ? 'Terbit' : 'Draf'}</Badge>
						<div class="flex items-center gap-2">
							{#if r.published && site}
								<a href={`${site}/ecotourism/${r.slug}`} target="_blank" rel="noopener" class="font-mono text-[11px] uppercase tracking-[0.14em] text-ash hover:text-ink">Lihat ↗</a>
							{/if}
							<Btn variant="ghost" disabled={busy === r.id} onclick={() => void togglePublish(r)}>{r.published ? 'Jadikan draf' : 'Terbitkan'}</Btn>
							<a href={`/dashboard/ecotourism/${r.id}/edit`}><Btn variant="ghost">Ubah</Btn></a>
							<Btn variant="danger" disabled={busy === r.id} onclick={() => void remove(r)}>Hapus</Btn>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	{#if meta && meta.totalPages > 1}
		<div class="mt-5"><Pagination page={meta.page} totalPages={meta.totalPages} onchange={(p: number) => (page = p)} /></div>
	{/if}
</div>
