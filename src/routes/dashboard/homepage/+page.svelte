<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, apiFetch } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface TextSectionDef {
		key: string;
		label: string;
		hint: string;
		/** Field yang tampil di form. Default: semua (gambar, kicker, judul, teks, tombol). */
		fields?: ('image' | 'kicker' | 'title' | 'body' | 'cta')[];
		/** Field yang benar-benar tampil di landing — sisanya diabaikan frontend. */
		uses: string;
	}

	interface PhotoSectionDef {
		key: string;
		label: string;
		hint: string;
		suggested: number;
		max: number | null;
		/** Filter tipe aset di picker. Default FOTO (galeri foto). */
		assetType: 'FOTO' | 'VIDEO';
	}

	interface TextSectionData {
		key: string;
		imageKey: string | null;
		imageUrl: string | null;
		kicker: string | null;
		title: string | null;
		body: string | null;
		cta: string | null;
		updatedAt: string | null;
	}

	interface PhotoItem {
		id: string;
		title: string | null;
		photographer?: string | null;
		thumbUrl?: string | null;
	}

	interface PhotoSectionData {
		key: string;
		photoIds: string[] | null;
		photos: PhotoItem[] | null;
		updatedAt: string | null;
	}

	interface TextState {
		loading: boolean;
		saving: boolean;
		msg: string;
		ok: boolean;
		kicker: string;
		title: string;
		body: string;
		cta: string;
		preview: string | null;
		imageKey: string | null;
		updatedAt: string | null;
		image: File | null;
	}

	interface PhotoState {
		loading: boolean;
		saving: boolean;
		msg: string;
		ok: boolean;
		selected: string[];
		photoMap: Record<string, PhotoItem>;
		updatedAt: string | null;
		list: PhotoItem[];
		search: string;
		page: number;
		totalPages: number;
		listLoading: boolean;
	}

	// Urutan = urutan section di landing (atas → bawah). Label berangka supaya
	// jelas posisi tiap bagian; `uses` menandai field yang tampil — field lain
	// tersimpan tapi diabaikan frontend (fallback default dipakai bila kosong).
	const TEXT_SECTIONS: TextSectionDef[] = [
		{ key: 'hero', label: '01 · Hero', hint: 'Bagian paling atas halaman beranda.', fields: ['image', 'kicker', 'title', 'body', 'cta'], uses: 'kicker, judul (satu baris, menggantikan 2 baris bawaan), teks, tombol, gambar atau video latar (MP4/WebM autoplay bisu)' },
		{ key: 'arsip', label: '02 · Strip arsip (judul)', hint: 'Judul strip foto berjalan di bawah hero. Fotonya di bawah (02 · Foto strip arsip).', fields: ['kicker', 'title'], uses: 'kicker, judul' },
		{ key: 'video', label: '03 · Contact sheet (judul)', hint: 'Judul grid video drone. Videonya di bawah (03 · Video contact sheet).', fields: ['kicker', 'title', 'body'], uses: 'kicker, judul, teks' },
		{ key: 'anjungan_1', label: '04 · Peta Nusantara', hint: 'Judul adegan peta (globe → mendarat).', fields: ['kicker', 'title', 'body'], uses: 'kicker, judul, teks' },
		{ key: 'harga', label: '06 · Teaser harga', hint: 'Judul, deskripsi, tombol, dan foto latar papan tarif langganan.', fields: ['image', 'kicker', 'title', 'body', 'cta'], uses: 'kicker, judul, teks, tombol, gambar' },
		{ key: 'banding', label: '07 · Perbandingan pratinjau', hint: 'Judul + teks panel "pratinjau vs unduhan". Fotonya otomatis dari arsip.', fields: ['title', 'body'], uses: 'judul, teks' },
		{ key: 'percaya', label: '08 · Dipercaya (label)', hint: 'Label kecil di atas dinding logo. Logonya di bawah (08 · Logo pelanggan).', fields: ['kicker'], uses: 'kicker' },
		{ key: 'mulai', label: '09 · Penutup', hint: 'Ajakan mulai sebelum footer.', fields: ['image', 'kicker', 'title', 'body', 'cta'], uses: 'kicker, judul, teks, tombol, gambar' },
		{ key: 'manifesto', label: '10 · Manifesto (cadangan)', hint: 'Hanya sebagai foto cadangan latar papan tarif bila section Harga tidak pasang gambar.', fields: ['image'], uses: 'gambar' },
		{ key: 'etalase', label: '11 · Etalase ekowisata (teks)', hint: 'Teks showcase di atas footer: skrip + judul + tombol. Judul boleh multi-baris (enter = baris baru). Kosong = teks bawaan.', fields: ['kicker', 'title', 'cta'], uses: 'kicker (skrip), judul (multi-baris), tombol' }
	];

	const PHOTO_SECTIONS: PhotoSectionDef[] = [
		{
			key: 'journeys',
			label: '02 · Foto strip arsip',
			hint: 'Kurasi foto untuk strip berjalan. Kosong = foto terbaru otomatis.',
			suggested: 12,
			max: null,
			assetType: 'FOTO'
		},
		{
			key: 'klip',
			label: '03 · Video contact sheet',
			hint: 'Hanya video terpilih yang tampil di contact sheet beranda (6 per halaman). Kosong = video terbaru otomatis.',
			suggested: 6,
			max: 12,
			assetType: 'VIDEO'
		},
		{
			key: 'orbit',
			label: '05 · Foto galeri orbit',
			hint: 'Galeri orbit 3D di beranda. Maks 8 foto — pilih yang terbaik. Kosong = foto terbaru otomatis.',
			suggested: 8,
			max: 8,
			assetType: 'FOTO'
		},
		{
			key: 'percaya',
			label: '08 · Logo pelanggan',
			hint: 'Tiap foto terpilih tampil sebagai satu logo di dinding "Dipercaya". Pakai gambar logo (PNG kontras, bukan foto arsip). Urutan = urutan tampil.',
			suggested: 5,
			max: 7,
			assetType: 'FOTO'
		},
		{
			key: 'etalase',
			label: '11 · Foto etalase ekowisata',
			hint: 'Foto showcase ekowisata di atas footer (maks 4). Urutan = urutan tampil. Kosong = unggulan + terbaru otomatis.',
			suggested: 4,
			max: 4,
			assetType: 'FOTO'
		}
	];

	function freshText(): TextState {
		return {
			loading: true,
			saving: false,
			msg: '',
			ok: true,
			kicker: '',
			title: '',
			body: '',
			cta: '',
			preview: null,
			imageKey: null,
			updatedAt: null,
			image: null
		};
	}

	function freshPhoto(): PhotoState {
		return {
			loading: true,
			saving: false,
			msg: '',
			ok: true,
			selected: [],
			photoMap: {},
			updatedAt: null,
			list: [],
			search: '',
			page: 1,
			totalPages: 1,
			listLoading: false
		};
	}

	let textStates = $state<Record<string, TextState>>(
		Object.fromEntries(TEXT_SECTIONS.map((s) => [s.key, freshText()]))
	);
	let photoStates = $state<Record<string, PhotoState>>(
		Object.fromEntries(PHOTO_SECTIONS.map((s) => [s.key, freshPhoto()]))
	);
	let searchTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	// ── Text + image sections ──────────────────────────────────────────
	async function loadText(key: string) {
		const st = textStates[key];
		try {
			const d = await api<TextSectionData>(`/homepage/${key}`);
			st.kicker = d.kicker ?? '';
			st.title = d.title ?? '';
			st.body = d.body ?? '';
			st.cta = d.cta ?? '';
			st.preview = d.imageUrl ?? null;
			st.imageKey = d.imageKey ?? null;
			st.updatedAt = d.updatedAt ?? null;
		} catch {
			/* section belum ada — biarkan kosong */
		} finally {
			st.loading = false;
		}
	}

	function pickImage(key: string, e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		const st = textStates[key];
		st.image = f;
		st.preview = URL.createObjectURL(f);
	}

	async function saveText(key: string, e: SubmitEvent) {
		e.preventDefault();
		const st = textStates[key];
		st.saving = true;
		st.msg = '';
		try {
			const fd = new FormData();
			fd.append('kicker', st.kicker.trim());
			fd.append('title', st.title.trim());
			fd.append('body', st.body.trim());
			fd.append('cta', st.cta.trim());
			if (st.image) fd.append('image', st.image);
			const res = await apiFetch(`/homepage/${key}`, { method: 'PUT', body: fd });
			const json = await res.json().catch(() => null);
			if (!res.ok) throw new Error(json?.error?.message || 'Gagal menyimpan');
			const d = json?.data as TextSectionData | undefined;
			if (d) {
				st.preview = d.imageUrl ?? null;
				st.imageKey = d.imageKey ?? null;
				st.updatedAt = d.updatedAt ?? null;
			}
			st.image = null;
			st.ok = true;
			st.msg = 'Tersimpan';
		} catch (err) {
			st.ok = false;
			st.msg = (err as Error)?.message || 'Gagal menyimpan';
		} finally {
			st.saving = false;
		}
	}

	// ── Photo curation sections ────────────────────────────────────────
	async function loadPhotoSection(key: string) {
		const st = photoStates[key];
		try {
			const d = await api<PhotoSectionData>(`/homepage/${key}`);
			st.updatedAt = d.updatedAt ?? null;
			st.selected = d.photoIds ?? [];
			if (d.photos?.length) {
				for (const p of d.photos) st.photoMap[p.id] = p;
			}
		} catch {
			/* section belum ada — biarkan kosong */
		} finally {
			st.loading = false;
		}
	}

	async function fetchPool(key: string, append: boolean) {
		const st = photoStates[key];
		const def = PHOTO_SECTIONS.find((d) => d.key === key);
		const q = st.search.trim();
		const p = append ? st.page + 1 : 1;
		st.listLoading = true;
		try {
			const path = `/photos?limit=24&page=${p}&type=${def?.assetType ?? 'FOTO'}${q ? `&search=${encodeURIComponent(q)}` : ''}`;
			const res = await apiEnvelope<PhotoItem[]>(path);
			const data = res.data ?? [];
			st.list = append ? [...st.list, ...data] : data;
			st.page = p;
			st.totalPages = res.meta?.totalPages ?? 1;
			for (const ph of data) st.photoMap[ph.id] = ph;
		} catch {
			if (!append) st.list = [];
		} finally {
			st.listLoading = false;
		}
	}

	function onPoolSearch(key: string) {
		clearTimeout(searchTimers[key]);
		searchTimers[key] = setTimeout(() => void fetchPool(key, false), 300);
	}

	function togglePhoto(key: string, def: PhotoSectionDef, id: string) {
		const st = photoStates[key];
		if (st.selected.includes(id)) {
			st.selected = st.selected.filter((x) => x !== id);
			return;
		}
		if (def.max != null && st.selected.length >= def.max) {
			st.ok = false;
			st.msg = `Maksimal ${def.max} foto`;
			return;
		}
		st.selected = [...st.selected, id];
	}

	function movePhoto(key: string, id: string, dir: -1 | 1) {
		const st = photoStates[key];
		const i = st.selected.indexOf(id);
		if (i < 0) return;
		const j = i + dir;
		if (j < 0 || j >= st.selected.length) return;
		const next = [...st.selected];
		[next[i], next[j]] = [next[j], next[i]];
		st.selected = next;
	}

	async function savePhotos(key: string, e: SubmitEvent) {
		e.preventDefault();
		const st = photoStates[key];
		st.saving = true;
		st.msg = '';
		try {
			const fd = new FormData();
			fd.append('photoIds', JSON.stringify(st.selected));
			const res = await apiFetch(`/homepage/${key}`, { method: 'PUT', body: fd });
			const json = await res.json().catch(() => null);
			if (!res.ok) throw new Error(json?.error?.message || 'Gagal menyimpan');
			const d = json?.data as PhotoSectionData | undefined;
			if (d) {
				st.updatedAt = d.updatedAt ?? null;
				st.selected = d.photoIds ?? [];
			}
			st.ok = true;
			st.msg = 'Tersimpan';
		} catch (err) {
			st.ok = false;
			st.msg = (err as Error)?.message || 'Gagal menyimpan';
		} finally {
			st.saving = false;
		}
	}

	onMount(() => {
		for (const s of TEXT_SECTIONS) void loadText(s.key);
		for (const s of PHOTO_SECTIONS) {
			void loadPhotoSection(s.key);
			void fetchPool(s.key, false);
		}
	});
</script>

<div class="rise">
	<SectionHeader index="09" kicker="Konten" title="Beranda" class="mb-8" />

	<p class="mb-8 max-w-xl text-sm text-ash">
		Atur gambar dan teks untuk bagian utama halaman beranda publik. Setiap bagian disimpan
		terpisah — upload gambar baru atau ubah teks lalu tekan Simpan pada bagian yang bersangkutan.
	</p>

	<div class="space-y-6">
		{#each TEXT_SECTIONS as s (s.key)}
			{@const st = textStates[s.key]}
			<div class="border hairline border-solid rounded-[3px] bg-card-2 p-6">
				<div class="flex items-baseline justify-between gap-4">
					<div>
						<Kicker tone="safelight">{s.label}</Kicker>
						<p class="mt-1 text-xs text-ash">{s.hint}</p>
						<p class="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
							Tampil di landing: {s.uses}
						</p>
					</div>
					{#if st.updatedAt}
						<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
							{new Date(st.updatedAt).toLocaleString()}
						</span>
					{/if}
				</div>

				{#if st.loading}
					<div class="mt-6 flex items-center gap-2 text-ash">
						<Spinner /> <span class="text-xs">Memuat…</span>
					</div>
				{:else}
					{@const fields = s.fields ?? ['image', 'kicker', 'title', 'body', 'cta']}
					<form onsubmit={(e) => saveText(s.key, e)} class="mt-6 grid gap-6 md:grid-cols-[200px_1fr]">
						{#if fields.includes('image')}
						<div>
							<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2 block">{s.key === 'hero' ? 'Gambar / Video' : 'Gambar'}</span>
							<button
								type="button"
								onclick={() => document.getElementById(`img-${s.key}`)?.click()}
								class="block w-full overflow-hidden rounded-[3px] border border-dashed border-ink/20 transition-colors hover:border-ink/40"
								style="aspect-ratio: 4 / 3"
							>
								{#if st.preview}
									{#if st.preview.startsWith('blob:') ? (st.image?.type.startsWith('video/') ?? false) : /\.mp4($|\?)/i.test(st.imageKey ?? '')}
										<video src={st.preview} class="h-full w-full object-cover" muted loop playsinline autoplay={false} preload="metadata"></video>
									{:else}
										<img src={st.preview} alt={s.label} class="h-full w-full object-cover" />
									{/if}
								{:else}
									<span class="grid h-full place-items-center font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
										Klik untuk upload
									</span>
								{/if}
							</button>
							<input
								id={`img-${s.key}`}
								type="file"
								accept={s.key === 'hero' ? 'image/*,video/mp4,video/webm' : 'image/*'}
								class="hidden"
								onchange={(e) => pickImage(s.key, e)}
							/>
							{#if s.key === 'hero'}<p class="mt-2 text-[11px] leading-relaxed text-ash-2">MP4/WebM autoplay bisu sebagai latar. File besar otomatis dikompresi. Video hanya untuk hero.</p>{/if}
							{#if st.imageKey && !st.image}<p class="mt-2 break-all font-mono text-[10px] text-ash-2">{st.imageKey}</p>{/if}
						</div>
						{:else}
						<div class="hidden md:block" aria-hidden="true"></div>
						{/if}

						<div class="space-y-4">
							<div class="grid gap-5 md:grid-cols-2">
							{#if fields.includes('kicker')}
							<Field label="Kicker">
								<input
									type="text"
									value={st.kicker}
									oninput={(e) => (st.kicker = (e.currentTarget as HTMLInputElement).value)}
									class={inputCls}
									placeholder="Label kecil di atas judul"
								/>
								<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
							</Field>
							{/if}
							{#if fields.includes('title')}
							<Field label="Judul">
								<input
									type="text"
									value={st.title}
									oninput={(e) => (st.title = (e.currentTarget as HTMLInputElement).value)}
									class={inputCls}
									placeholder="Judul utama"
								/>
								<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
							</Field>
							{/if}
							</div>
							{#if fields.includes('body')}
							<Field label="Teks">
								<textarea
									value={st.body}
									oninput={(e) => (st.body = (e.currentTarget as HTMLTextAreaElement).value)}
									rows={4}
									class={cn(inputCls, 'resize-none')}
									placeholder="Deskripsi / paragraf…"
								></textarea>
								<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
							</Field>
							{/if}
							{#if fields.includes('cta')}
								<Field label="Label tombol (CTA)">
									<input
										type="text"
										value={st.cta}
										oninput={(e) => (st.cta = (e.currentTarget as HTMLInputElement).value)}
										class={inputCls}
										placeholder="Mis. Jelajahi koleksi"
									/>
									<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
								</Field>
							{/if}
							<div class="flex items-center gap-3 pt-1">
								<Btn type="submit" variant="dark" disabled={st.saving}>
									{#if st.saving}<Spinner />Menyimpan{:else}Simpan{/if}
								</Btn>
								{#if st.msg}
									<span class={cn('font-mono text-xs', st.ok ? 'text-emerald-600' : 'text-safelight-dim')}>
										{st.msg}
									</span>
								{/if}
							</div>
						</div>
					</form>
				{/if}
			</div>
		{/each}

		{#each PHOTO_SECTIONS as s (s.key)}
			{@const st = photoStates[s.key]}
			{@const selectedPhotos = st.selected.map((id) => st.photoMap[id]).filter(Boolean)}
			<div class="border hairline border-solid rounded-[3px] bg-card-2 p-6">
				<div class="flex items-baseline justify-between gap-4">
					<div>
						<Kicker tone="safelight">{s.label}</Kicker>
						<p class="mt-1 text-xs text-ash">{s.hint}</p>
					</div>
					{#if st.updatedAt}
						<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
							{new Date(st.updatedAt).toLocaleString()}
						</span>
					{/if}
				</div>

				{#if st.loading}
					<div class="mt-6 flex items-center gap-2 text-ash">
						<Spinner /> <span class="text-xs">Memuat…</span>
					</div>
				{:else}
					<form onsubmit={(e) => savePhotos(s.key, e)} class="mt-6 space-y-6">
						<div>
							<div class="mb-2 flex items-center justify-between">
								<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
									Terpilih · {st.selected.length} (disarankan {s.suggested})
								</span>
								{#if st.selected.length > 0}
									<button
										type="button"
										onclick={() => (st.selected = [])}
										class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2 hover:text-safelight-dim"
									>
										Kosongkan
									</button>
								{/if}
							</div>

							{#if selectedPhotos.length === 0}
								<p class="rounded-[3px] border border-dashed border-ink/15 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
									Belum ada foto dipilih — pilih dari daftar di bawah
								</p>
							{:else}
								<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
									{#each selectedPhotos as p, i (p.id)}
										<li class="group relative overflow-hidden rounded-[3px] border border-ink/15 bg-card">
											<img src={p.thumbUrl || ''} alt={p.title || ''} class="aspect-[4/3] w-full object-cover" />
											<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
												<p class="truncate text-[11px] text-white/90">{p.title || 'Tanpa judul'}</p>
											</div>
											<span class="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-safelight font-mono text-[10px] text-white">
												{i + 1}
											</span>
											<div class="absolute right-1.5 top-1.5 flex gap-1">
												<button
													type="button"
													onclick={() => movePhoto(s.key, p.id, -1)}
													disabled={i === 0}
													class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 disabled:opacity-30"
													title="Naik"
												>↑</button>
												<button
													type="button"
													onclick={() => movePhoto(s.key, p.id, 1)}
													disabled={i === st.selected.length - 1}
													class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 disabled:opacity-30"
													title="Turun"
												>↓</button>
												<button
													type="button"
													onclick={() => togglePhoto(s.key, s, p.id)}
													class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 hover:bg-safelight"
													title="Hapus"
												>✕</button>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</div>

						<div>
							<span class="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Pilih foto</span>
							<input
								type="text"
								value={st.search}
								oninput={(e) => {
									st.search = (e.currentTarget as HTMLInputElement).value;
									onPoolSearch(s.key);
								}}
								class={inputCls}
								placeholder="Cari judul / fotografer / kategori…"
							/>
						</div>

						{#if st.listLoading && st.list.length === 0}
							<div class="flex items-center gap-2 text-ash">
								<Spinner /> <span class="text-xs">Memuat foto…</span>
							</div>
						{:else if st.list.length === 0}
							<p class="rounded-[3px] border border-dashed border-ink/15 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
								Tidak ada foto
							</p>
						{:else}
							<ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
								{#each st.list as p (p.id)}
									{@const on = st.selected.includes(p.id)}
									<li>
										<button
											type="button"
											onclick={() => togglePhoto(s.key, s, p.id)}
											class={cn(
												'relative block w-full overflow-hidden rounded-[3px] border transition-colors',
												on ? 'border-safelight' : 'border-ink/15 hover:border-ink/40'
											)}
										>
											<img src={p.thumbUrl || ''} alt={p.title || ''} class="aspect-[4/3] w-full object-cover" />
											<span
												class={cn(
													'absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] transition-colors',
													on ? 'bg-safelight text-white' : 'bg-black/45 text-white/80'
												)}
											>
												{on ? '✓' : '+'}
											</span>
											<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
												<p class="truncate text-[10px] text-white/85">{p.title || 'Tanpa judul'}</p>
											</div>
										</button>
									</li>
								{/each}
							</ul>
						{/if}

						{#if st.page < st.totalPages}
							<button
								type="button"
								onclick={() => fetchPool(s.key, true)}
								disabled={st.listLoading}
								class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash hover:text-ink disabled:opacity-40"
							>
								{st.listLoading ? 'Memuat…' : 'Muat lebih banyak →'}
							</button>
						{/if}

						<div class="flex items-center gap-3 pt-1">
							<Btn type="submit" variant="dark" disabled={st.saving}>
								{#if st.saving}<Spinner />Menyimpan{:else}Simpan{/if}
							</Btn>
							{#if st.msg}
								<span class={cn('font-mono text-xs', st.ok ? 'text-emerald-600' : 'text-safelight-dim')}>
									{st.msg}
								</span>
							{/if}
						</div>
					</form>
				{/if}
			</div>
		{/each}
	</div>
</div>
