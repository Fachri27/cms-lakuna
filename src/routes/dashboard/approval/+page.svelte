<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { api, ApiError } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface PendingPhoto {
		id: string;
		title: string;
		titleEn?: string | null;
		description?: string | null;
		descriptionEn?: string | null;
		photographer?: string | null;
		location?: string | null;
		width?: number | null;
		height?: number | null;
		thumbUrl?: string | null;
		watermarkUrl?: string | null;
		/** File asli resolusi penuh (presigned, khusus admin) untuk kurasi. */
		originalUrl?: string | null;
		type?: string;
		price?: number;
		batchId?: string | null;
		createdAt: string;
		user?: { username?: string; email?: string } | null;
	}

	/** Satu baris tabel: satu berkas, atau satu unggahan multi-berkas (batchId sama). */
	interface Group {
		key: string;
		items: PendingPhoto[];
	}

	const TH = 'px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal';
	const TD = 'px-7 py-4';
	const LBL = 'font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2';

	let photos = $state<PendingPhoto[]>([]);
	let loading = $state(true);
	let acting = $state<string | null>(null);
	/** Kelompok yang sedang dibuka (modal kurasi). */
	let openKey = $state<string | null>(null);
	/** Berkas yang sedang dipratinjau di dalam modal. */
	let activeId = $state<string | null>(null);
	/** Berkas yang file aslinya gagal diputar/dimuat browser (mis. HEVC/MOV) → kembali ke pratinjau watermark. */
	let origFailed = $state<Record<string, boolean>>({});
	/** Dialog alasan penolakan: id berkas (atau banyak id untuk "tolak semua"). */
	let rejecting = $state<{ ids: string[]; title: string } | null>(null);
	let rejectNote = $state('');
	/** Harga jual isi kurator (kontributor tak lagi mengisi harga): sinkron
		per berkas aktif, disimpan via PATCH /photos/:id. */
	let priceDraft = $state('');
	let priceSaving = $state(false);
	let priceMsg = $state('');
	$effect(() => {
		const d = openGroup
			? (openGroup.items.find((p) => p.id === activeId) ?? openGroup.items[0])
			: null;
		priceDraft = d?.price != null ? String(d.price) : '0';
		priceMsg = '';
	});
	/** Alasan cepat yang dicentang (bisa lebih dari satu). */
	let rejectReasons = $state<string[]>([]);
	/** Pesan akhir ke kontributor: alasan tercentang + catatan tambahan. */
	const rejectMessage = $derived(
		[...rejectReasons.map((r) => `${r}`), rejectNote.trim()].filter(Boolean).join(' ').slice(0, 500)
	);
	function toggleReason(r: string) {
		rejectReasons = rejectReasons.includes(r)
			? rejectReasons.filter((x) => x !== r)
			: [...rejectReasons, r];
	}

	const REJECT_PRESETS = [
		'Resolusi / ketajaman kurang',
		'Foto buram atau goyang',
		'Duplikat karya yang sudah ada',
		'Watermark / logo pihak lain',
		'Konten tidak sesuai kategori'
	];

	// Kelompokkan berurutan tanggal: berkas dengan batchId sama jadi satu baris.
	const groups = $derived.by<Group[]>(() => {
		const map = new Map<string, Group>();
		for (const p of photos) {
			const key = p.batchId ? `b:${p.batchId}` : `p:${p.id}`;
			const g = map.get(key);
			if (g) g.items.push(p);
			else map.set(key, { key, items: [p] });
		}
		return [...map.values()];
	});

	const openGroup = $derived(groups.find((g) => g.key === openKey) ?? null);
	const active = $derived(
		openGroup ? (openGroup.items.find((p) => p.id === activeId) ?? openGroup.items[0]) : null
	);

	function openDetail(g: Group) {
		openKey = g.key;
		activeId = g.items[0]?.id ?? null;
	}
	/** Penampil layar penuh untuk foto: pas-layar ⇄ 100% piksel asli. */
	let zoom = $state<{ src: string; alt: string } | null>(null);
	let zoomFull = $state(false);
	let zoomEl = $state<HTMLDivElement | null>(null);

	function openZoom(src: string, alt: string) {
		zoom = { src, alt };
		zoomFull = false;
	}

	/** Klik gambar: beralih ke ukuran asli dan gulir supaya titik yang diklik tetap di bawah kursor. */
	async function toggleZoom(e: MouseEvent) {
		const img = e.currentTarget as HTMLImageElement;
		const r = img.getBoundingClientRect();
		const fx = (e.clientX - r.left) / r.width;
		const fy = (e.clientY - r.top) / r.height;
		zoomFull = !zoomFull;
		if (!zoomFull || !zoomEl) return;
		await tick();
		const el = zoomEl;
		el.scrollLeft = fx * el.scrollWidth - (e.clientX - el.getBoundingClientRect().left);
		el.scrollTop = fy * el.scrollHeight - (e.clientY - el.getBoundingClientRect().top);
	}

	function closeDetail() {
		openKey = null;
		activeId = null;
	}

	async function fetchPending() {
		loading = true;
		try {
			// Batas maksimum API (100) supaya satu kelompok tidak terbelah halaman.
			const data = await api<PendingPhoto[]>('/photos/pending?limit=100');
			photos = data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void fetchPending();
	});

	/** Lepas berkas yang sudah dikurasi; tutup modal bila kelompoknya habis. */
	function removeDone(ids: string[]) {
		photos = photos.filter((p) => !ids.includes(p.id));
		if (openKey && !groups.some((g) => g.key === openKey)) closeDetail();
		else if (activeId && ids.includes(activeId)) activeId = openGroup?.items[0]?.id ?? null;
	}

	/** Simpan harga jual yang diisi kurator untuk berkas aktif. */
	async function savePrice(id: string) {
		const n = Math.floor(Number(priceDraft));
		if (!Number.isFinite(n) || n < 0 || n > 2000000000) {
			priceMsg = 'Harga harus angka 0–2.000.000.000';
			return;
		}
		priceSaving = true;
		priceMsg = '';
		try {
			await api(`/photos/${id}`, { method: 'PATCH', body: JSON.stringify({ price: n }) });
			photos = photos.map((p) => (p.id === id ? { ...p, price: n } : p));
			priceMsg = 'Harga tersimpan';
		} catch (err) {
			priceMsg = err instanceof ApiError ? err.message : 'Gagal menyimpan harga';
		} finally {
			priceSaving = false;
		}
	}

	async function approve(ids: string[], label: string) {		const msg =
			ids.length > 1
				? `Setujui dan publikasikan ${ids.length} berkas "${label}"?`
				: 'Setujui dan publikasikan berkas ini?';
		if (!confirm(msg)) return;
		acting = ids.length > 1 ? 'all' : ids[0];
		const done: string[] = [];
		try {
			for (const id of ids) {
				await api(`/photos/${id}/approve`, { method: 'PATCH' });
				done.push(id);
			}
		} catch (err) {
			console.error(err);
			alert(err instanceof ApiError ? err.message : 'Gagal menyetujui');
		} finally {
			removeDone(done);
			acting = null;
		}
	}

	function askReject(ids: string[], title: string) {
		rejecting = { ids, title };
		rejectNote = '';
		rejectReasons = [];
	}

	async function confirmReject() {
		const r = rejecting;
		if (!r) return;
		acting = r.ids.length > 1 ? 'all' : r.ids[0];
		const done: string[] = [];
		try {
			for (const id of r.ids) {
				await api(`/photos/${id}/reject`, {
					method: 'PATCH',
					body: JSON.stringify({ note: rejectMessage || undefined })
				});
				done.push(id);
			}
			rejecting = null;
		} catch (err) {
			console.error(err);
			alert(err instanceof ApiError ? err.message : 'Gagal menolak');
		} finally {
			removeDone(done);
			acting = null;
		}
	}

	function fmtDate(iso: string) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
	}
	const contributor = (p: PendingPhoto) => p.user?.username || p.user?.email || '—';
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (zoom) zoom = null;
		else if (rejecting) rejecting = null;
		else if (openKey) closeDetail();
	}}
/>

{#snippet thumb(p: PendingPhoto, cls: string)}
	{#if p.thumbUrl}
		<img src={p.thumbUrl} alt="" class="{cls} object-cover object-top" />
	{:else}
		<div class="{cls} bg-ink text-paper flex items-center justify-center font-display">
			{(p.title || '·').charAt(0).toUpperCase()}
		</div>
	{/if}
{/snippet}

<div class="rise">
	<SectionHeader index="02" kicker="Studio" title="Persetujuan" class="mb-8" />

	{#if loading}
		<Panel class="p-7 space-y-4">
			<Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton class="h-16" />
		</Panel>
	{:else if groups.length === 0}
		<Panel>
			<EmptyState>Tidak ada foto menunggu persetujuan</EmptyState>
		</Panel>
	{:else}
		<Panel class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left border-b hairline border-solid">
						<th class={TH}>Foto</th>
						<th class={TH}>Kontributor</th>
						<th class={TH}>Tipe</th>
						<th class={TH}>Harga</th>
						<th class={TH}>Tanggal</th>
						<th class="{TH} text-right">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each groups as g (g.key)}
						{@const first = g.items[0]}
						{@const many = g.items.length > 1}
						{@const types = [...new Set(g.items.map((p) => (p.type || '').toUpperCase()).filter(Boolean))]}
						<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
							<td class={TD}>
								<button
									type="button"
									onclick={() => openDetail(g)}
									class="flex items-center gap-4 text-left rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2"
									aria-label={many ? `Periksa ${g.items.length} berkas ${first.title}` : `Lihat detail ${first.title}`}
								>
									<!-- Tumpukan: dua bingkai di belakang menandakan kelompok. -->
									<span class="relative block w-11 h-11 shrink-0">
										{#if many}
											<span class="absolute inset-0 translate-x-[6px] -translate-y-[6px] rounded-[3px] border hairline bg-card-2"></span>
											<span class="absolute inset-0 translate-x-[3px] -translate-y-[3px] rounded-[3px] border hairline bg-card-2"></span>
										{/if}
										<span class="absolute inset-0 overflow-hidden rounded-[3px]">
											{@render thumb(first, 'w-11 h-11')}
										</span>
										{#if many}
											<span
												class="absolute -right-2.5 -bottom-2 min-w-[1.5rem] rounded-full bg-safelight px-1.5 py-[1px] text-center font-mono text-[10px] text-paper tnum"
											>+{g.items.length - 1}</span>
										{/if}
									</span>
									<span class="min-w-0">
										<span class="block text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink/60">{first.title}</span>
										{#if many}
											<span class="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
												{g.items.length} berkas · kurasi satu per satu
											</span>
										{/if}
									</span>
								</button>
							</td>
							<td class="{TD} font-mono text-[11px] text-ash">{contributor(first)}</td>
							<td class="{TD} font-mono text-[11px] text-ash uppercase">
								<span class="flex flex-wrap gap-1.5">
									{#each types as ty (ty)}<Badge status={ty} />{:else}—{/each}
								</span>
							</td>
							<td class="{TD} font-display text-base tnum">{formatPrice(first.price ?? 0)}</td>
							<td class="{TD} font-mono text-[11px] text-ash">{fmtDate(first.createdAt)}</td>
							<td class={TD}>
								<div class="flex justify-end gap-2">
									{#if many}
										<Btn variant="primary" onclick={() => openDetail(g)}>Periksa</Btn>
									{:else}
										<Btn variant="primary" onclick={() => void approve([first.id], first.title)} disabled={acting === first.id}>
											{acting === first.id ? '…' : 'Setujui'}
										</Btn>
										<Btn variant="danger" onclick={() => askReject([first.id], first.title)} disabled={acting === first.id}>
											Tolak
										</Btn>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Panel>
	{/if}

	{#if openGroup && active}
		{@const g = openGroup}
		{@const d = active}
		{@const many = g.items.length > 1}
		{@const isVideo = (d.type || '').toUpperCase() === 'VIDEO'}
		{@const preview = (!origFailed[d.id] && d.originalUrl) || d.watermarkUrl || d.thumbUrl}
		{@const isOriginal = !origFailed[d.id] && !!d.originalUrl}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Kurasi ${d.title}`}>
			<button type="button" aria-label="Tutup detail" onclick={closeDetail} class="absolute inset-0 bg-ink/60 cursor-default"></button>
			<div class="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[6px] bg-paper text-ink shadow-2xl">
				<div class="flex items-start justify-between gap-4 px-7 pt-6">
					<div class="min-w-0">
						<p class={LBL}>
							{many ? `Unggahan ${g.items.length} berkas · ${contributor(d)}` : 'Pratinjau kurasi'}
						</p>
						<h2 class="mt-1 font-display text-2xl leading-tight">{d.title}</h2>
					</div>
					<button
						type="button"
						onclick={closeDetail}
						aria-label="Tutup"
						class="shrink-0 w-9 h-9 grid place-items-center rounded-full border hairline text-ash hover:text-ink transition-colors"
					>✕</button>
				</div>

				{#if preview}
					<div class="mx-7 mt-5 overflow-hidden rounded-[4px] bg-ink/[0.04]">
						{#key d.id}
							{#if isVideo}
								<!-- svelte-ignore a11y_media_has_caption -- pratinjau kurasi, tanpa audio -->
								<video src={preview} controls playsinline preload="metadata" class="max-h-[60vh] w-full bg-ink" onerror={() => (origFailed[d.id] = true)}></video>
							{:else}
								<button type="button" class="block w-full cursor-zoom-in" aria-label="Perbesar foto" onclick={() => openZoom(preview, d.title)}>
									<img src={preview} alt={d.title} class="max-h-[60vh] w-full object-contain" onerror={() => (origFailed[d.id] = true)} />
								</button>
							{/if}
						{/key}
					</div>
					<p class="mx-7 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ash">
						<span>{isOriginal ? 'File asli, resolusi penuh' : 'Pratinjau watermark (file asli tidak bisa ditampilkan)'}</span>
						{#if isOriginal}
							{#if !isVideo}
								<button type="button" class="underline underline-offset-2 hover:text-ink" onclick={() => openZoom(preview, d.title)}>Perbesar</button>
							{/if}
							<a href={preview} target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-ink">Buka di tab baru</a>
						{/if}
					</p>
				{/if}

				{#if many}
					<!-- Lembar kontak kelompok: pilih berkas untuk dipratinjau & dikurasi. -->
					<ul class="mx-7 mt-4 flex gap-2.5 overflow-x-auto pb-1" aria-label="Berkas dalam unggahan ini">
						{#each g.items as p, i (p.id)}
							<li class="shrink-0">
								<button
									type="button"
									onclick={() => (activeId = p.id)}
									aria-current={p.id === d.id ? 'true' : undefined}
									aria-label={`Berkas ${i + 1}`}
									class="relative block w-20 h-14 overflow-hidden rounded-[3px] outline outline-2 outline-offset-2 transition-[outline-color] {p.id === d.id
										? 'outline-safelight'
										: 'outline-transparent hover:outline-ink/20'}"
								>
									{@render thumb(p, 'w-20 h-14')}
									<span class="absolute left-1 top-1 rounded-sm bg-ink/70 px-1 font-mono text-[9px] text-paper tnum">{i + 1}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<dl class="mx-7 mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
					<div><dt class={LBL}>Kontributor</dt><dd class="mt-0.5">{contributor(d)}</dd></div>
					<div><dt class={LBL}>Fotografer</dt><dd class="mt-0.5">{d.photographer || '—'}</dd></div>
					<div><dt class={LBL}>Tipe</dt><dd class="mt-0.5 uppercase">{d.type || '—'}</dd></div>
					<div>
						<dt class={LBL}>Harga (Rp, isi kurator)</dt>
						<dd class="mt-1 flex items-center gap-2">
							<input
								type="number"
								bind:value={priceDraft}
								min="0"
								max="2000000000"
								step="1000"
								class="w-32 rounded-[3px] border hairline border-solid bg-card-2 px-2 py-1 font-mono text-[12px] tnum outline-none focus:border-safelight"
								aria-label="Harga jual"
							/>
							<Btn onclick={() => void savePrice(d.id)} disabled={priceSaving}>
								{priceSaving ? '…' : 'Simpan'}
							</Btn>
						</dd>
						{#if priceMsg}<p class="mt-1 text-[11px] text-ash">{priceMsg}</p>{/if}
					</div>
					<div><dt class={LBL}>Dimensi</dt><dd class="mt-0.5 font-mono text-[12px]">{d.width && d.height ? `${d.width} × ${d.height} px` : '—'}</dd></div>
					<div><dt class={LBL}>Tanggal</dt><dd class="mt-0.5">{fmtDate(d.createdAt)}</dd></div>
					<div><dt class={LBL}>Lokasi</dt><dd class="mt-0.5">{d.location || '—'}</dd></div>
					<div class="sm:col-span-2"><dt class={LBL}>Deskripsi</dt><dd class="mt-0.5 text-ash">{d.description || '—'}</dd></div>
					{#if d.titleEn}
						<div class="sm:col-span-2"><dt class={LBL}>Title (EN)</dt><dd class="mt-0.5">{d.titleEn}</dd></div>
					{/if}
					{#if d.descriptionEn}
						<div class="sm:col-span-2"><dt class={LBL}>Description (EN)</dt><dd class="mt-0.5 text-ash">{d.descriptionEn}</dd></div>
					{/if}
				</dl>

				<div class="flex flex-wrap items-center justify-between gap-3 border-t hairline border-solid mt-6 px-7 py-5">
					{#if many}
						<div class="flex gap-2">
							<Btn variant="danger" onclick={() => askReject(g.items.map((p) => p.id), d.title)} disabled={acting !== null}>Tolak semua</Btn>
							<Btn onclick={() => void approve(g.items.map((p) => p.id), d.title)} disabled={acting !== null}>
								{acting === 'all' ? '…' : `Setujui semua (${g.items.length})`}
							</Btn>
						</div>
					{:else}
						<span></span>
					{/if}
					<div class="flex gap-2">
						<Btn variant="danger" onclick={() => askReject([d.id], d.title)} disabled={acting !== null}>
							{many ? 'Tolak berkas ini' : 'Tolak'}
						</Btn>
						<Btn variant="primary" onclick={() => void approve([d.id], d.title)} disabled={acting !== null}>
							{acting === d.id ? '…' : many ? 'Setujui berkas ini' : 'Setujui'}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if rejecting}
		{@const r = rejecting}
		<div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Alasan penolakan">
			<button type="button" aria-label="Batal" onclick={() => (rejecting = null)} class="absolute inset-0 bg-ink/50 cursor-default"></button>
			<form
				class="relative w-full max-w-lg rounded-[6px] bg-paper text-ink shadow-2xl p-7"
				onsubmit={(e) => {
					e.preventDefault();
					void confirmReject();
				}}
			>
				<p class={LBL}>{r.ids.length > 1 ? `Tolak ${r.ids.length} berkas` : 'Tolak berkas'}</p>
				<h3 class="mt-1 font-display text-xl leading-tight">{r.title}</h3>
				<fieldset class="mt-5">
					<legend class={LBL}>Alasan (dikirim ke kontributor)</legend>
					<ul class="mt-2 divide-y divide-ink/10 border-y hairline border-solid">
						{#each REJECT_PRESETS as preset (preset)}
							{@const on = rejectReasons.includes(preset)}
							<li>
								<label class="flex cursor-pointer items-center gap-3 py-2.5 text-sm transition-colors {on ? 'text-ink' : 'text-ash hover:text-ink'}">
									<input
										type="checkbox"
										checked={on}
										onchange={() => toggleReason(preset)}
										class="h-4 w-4 shrink-0 accent-[var(--color-safelight)]"
									/>
									<span>{preset}</span>
								</label>
							</li>
						{/each}
					</ul>
				</fieldset>
				<label class="mt-4 block">
					<span class={LBL}>Catatan tambahan (opsional)</span>
					<textarea
						bind:value={rejectNote}
						rows={3}
						maxlength={500}
						placeholder="Mis. subjek terpotong di tepi kanan; unggah ulang dengan framing lebih longgar"
						class="mt-2 w-full resize-y rounded-[3px] border hairline bg-transparent px-3 py-2.5 text-sm outline-none focus:border-safelight"
					></textarea>
				</label>
				<p class="mt-1 text-right font-mono text-[10px] text-ash-2 tnum">{rejectMessage.length}/500</p>
				<div class="mt-4 flex justify-end gap-2">
					<Btn onclick={() => (rejecting = null)}>Batal</Btn>
					<Btn type="submit" variant="danger" disabled={acting !== null}>{acting ? '…' : 'Tolak'}</Btn>
				</div>
			</form>
		</div>
	{/if}

	{#if zoom}
		<div class="fixed inset-0 z-[70] bg-ink/95" role="dialog" aria-modal="true" aria-label={`Perbesar ${zoom.alt}`}>
			<div bind:this={zoomEl} class="absolute inset-0 overflow-auto overscroll-contain">
				<div class="flex min-h-full min-w-full items-center justify-center {zoomFull ? 'w-max p-0' : 'p-6 sm:p-10'}">
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -- tombol toggle keyboard tersedia di bilah atas -->
					<img
						src={zoom.src}
						alt={zoom.alt}
						onclick={toggleZoom}
						class={zoomFull
							? 'max-w-none cursor-zoom-out'
							: 'max-h-[calc(100vh-5rem)] max-w-full object-contain cursor-zoom-in'}
					/>
				</div>
			</div>
			<div class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-paper">
				<p class="pointer-events-auto rounded-full bg-ink/70 px-3 py-1.5 text-xs">
					{zoomFull ? 'Ukuran asli 100% · gulir untuk menjelajah' : 'Klik foto untuk ukuran asli'}
				</p>
				<div class="pointer-events-auto flex gap-2">
					<button
						type="button"
						onclick={() => (zoomFull = !zoomFull)}
						class="rounded-full bg-ink/70 px-3 py-1.5 text-xs hover:bg-ink"
					>{zoomFull ? 'Pas layar' : '100%'}</button>
					<button
						type="button"
						onclick={() => (zoom = null)}
						aria-label="Tutup"
						class="grid h-8 w-8 place-items-center rounded-full bg-ink/70 hover:bg-ink"
					>✕</button>
				</div>
			</div>
		</div>
	{/if}
</div>
