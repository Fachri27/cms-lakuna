<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, ApiError } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	/**
	 * Foto penanda peta beranda: tiap lokasi punya satu foto yang tampil di penandanya (dan pertama
	 * dibuka). Bawaan = foto pertama lokasi itu; di sini admin bisa memilih yang lain. Pilihan
	 * disimpan sebagai daftar id foto di pengaturan `map_plate_photos`.
	 */
	interface MapPhoto {
		id: string;
		title: string;
		location?: string | null;
		thumbUrl?: string | null;
	}
	interface Group {
		key: string;
		name: string;
		photos: MapPhoto[];
	}

	const SETTING = 'map_plate_photos';
	const MAX_VALUE = 5000; // batas panjang nilai pengaturan di API

	let fetching = $state(true);
	let saving = $state(false);
	let error = $state('');
	let notice = $state('');
	let search = $state('');
	let groups = $state<Group[]>([]);
	/** id foto terpilih per kunci lokasi; tak ada = bawaan (foto pertama). */
	let chosen = $state<Record<string, string>>({});
	let saved = $state<Record<string, string>>({});
	/** id di pengaturan yang tidak termasuk lokasi mana pun di daftar (dipertahankan saat menyimpan). */
	let strayIds = $state<string[]>([]);

	const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
	const dirty = $derived(JSON.stringify(chosen) !== JSON.stringify(saved));
	const visible = $derived(
		groups.filter((g) => !search.trim() || g.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	async function loadPhotos(): Promise<MapPhoto[]> {
		const all: MapPhoto[] = [];
		for (let page = 1; page <= 20; page++) {
			const q = new URLSearchParams({ type: 'FOTO', limit: '100', page: String(page) });
			const res = await apiEnvelope<MapPhoto[]>(`/photos?${q.toString()}`);
			all.push(...(res.data ?? []));
			if (page >= (res.meta?.totalPages ?? 1)) break;
		}
		return all;
	}

	onMount(async () => {
		try {
			const [photos, setting] = await Promise.all([
				loadPhotos(),
				api<{ value?: string } | null>(`/settings/${SETTING}`).catch(() => null)
			]);
			const byKey = new Map<string, Group>();
			for (const p of photos) {
				const loc = (p.location ?? '').trim();
				if (!loc) continue;
				const key = norm(loc);
				const g = byKey.get(key);
				if (g) g.photos.push(p);
				else byKey.set(key, { key, name: loc, photos: [p] });
			}
			groups = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));

			let ids: string[] = [];
			try {
				const parsed: unknown = JSON.parse(setting?.value ?? '[]');
				if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
			} catch {
				/* pengaturan rusak → anggap kosong */
			}
			const next: Record<string, string> = {};
			const used = new Set<string>();
			for (const id of ids) {
				const g = groups.find((x) => x.photos.some((p) => p.id === id));
				if (g && !next[g.key]) {
					next[g.key] = id;
					used.add(id);
				}
			}
			chosen = next;
			saved = { ...next };
			strayIds = ids.filter((id) => !used.has(id) && !groups.some((g) => g.photos.some((p) => p.id === id)));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal memuat foto';
		} finally {
			fetching = false;
		}
	});

	function pick(g: Group, id: string) {
		notice = '';
		const next = { ...chosen };
		// Klik foto yang sudah terpilih = kembali ke bawaan.
		if (next[g.key] === id) delete next[g.key];
		else next[g.key] = id;
		chosen = next;
	}

	async function save() {
		error = '';
		notice = '';
		const ids = [...strayIds, ...groups.map((g) => chosen[g.key]).filter((x): x is string => !!x)];
		const value = JSON.stringify(ids);
		if (value.length > MAX_VALUE) {
			error = `Terlalu banyak pilihan (${ids.length} foto). Kembalikan beberapa lokasi ke bawaan.`;
			return;
		}
		saving = true;
		try {
			await api(`/settings/${SETTING}`, { method: 'PUT', body: JSON.stringify({ value }) });
			saved = { ...chosen };
			notice = 'Tersimpan. Peta di beranda memakai pilihan ini.';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal menyimpan';
		} finally {
			saving = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="02" kicker="Katalog" title="Foto penanda peta" class="mb-3" />
	<p class="mb-8 max-w-2xl text-sm text-ash">
		Tiap lokasi di peta beranda menampilkan satu foto di penandanya. Secara bawaan foto pertama di
		lokasi itu; klik foto lain untuk menggantinya, klik lagi untuk kembali ke bawaan. Hanya lokasi yang
		dikenali peta yang muncul sebagai titik.
	</p>

	{#if fetching}
		<Panel class="p-7 space-y-4">
			<Skeleton class="h-10" /><Skeleton class="h-24" /><Skeleton class="h-24" />
		</Panel>
	{:else}
		<div class="mb-5 flex flex-wrap items-center gap-3">
			<input
				bind:value={search}
				placeholder="Cari lokasi…"
				aria-label="Cari lokasi"
				class={cn(inputCls, 'max-w-xs')}
			/>
			<span class="font-mono text-[11px] text-ash-2">{visible.length} lokasi</span>
			<div class="ml-auto flex items-center gap-3">
				{#if dirty}<span class="font-mono text-[11px] text-safelight-dim">Belum disimpan</span>{/if}
				<Btn variant="primary" disabled={saving || !dirty} onclick={save}>
					{#if saving}<Spinner />Menyimpan{:else}Simpan{/if}
				</Btn>
			</div>
		</div>
		{#if error}<p class="mb-4 text-safelight-dim text-xs font-mono">{error}</p>{/if}
		{#if notice}<p class="mb-4 text-xs font-mono text-ash">{notice}</p>{/if}

		{#if groups.length === 0}
			<EmptyState>Belum ada foto berlokasi — isi kolom Lokasi saat mengunggah foto</EmptyState>
		{:else}
			<div class="space-y-4">
				{#each visible as g (g.key)}
					{@const current = chosen[g.key] ?? g.photos[0]?.id}
					<Panel class="p-5">
						<div class="mb-3 flex items-baseline justify-between gap-4">
							<h2 class="font-display text-xl">{g.name}</h2>
							<span class="font-mono text-[11px] text-ash-2">
								{g.photos.length} foto{chosen[g.key] ? ' · dipilih manual' : ' · bawaan'}
							</span>
						</div>
						<div class="flex flex-wrap gap-2.5" role="group" aria-label={`Foto penanda ${g.name}`}>
							{#each g.photos as p (p.id)}
								{@const on = current === p.id}
								<button
									type="button"
									onclick={() => pick(g, p.id)}
									aria-pressed={on}
									title={p.title}
									class={cn(
										'relative h-[84px] w-[112px] overflow-hidden rounded-[3px] border bg-ink/[0.05] transition-all',
										on
											? 'border-safelight ring-2 ring-safelight/40'
											: 'border-transparent opacity-70 hover:opacity-100 hover:border-ink/30'
									)}
								>
									{#if p.thumbUrl}
										<img src={p.thumbUrl} alt={p.title} loading="lazy" class="h-full w-full object-cover" />
									{/if}
									{#if on}
										<span
											class="absolute left-1 top-1 rounded-[2px] bg-safelight px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper"
											>Penanda</span
										>
									{/if}
								</button>
							{/each}
						</div>
					</Panel>
				{/each}
			</div>
		{/if}
	{/if}
</div>
