<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiFetch } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	type TemplateState = {
		configured: boolean;
		version: number;
		mode?: 'form' | 'overlay';
		pageCount?: number;
		layout?: unknown;
		customLayout?: boolean;
		overlayFields?: string[];
		objectKey?: string;
		fieldNames?: string[];
		knownFields?: string[];
		missingFields?: string[];
		note?: string;
	};

	/** Panduan nama field — harus sama dengan kontrak backend. */
	const FIELD_GUIDE: Array<{ name: string; label: string; desc: string }> = [
		{ name: 'licenseId', label: 'ID Lisensi', desc: 'ID lisensi (UUID)' },
		{ name: 'licenseType', label: 'Jenis Lisensi', desc: '“Standar” / “Subscription”' },
		{ name: 'photoTitle', label: 'Judul Foto', desc: 'Judul foto' },
		{ name: 'photographer', label: 'Fotografer', desc: 'Nama fotografer' },
		{ name: 'issuedDate', label: 'Tanggal Terbit', desc: 'Tanggal terbit (Indonesia)' },
		{ name: 'expiryText', label: 'Masa Berlaku', desc: '“Tidak Terbatas” / “Sampai …”' },
		{ name: 'issuedTo', label: 'Nama Pemegang', desc: 'Nama pemegang lisensi' },
		{ name: 'username', label: 'Username Pembeli', desc: 'Username pembeli' },
		{ name: 'userId', label: 'ID Pengguna', desc: 'ID pengguna' },
		{ name: 'itemUrl', label: 'Tautan Item', desc: 'Tautan item' },
		{ name: 'orderId', label: 'ID Order', desc: 'Referensi order (boleh kosong)' }
	];

	let tpl: TemplateState | null = $state(null);
	let loading = $state(true);
	let uploading = $state(false);
	let previewing = $state(false);
	let message = $state('');
	let fileInput: HTMLInputElement | null = $state(null);
	let previewUrl: string | null = $state(null);
	/** Nama berkas terpilih, sesuai urutan halaman. */
	let picked: string[] = $state([]);
	let savingLayout = $state(false);

	/* ── Editor tata letak ramah (pengganti textarea JSON) ── */
	type SlotCoverForm = { x: number; y: number; w: number; h: number; color: string };
	type SlotForm = {
		id: number;
		/** Mode isi: 'field' = teks depan + pilihan data + teks belakang (tanpa
		    kurawal); 'custom' = teks mentah untuk format lanjutan. */
		mode: 'field' | 'custom';
		before: string;
		field: string;
		after: string;
		customText: string;
		page: number;
		x: number;
		y: number;
		size: number;
		font: string;
		color: string;
		maxWidth: number | null;
		coverOn: boolean;
		cover: SlotCoverForm;
	};
	type PhotoForm = { on: boolean; page: number; x: number; y: number; w: number; h: number; bg: string };
	const OVERLAY_PLACEHOLDERS: string[] = [
		'licenseId', 'licenseType', 'photoTitle', 'photographer', 'issuedDate',
		'expiryText', 'issuedTo', 'username', 'userId', 'itemUrl', 'orderId'
	];
	const FONT_OPTIONS: Array<{ value: string; label: string }> = [
		{ value: 'regular', label: 'Regular' },
		{ value: 'semibold', label: 'SemiBold' },
		{ value: 'bold', label: 'Bold' }
	];
	let slotSeq = 0;
	let slots: SlotForm[] = $state([]);
	let photoCfg: PhotoForm = $state({ on: false, page: 1, x: 20, y: 80, w: 50, h: 33, bg: '#ffffff' });
	let refWidth = $state(93);

	const numOr = (v: unknown, fallback: number): number => {
		const n = Number(v);
		return Number.isFinite(n) ? n : fallback;
	};

	/** Pecah teks slot jadi model form: satu placeholder dikenal → mode field,
	    selain itu (kosong/ganda/tak dikenal) → mode custom mentah. */
	function parseSlotText(text: string): { mode: 'field' | 'custom'; before: string; field: string; after: string; customText: string } {
		const parts = text.split(/\{(\w+)\}/g);
		// parts: [sebelum, nama, sesudah] bila tepat satu placeholder
		if (parts.length === 3 && FIELD_GUIDE.some((f) => f.name === parts[1])) {
			return { mode: 'field', before: parts[0] ?? '', field: parts[1] ?? '', after: parts[2] ?? '', customText: '' };
		}
		if (text === '') {
			return { mode: 'field', before: '', field: 'licenseId', after: '', customText: '' };
		}
		return { mode: 'custom', before: '', field: '', after: '', customText: text };
	}

	/** Isi form editor dari layout backend (dipanggil setelah muat/upload). */
	function syncEditor(layout: unknown): void {
		const l = (layout ?? {}) as {
			refWidth?: unknown;
			slots?: Array<Record<string, unknown>>;
			photo?: Record<string, unknown> | null;
		};
		refWidth = numOr(l.refWidth, 93);
		slots = (Array.isArray(l.slots) ? l.slots : []).slice(0, 40).map((s) => {
			const cover = (s.cover ?? {}) as Record<string, unknown>;
			const parsed = parseSlotText(typeof s.text === 'string' ? s.text : '');
			return {
				id: ++slotSeq,
				mode: parsed.mode,
				before: parsed.before,
				field: parsed.field,
				after: parsed.after,
				customText: parsed.customText,
				page: Math.max(1, Math.round(numOr(s.page, 1))),
				x: numOr(s.x, 0),
				y: numOr(s.y, 0),
				size: numOr(s.size, 2),
				font: typeof s.font === 'string' ? s.font : 'regular',
				color: typeof s.color === 'string' ? s.color : '#ffffff',
				maxWidth: s.maxWidth == null || s.maxWidth === '' ? null : numOr(s.maxWidth, 50),
				coverOn: !!s.cover,
				cover: {
					x: numOr(cover.x, 0),
					y: numOr(cover.y, 0),
					w: numOr(cover.w, 10),
					h: numOr(cover.h, 5),
					color: typeof cover.color === 'string' ? (cover.color as string) : '#0c0d0f'
				}
			};
		});
		const p = l.photo;
		photoCfg = p
			? {
					on: true,
					page: Math.max(1, Math.round(numOr(p.page, 1))),
					x: numOr(p.x, 20),
					y: numOr(p.y, 80),
					w: numOr(p.w, 50),
					h: numOr(p.h, 33),
					bg: typeof p.bg === 'string' ? (p.bg as string) : '#ffffff'
				}
			: { on: false, page: 1, x: 20, y: 80, w: 50, h: 33, bg: '#ffffff' };
	}

	/** Rakit JSON tata letak dari form untuk dikirim ke backend. */
	function buildLayout(): Record<string, unknown> {
		return {
			refWidth,
			slots: slots.map((s) => ({
				text: s.mode === 'custom' ? s.customText : `${s.before}${s.field ? `{${s.field}}` : ''}${s.after}`.slice(0, 200),
				page: Math.max(1, Math.round(s.page) || 1),
				x: Number(s.x) || 0,
				y: Number(s.y) || 0,
				size: Number(s.size) || 0,
				font: s.font,
				color: s.color,
				...(s.maxWidth == null ? {} : { maxWidth: Number(s.maxWidth) || 0 }),
				...(s.coverOn
					? {
							cover: {
								x: Number(s.cover.x) || 0,
								y: Number(s.cover.y) || 0,
								w: Number(s.cover.w) || 0,
								h: Number(s.cover.h) || 0,
								color: s.cover.color
							}
						}
					: {})
			})),
			...(photoCfg.on
				? {
						photo: {
							page: Math.max(1, Math.round(photoCfg.page) || 1),
							x: Number(photoCfg.x) || 0,
							y: Number(photoCfg.y) || 0,
							w: Number(photoCfg.w) || 0,
							h: Number(photoCfg.h) || 0,
							bg: photoCfg.bg
						}
					}
				: {})
		};
	}

	function addSlot(): void {
		if (slots.length >= 40) return;
		slots = [
			...slots,
			{
				id: ++slotSeq,
				mode: 'field',
				before: '',
				field: 'licenseId',
				after: '',
				customText: '',
				page: 1,
				x: 10,
				y: 10,
				size: 2,
				font: 'regular',
				color: '#ffffff',
				maxWidth: 50,
				coverOn: false,
				cover: { x: 9, y: 8, w: 50, h: 4, color: '#0c0d0f' }
			}
		];
	}

	function removeSlot(id: number): void {
		slots = slots.filter((s) => s.id !== id);
	}

	async function saveLayout(reset = false): Promise<void> {
		message = '';
		savingLayout = true;
		try {
			const res = await apiFetch('/admin/license-template/layout', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ layout: reset ? null : buildLayout() })
			});
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } } | null)?.error?.message ?? `Simpan gagal (${res.status})`
				);
			}
			const d = (json as { data: { layout: unknown; customLayout: boolean } }).data;
			if (tpl) tpl = { ...tpl, layout: d.layout, customLayout: d.customLayout };
			if (reset && d.layout) syncEditor(d.layout);
			message = reset ? 'Tata letak dikembalikan ke bawaan' : 'Tata letak disimpan. Lisensi lama akan dibuat ulang';
			await previewTemplate();
		} catch (e) {
			message = e instanceof Error ? e.message : 'Simpan gagal';
		} finally {
			savingLayout = false;
		}
	}

	function isError(m: string): boolean {
		return /gagal|tidak valid|bukan|belum|invalid|maks|harus/i.test(m);
	}

	function isKnownField(f: string): boolean {
		return (tpl?.knownFields ?? []).includes(f);
	}

	async function loadState() {
		loading = true;
		try {
			tpl = await api<TemplateState>('/admin/license-template');
			if (tpl?.layout) syncEditor(tpl.layout);
		} catch {
			message = 'Gagal memuat status template';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadState();
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	});

	async function uploadTemplate() {
		// Beberapa berkas digabung sesuai urutan nama (Hal 1, Hal 2, …).
		const files = [...(fileInput?.files ?? [])].sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { numeric: true })
		);
		message = '';
		if (!files.length) {
			message = 'Pilih berkas PDF dulu';
			return;
		}
		if (files.some((f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))) {
			message = 'Semua berkas harus PDF';
			return;
		}
		if (files.some((f) => f.size > 25 * 1024 * 1024)) {
			message = 'Tiap berkas maks 25 MB';
			return;
		}
		uploading = true;
		try {
			const fd = new FormData();
			for (const f of files) fd.append('template', f);
			const res = await apiFetch('/admin/license-template', { method: 'POST', body: fd });
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } } | null)?.error?.message ??
						`Upload gagal (${res.status})`
				);
			}
			tpl = (json as { data: TemplateState }).data;
			if (tpl.layout) syncEditor(tpl.layout);
			message = `Template v${tpl.version} aktif (${tpl.pageCount ?? files.length} halaman${tpl.mode === 'overlay' ? ', mode desain jadi' : ''}) — PDF lisensi lama akan dibuat ulang otomatis`;
			if (fileInput) fileInput.value = '';
			picked = [];
			await previewTemplate();
		} catch (e) {
			message = e instanceof Error ? e.message : 'Upload gagal';
		} finally {
			uploading = false;
		}
	}

	async function previewTemplate() {
		message = '';
		previewing = true;
		try {
			const res = await apiFetch('/admin/license-template/preview', { method: 'POST' });
			if (!res.ok) {
				const json = await res.json().catch(() => null);
				throw new Error(
					(json as { error?: { message?: string } } | null)?.error?.message ??
						`Preview gagal (${res.status})`
				);
			}
			const blob = await res.blob();
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(blob);
		} catch (e) {
			message = e instanceof Error ? e.message : 'Preview gagal';
		} finally {
			previewing = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="09" kicker="Sistem" title="Template Lisensi" class="mb-8" />

	{#if loading}
		<Skeleton class="h-64" />
	{:else}
		<div class="grid gap-5 items-start lg:grid-cols-2">
			<Panel class="p-7">
				<Kicker class="mb-2">Desain PDF</Kicker>
				<h2 class="font-display text-2xl tracking-[-0.01em] mb-2">Upload Template</h2>
				<p class="text-sm text-ash mb-5">
					Unggah PDF hasil desainmu (mis. ekspor Canva). Boleh beberapa berkas
					sekaligus — Hal 1, Hal 2, dst. digabung sesuai urutan nama, maks 25 MB
					per berkas. Status saat ini:
					{#if tpl?.configured}
						<strong>aktif (v{tpl.version}, {tpl.pageCount ?? '?'} halaman)</strong>.
					{:else}
						<strong>belum ada</strong> — dipakai desain bawaan.
					{/if}
				</p>

				<input
					bind:this={fileInput}
					type="file"
					multiple
					accept="application/pdf,.pdf"
					onchange={() =>
						(picked = [...(fileInput?.files ?? [])]
							.map((f) => f.name)
							.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))}
					class={inputCls}
					aria-label="Berkas PDF template"
				/>
				{#if picked.length > 1}
					<ol class="mt-3 list-decimal pl-5 text-xs text-ash">
						{#each picked as n (n)}<li>{n}</li>{/each}
					</ol>
				{/if}
				<div class="mt-4 flex flex-wrap gap-2">
					<Btn variant="primary" onclick={uploadTemplate} disabled={uploading}>
						{#if uploading}<Spinner />{:else}Unggah & aktifkan{/if}
					</Btn>
					<Btn onclick={previewTemplate} disabled={previewing || !tpl?.configured}>
						{#if previewing}<Spinner />{:else}Preview isi contoh{/if}
					</Btn>
				</div>
				{#if message}
					<p class="mt-4 text-sm {isError(message) ? 'text-safelight-dim' : 'text-green-700'}">
						{message}
					</p>
				{/if}

				{#if tpl?.configured && tpl.mode === 'overlay'}
					<div class="mt-6 border-t hairline pt-5">
						<Kicker class="mb-2">Mode desain jadi</Kicker>
						<p class="text-xs text-ash mb-3">
							PDF ini tanpa field form, jadi data ditulis di posisi tetap di atas
							desain. Atur tiap teks di bawah — satuan halaman PDF (titik, asal
							kiri-bawah), lalu tekan Simpan dan lihat hasilnya di Preview.
						</p>
						<div class="mb-4 flex flex-wrap gap-1.5" aria-label="Placeholder yang bisa dipakai">
							{#each OVERLAY_PLACEHOLDERS as ph (ph)}
								<code class="font-mono text-[10px] px-1.5 py-0.5 rounded-[3px] bg-ink/[0.06] text-ash">{`{${ph}}`}</code>
							{/each}
						</div>

						{#each slots as slot, i (slot.id)}
							<fieldset class="mb-3 rounded-[3px] border hairline p-3">
								<div class="flex items-center justify-between gap-2">
									<legend class="font-mono text-[11px] uppercase tracking-[0.14em] text-ash px-1">
										Teks {i + 1}{slot.page > 1 ? ` · hal ${slot.page}` : ''}
									</legend>
									<button
										type="button"
										onclick={() => removeSlot(slot.id)}
										class="font-mono text-[11px] text-ash-2 hover:text-safelight-dim"
										aria-label={`Hapus teks ${i + 1}`}
									>
										✕
									</button>
								</div>
								{#if slot.mode === 'custom'}
									<input
										bind:value={slot.customText}
										maxlength={200}
										class="{inputCls} mt-2 font-mono text-xs"
										aria-label={`Isi teks ${i + 1} (lanjutan)`}
									/>
									<p class="mt-1 text-[11px] text-ash">Format lanjutan — biarkan bila tidak yakin. <button type="button" class="underline" onclick={() => { const p = parseSlotText(''); slot.mode = p.mode; slot.before = p.before; slot.field = p.field; slot.after = p.after; slot.customText = p.customText; }}>Kembalikan ke pilihan data</button></p>
								{:else}
									<div class="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
										<label class="block min-w-0">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Teks depan</span>
											<input bind:value={slot.before} maxlength={100} class={inputCls} aria-label="Teks sebelum data" placeholder="cth: Lisensi " />
										</label>
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Data</span>
											<select bind:value={slot.field} class={inputCls} aria-label="Data yang ditampilkan">
												<option value="">— Teks saja —</option>
												{#each FIELD_GUIDE as fg (fg.name)}
													<option value={fg.name}>{fg.label}</option>
												{/each}
											</select>
										</label>
										<label class="block min-w-0">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Teks belakang</span>
											<input bind:value={slot.after} maxlength={100} class={inputCls} aria-label="Teks sesudah data" placeholder="cth:  license" />
										</label>
									</div>
									<p class="mt-1 text-[11px] text-ash">
										Hasil: <span class="font-medium text-ink">{slot.before}<span class="text-safelight-dim">{slot.field ? FIELD_GUIDE.find((f) => f.name === slot.field)?.label ?? slot.field : '—'}</span>{slot.after}</span>
									</p>
								{/if}
								<div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Hal</span>
										<input type="number" min="1" step="1" bind:value={slot.page} class={inputCls} aria-label="Halaman" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">X</span>
										<input type="number" step="any" bind:value={slot.x} class={inputCls} aria-label="Posisi X" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Y</span>
										<input type="number" step="any" bind:value={slot.y} class={inputCls} aria-label="Posisi Y" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Ukuran</span>
										<input type="number" step="any" min="0" bind:value={slot.size} class={inputCls} aria-label="Ukuran huruf" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Lebar maks</span>
										<input type="number" step="any" min="0" bind:value={slot.maxWidth} class={inputCls} aria-label="Lebar maksimum" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Huruf</span>
										<select bind:value={slot.font} class={inputCls} aria-label="Jenis huruf">
											{#each FONT_OPTIONS as fo (fo.value)}
												<option value={fo.value}>{fo.label}</option>
											{/each}
										</select>
									</label>
								</div>
								<div class="mt-2 flex items-center gap-2">
									<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Warna</span>
									<input type="color" bind:value={slot.color} class="h-7 w-10 cursor-pointer rounded-[3px] border hairline bg-transparent p-0.5" aria-label="Warna teks" />
									<code class="font-mono text-[11px] text-ash">{slot.color}</code>
									<label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-ash">
										<input type="checkbox" bind:checked={slot.coverOn} class="accent-safelight" />
										Tutup nilai contoh
									</label>
								</div>
								{#if slot.coverOn}
									<div class="mt-2 grid grid-cols-3 gap-2 rounded-[3px] bg-ink/[0.04] p-2 sm:grid-cols-5">
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Tutup X</span>
											<input type="number" step="any" bind:value={slot.cover.x} class={inputCls} aria-label="Penutup X" />
										</label>
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Tutup Y</span>
											<input type="number" step="any" bind:value={slot.cover.y} class={inputCls} aria-label="Penutup Y" />
										</label>
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Lebar</span>
											<input type="number" step="any" min="0" bind:value={slot.cover.w} class={inputCls} aria-label="Penutup lebar" />
										</label>
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Tinggi</span>
											<input type="number" step="any" min="0" bind:value={slot.cover.h} class={inputCls} aria-label="Penutup tinggi" />
										</label>
										<label class="block">
											<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Warna</span>
											<input type="color" bind:value={slot.cover.color} class="h-7 w-10 cursor-pointer rounded-[3px] border hairline bg-transparent p-0.5" aria-label="Warna penutup" />
										</label>
									</div>
								{/if}
							</fieldset>
						{/each}
						{#if slots.length < 40}
							<Btn onclick={addSlot}>+ Tambah teks</Btn>
						{/if}

						<div class="mt-4 rounded-[3px] border hairline p-3">
							<label class="flex cursor-pointer items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={photoCfg.on} class="accent-safelight" />
								Ganti foto contoh dengan foto yang dibeli
							</label>
							{#if photoCfg.on}
								<div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Hal</span>
										<input type="number" min="1" step="1" bind:value={photoCfg.page} class={inputCls} aria-label="Foto halaman" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">X</span>
										<input type="number" step="any" bind:value={photoCfg.x} class={inputCls} aria-label="Foto X" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Y</span>
										<input type="number" step="any" bind:value={photoCfg.y} class={inputCls} aria-label="Foto Y" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Lebar</span>
										<input type="number" step="any" min="0" bind:value={photoCfg.w} class={inputCls} aria-label="Foto lebar" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Tinggi</span>
										<input type="number" step="any" min="0" bind:value={photoCfg.h} class={inputCls} aria-label="Foto tinggi" />
									</label>
									<label class="block">
										<span class="font-mono text-[10px] uppercase tracking-[0.12em] text-ash-2">Latar</span>
										<input type="color" bind:value={photoCfg.bg} class="h-7 w-10 cursor-pointer rounded-[3px] border hairline bg-transparent p-0.5" aria-label="Warna latar foto" />
									</label>
								</div>
							{/if}
						</div>

						<div class="mt-4 flex flex-wrap gap-2">
							<Btn variant="primary" onclick={() => saveLayout(false)} disabled={savingLayout}>
								{#if savingLayout}<Spinner />{:else}Simpan tata letak{/if}
							</Btn>
							{#if tpl.customLayout}
								<Btn onclick={() => saveLayout(true)} disabled={savingLayout}>Kembalikan bawaan</Btn>
							{/if}
						</div>
						<p class="mt-2 text-xs text-ash">Setiap simpan langsung menampilkan Preview di samping</p>
					</div>
				{:else if tpl?.configured}
					<div class="mt-6 border-t hairline pt-5">
						<Kicker class="mb-3">Field terdeteksi di template</Kicker>
						<ul class="flex flex-wrap gap-2">
							{#each (tpl.fieldNames ?? []) as f (f)}
								<li
									class="font-mono text-[11px] px-2.5 py-1.5 rounded-[3px] {isKnownField(f)
										? 'bg-safelight/10 text-safelight-dim'
										: 'bg-ink/[0.06] text-ash-2'}"
									title={isKnownField(f) ? 'Diisi otomatis' : 'Tidak dikenal — dibiarkan'}
								>
									{f}
								</li>
							{/each}
						</ul>
						{#if (tpl.missingFields ?? []).length > 0}
							<p class="mt-3 text-xs text-ash">
								Tidak ada di template (dilewati): {(tpl.missingFields ?? []).join(', ')}
							</p>
						{/if}
					</div>
				{/if}
			</Panel>

			<div class="grid gap-5">
				<Panel class="p-7">
					<Kicker class="mb-2">Kontrak field</Kicker>
					<h2 class="font-display text-2xl tracking-[-0.01em] mb-2">Nama field form</h2>
					<p class="text-sm text-ash mb-5">
						Di editor PDF (LibreOffice, Acrobat, dsb.), tambah field teks dengan
						nama <em>persis</em> seperti di bawah. Posisi, font, dan warna bebas —
						backend hanya mengisi nilainya. Template boleh lebih dari 1 halaman,
						dan nama yang sama boleh dipakai ulang di beberapa halaman (mis. ID
						lisensi di halaman 1 dan 2) — setiap kemunculan terisi nilai yang sama.
					</p>
					<dl class="space-y-2.5">
						{#each FIELD_GUIDE as f (f.name)}
							<div class="flex items-baseline justify-between gap-4">
								<dt class="text-xs text-ink">{f.label}</dt>
								<dd class="font-mono text-[11px] text-ash text-right">{f.name}</dd>
							</div>
						{/each}
					</dl>
				</Panel>

				{#if previewUrl}
					<Panel class="p-4">
						<Kicker class="mb-3 px-3 pt-2">Preview (data contoh)</Kicker>
						<iframe
							title="Preview template lisensi"
							src={previewUrl}
							class="h-[560px] w-full rounded-[3px] border hairline bg-white"
						></iframe>
					</Panel>
				{/if}
			</div>
		</div>
	{/if}
</div>
