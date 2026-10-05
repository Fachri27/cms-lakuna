<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, ApiError } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Btn from '$lib/components/Btn.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	/**
	 * Foto yang tampil di titik peta beranda. Per lokasi admin memilih beberapa foto (mis. 5 dari
	 * 100); hanya foto itu yang tampil di titiknya, berurutan, dan nomor 1 jadi penanda. Lokasi yang
	 * belum dipilih tetap menampilkan semua fotonya. Disimpan sebagai daftar id foto berurutan di
	 * pengaturan `map_plate_photos`.
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
	const MAX_VALUE = 60000; // batas panjang nilai pengaturan di API
	const FILTER_FROM = 12; // pencarian judul muncul bila foto di satu lokasi lebih banyak dari ini

	let fetching = $state(true);
	let saving = $state(false);
	let error = $state('');
	let notice = $state('');
	let search = $state('');
	let groups = $state<Group[]>([]);
	/** id foto terpilih per kunci lokasi, berurutan; tak ada = belum memilih (semua foto tampil). */
	let chosen = $state<Record<string, string[]>>({});
	let saved = $state<Record<string, string[]>>({});
	/** Pencarian judul per lokasi (hanya lokasi berfoto banyak). */
	let groupFilter = $state<Record<string, string>>({});
	/** id di pengaturan yang tidak termasuk lokasi mana pun di daftar (dipertahankan saat menyimpan). */
	let strayIds = $state<string[]>([]);

	const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
	const dirty = $derived(JSON.stringify(chosen) !== JSON.stringify(saved));
	const visible = $derived(
		groups.filter((g) => !search.trim() || g.name.toLowerCase().includes(search.trim().toLowerCase()))
	);
	const totalChosen = $derived(Object.values(chosen).reduce((n, l) => n + l.length, 0));

	async function loadPhotos(): Promise<MapPhoto[]> {
		const all: MapPhoto[] = [];
		for (let page = 1; page <= 50; page++) {
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
			const next: Record<string, string[]> = {};
			const inGroup = new Set<string>();
			for (const g of groups) {
				const mine = new Set(g.photos.map((p) => p.id));
				const list = ids.filter((id) => mine.has(id));
				if (list.length) next[g.key] = list;
				for (const id of mine) inGroup.add(id);
			}
			chosen = next;
			saved = JSON.parse(JSON.stringify(next));
			strayIds = ids.filter((id) => !inGroup.has(id));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal memuat foto';
		} finally {
			fetching = false;
		}
	});

	function setList(g: Group, list: string[]) {
		notice = '';
		const next = { ...chosen };
		if (list.length) next[g.key] = list;
		else delete next[g.key];
		chosen = next;
	}

	/** Pilih / batalkan satu foto; yang baru dipilih masuk di urutan terakhir. */
	function toggle(g: Group, id: string) {
		const cur = chosen[g.key] ?? [];
		setList(g, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
	}

	/** Jadikan foto ini nomor 1 (penanda). */
	function makeFirst(g: Group, id: string) {
		const cur = chosen[g.key] ?? [];
		setList(g, [id, ...cur.filter((x) => x !== id)]);
	}

	async function save() {
		error = '';
		notice = '';
		const ids = [...strayIds, ...groups.flatMap((g) => chosen[g.key] ?? [])];
		const value = JSON.stringify(ids);
		if (value.length > MAX_VALUE) {
			error = `Terlalu banyak pilihan (${ids.length} foto). Kurangi pilihan di beberapa lokasi.`;
			return;
		}
		saving = true;
		try {
			await api(`/settings/${SETTING}`, { method: 'PUT', body: JSON.stringify({ value }) });
			saved = JSON.parse(JSON.stringify(chosen));
			notice = 'Tersimpan. Peta di beranda memakai pilihan ini.';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal menyimpan';
		} finally {
			saving = false;
		}
	}

	function shown(g: Group): MapPhoto[] {
		const f = (groupFilter[g.key] ?? '').trim().toLowerCase();
		return f ? g.photos.filter((p) => p.title.toLowerCase().includes(f)) : g.photos;
	}
</script>

<!-- Bagian halaman Beranda (dashboard/homepage): foto yang tampil di tiap titik peta Nusantara. -->
<div class="border hairline border-solid rounded-[3px] bg-card-2 p-6">
	<div class="flex items-baseline justify-between gap-4">
		<div>
			<Kicker tone="safelight">04 · Foto di peta</Kicker>
			<p class="mt-1 text-xs text-ash">
				Pilih foto yang tampil di titik tiap lokasi pada peta Nusantara. Klik foto untuk memilih atau
				membatalkan; nomor menunjukkan urutan dan <strong>nomor 1 jadi penanda</strong> di peta. Lokasi
				yang belum dipilih menampilkan semua fotonya. Hanya lokasi yang dikenali peta yang muncul sebagai
				titik.
			</p>
			<p class="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
				Tampil di landing: Peta Nusantara (titik &amp; galerinya)
			</p>
		</div>
	</div>

	{#if fetching}
		<div class="mt-6 flex items-center gap-2 text-ash"><Spinner /> <span class="text-xs">Memuat…</span></div>
	{:else}
		<div class="mt-6 mb-5 flex flex-wrap items-center gap-3">
			<input
				bind:value={search}
				placeholder="Cari lokasi…"
				aria-label="Cari lokasi"
				class={cn(inputCls, 'max-w-xs')}
			/>
			<span class="font-mono text-[11px] text-ash-2">{visible.length} lokasi · {totalChosen} foto dipilih</span>
			<div class="ml-auto flex items-center gap-3">
				{#if dirty}<span class="font-mono text-[11px] text-safelight-dim">Belum disimpan</span>{/if}
				<Btn type="button" variant="primary" disabled={saving || !dirty} onclick={save}>
					{#if saving}<Spinner />Menyimpan{:else}Simpan{/if}
				</Btn>
			</div>
		</div>
		{#if error}<p class="mb-4 text-safelight-dim text-xs font-mono">{error}</p>{/if}
		{#if notice}<p class="mb-4 text-xs font-mono text-ash">{notice}</p>{/if}

		{#if groups.length === 0}
			<p class="rounded-[3px] border border-dashed border-ink/15 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
				Belum ada foto berlokasi — isi kolom Lokasi saat mengunggah foto
			</p>
		{:else}
			<div class="space-y-3">
				{#each visible as g (g.key)}
					{@const sel = chosen[g.key] ?? []}
					<div class="rounded-[3px] border hairline border-solid bg-paper p-4">
						<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
							<h3 class="font-display text-lg">{g.name}</h3>
							<div class="flex items-center gap-3">
								<span class="font-mono text-[11px] text-ash-2">
									{sel.length
										? `${sel.length} dipilih dari ${g.photos.length}`
										: `belum memilih · semua ${g.photos.length} foto tampil`}
								</span>
								{#if sel.length}
									<button
										type="button"
										onclick={() => setList(g, [])}
										class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2 hover:text-safelight-dim"
									>
										Kosongkan
									</button>
								{/if}
							</div>
						</div>
						{#if g.photos.length > FILTER_FROM}
							<input
								bind:value={groupFilter[g.key]}
								placeholder={`Cari judul di ${g.name}…`}
								aria-label={`Cari judul foto di ${g.name}`}
								class={cn(inputCls, 'mb-3 max-w-xs py-1.5 text-xs')}
							/>
						{/if}
						<div
							class={cn('flex flex-wrap gap-2.5', g.photos.length > FILTER_FROM && 'max-h-[360px] overflow-y-auto pr-1')}
							role="group"
							aria-label={`Foto di titik ${g.name}`}
						>
							{#each shown(g) as p (p.id)}
								{@const idx = sel.indexOf(p.id)}
								{@const on = idx >= 0}
								<div class="relative h-[78px] w-[104px] shrink-0">
									<button
										type="button"
										onclick={() => toggle(g, p.id)}
										aria-pressed={on}
										title={p.title}
										class={cn(
											'absolute inset-0 overflow-hidden rounded-[3px] border bg-ink/[0.05] transition-all',
											on
												? 'border-safelight ring-2 ring-safelight/40'
												: sel.length
													? 'border-transparent opacity-50 hover:opacity-100 hover:border-ink/30'
													: 'border-transparent hover:border-ink/30'
										)}
									>
										{#if p.thumbUrl}
											<img src={p.thumbUrl} alt={p.title} loading="lazy" class="h-full w-full object-cover" />
										{/if}
										{#if on}
											<span
												class="absolute left-1 top-1 rounded-[2px] bg-safelight px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-paper"
												>{idx === 0 ? '1 · Penanda' : idx + 1}</span
											>
										{/if}
									</button>
									{#if on && idx > 0}
										<button
											type="button"
											onclick={() => makeFirst(g, p.id)}
											aria-label={`Jadikan penanda: ${p.title}`}
											title="Jadikan penanda (nomor 1)"
											class="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-paper/90 text-[11px] leading-none text-ink shadow hover:bg-safelight hover:text-paper"
											>★</button
										>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
