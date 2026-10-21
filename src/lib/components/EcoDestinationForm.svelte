<script lang="ts">
	import { untrack } from 'svelte';
	import { api, apiEnvelope, ApiError } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import { translateToEn } from '$lib/translate';
	import {
		ECO_ZONES,
		emptyEcoForm,
		formFrom,
		linesOf,
		payloadOf,
		siteUrl,
		type EcoDestination,
		type EcoForm,
		type EcoPhoto
	} from '$lib/eco';
	import Panel from './Panel.svelte';
	import Field from './Field.svelte';
	import Btn from './Btn.svelte';
	import Spinner from './Spinner.svelte';
	import TranslateButton from './TranslateButton.svelte';

	/**
	 * Form destinasi ekowisata (Studio › Ekowisata › Tambah / Ubah). Foto & video dipilih dari ARSIP yang sudah
	 * disetujui — tak ada unggahan baru di sini; urutannya = urutan di halaman situs, salah satunya jadi sampul.
	 * Teks EN opsional (kosong = situs EN memakai teks Indonesia); tombol terjemah mengisinya dari ID.
	 */
	let {
		initial = null,
		onsaved
	}: {
		initial?: EcoDestination | null;
		onsaved: (d: EcoDestination) => void;
	} = $props();

	// Nilai awal sekali saja: halaman ubah membuat ulang form ({#key}) bila destinasinya berganti.
	const start = untrack(() => initial);
	let form = $state<EcoForm>(start ? formFrom(start) : emptyEcoForm());
	let photos = $state<EcoPhoto[]>(start?.photos ?? []);
	let coverId = $state<string | null>(start?.coverPhotoId ?? null);
	let errors = $state<Record<string, string>>({});
	let general = $state('');
	let saving = $state(false);
	let savedAt = $state<number | null>(null);

	const isEdit = $derived(!!initial);
	const site = siteUrl();

	// Pratinjau slug otomatis (sama dengan API: huruf kecil, beraksen dilepas, tanda hubung).
	const autoSlug = $derived(
		form.name
			.normalize('NFKD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80)
	);
	const slugShown = $derived(form.slug.trim() || autoSlug || 'nama-destinasi');
	const zoneHint = $derived(ECO_ZONES.find((z) => z.value === form.zone)?.hint ?? '');

	function clearErr(name: string) {
		if (errors[name]) errors = { ...errors, [name]: '' };
		if (general) general = '';
	}

	// ── Terjemah ID → EN ──
	async function tr(from: keyof EcoForm, to: keyof EcoForm, mode: 'text' | 'paras' | 'lines' = 'text') {
		const src = String(form[from] ?? '').trim();
		if (!src) return;
		if (mode === 'lines') {
			const items = linesOf(src);
			const out = await translateToEn(items);
			(form[to] as string) = out.join('\n');
		} else if (mode === 'paras') {
			// Per paragraf: penyedia terjemah gratis membatasi panjang tiap teks.
			const paras = src.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
			const out = await translateToEn(paras);
			(form[to] as string) = out.join('\n\n');
		} else {
			const [en] = await translateToEn([src]);
			(form[to] as string) = en ?? '';
		}
		clearErr(to);
	}

	// ── Foto dari arsip ──
	let pickQ = $state('');
	let pickResults = $state<EcoPhoto[]>([]);
	let picking = $state(false);
	let pickSeq = 0;
	const chosen = $derived(new Set(photos.map((p) => p.id)));
	$effect(() => {
		const q = pickQ.trim();
		const my = ++pickSeq;
		const t = setTimeout(async () => {
			picking = true;
			try {
				// Tanpa `type`: API hanya mengembalikan foto & video (audio tak bisa jadi foto destinasi).
				const res = await apiEnvelope<EcoPhoto[]>(`/photos?limit=24${q ? `&search=${encodeURIComponent(q)}` : ''}`);
				if (my === pickSeq) pickResults = res.data ?? [];
			} catch {
				if (my === pickSeq) pickResults = [];
			} finally {
				if (my === pickSeq) picking = false;
			}
		}, 300);
		return () => clearTimeout(t);
	});

	function addPhoto(p: EcoPhoto) {
		if (chosen.has(p.id) || photos.length >= 40) return;
		photos = [...photos, p];
		clearErr('photoIds');
	}
	function removePhoto(id: string) {
		photos = photos.filter((p) => p.id !== id);
		if (coverId === id) coverId = null;
	}
	function move(i: number, d: -1 | 1) {
		const j = i + d;
		if (j < 0 || j >= photos.length) return;
		const next = [...photos];
		[next[i], next[j]] = [next[j]!, next[i]!];
		photos = next;
	}
	const coverShown = $derived(photos.find((p) => p.id === coverId) ?? photos[0] ?? null);

	// ── Simpan ──
	function validate(): boolean {
		const e: Record<string, string> = {};
		if (form.name.trim().length < 2) e.name = 'Nama minimal 2 karakter';
		if (form.region.trim().length < 2) e.region = 'Provinsi / pulau wajib diisi';
		if (form.summary.trim().length < 10) e.summary = 'Ringkasan minimal 10 karakter';
		if (form.story.trim().length < 20) e.story = 'Cerita minimal 20 karakter';
		for (const [k, min, max, label] of [
			['elevation', -11000, 9000, 'Ketinggian'],
			['latitude', -90, 90, 'Lintang'],
			['longitude', -180, 180, 'Bujur']
		] as const) {
			const v = form[k].trim().replace(',', '.');
			if (v && (!Number.isFinite(Number(v)) || Number(v) < min || Number(v) > max)) e[k] = `${label} harus angka ${min} sampai ${max}`;
		}
		if (form.website.trim() && !/^https?:\/\/\S+$/i.test(form.website.trim())) e.website = 'Website harus diawali http:// atau https://';
		if (form.published && photos.length === 0) e.photoIds = 'Destinasi yang terbit perlu minimal satu foto';
		errors = e;
		return Object.values(e).every((x) => !x);
	}

	async function save() {
		general = '';
		if (!validate()) {
			general = 'Periksa kembali isian yang ditandai.';
			return;
		}
		saving = true;
		try {
			const body = JSON.stringify(payloadOf(form, photos.map((p) => p.id), coverId && chosen.has(coverId) ? coverId : null));
			const d = initial
				? await api<EcoDestination>(`/ecotourism/${encodeURIComponent(initial.id)}`, { method: 'PATCH', body })
				: await api<EcoDestination>('/ecotourism', { method: 'POST', body });
			savedAt = Date.now();
			form = formFrom(d);
			photos = d.photos;
			coverId = d.coverPhotoId;
			onsaved(d);
		} catch (err) {
			if (err instanceof ApiError) {
				const details = (err.payload as { error?: { details?: { field: string; message: string }[] } } | null)?.error?.details ?? [];
				if (details.length) errors = Object.fromEntries(details.map((d) => [d.field.split('.')[0] ?? d.field, d.message]));
				general = err.message === 'Input tidak valid' ? 'Periksa kembali isian yang ditandai.' : err.message;
			} else general = 'Terjadi kesalahan. Coba lagi.';
		} finally {
			saving = false;
		}
	}

	const err = (k: string) => errors[k] ?? '';
	const ta = cn(inputCls, 'min-h-[7rem] leading-relaxed');
</script>

{#snippet errLine(k: string)}
	{#if err(k)}<p class="mt-1.5 text-[12px] text-safelight-dim">{err(k)}</p>{/if}
{/snippet}

<form
	class="grid gap-6"
	onsubmit={(e) => {
		e.preventDefault();
		void save();
	}}
>
	<!-- Identitas -->
	<Panel class="p-6">
		<h2 class="mb-1 font-display text-xl">Identitas</h2>
		<p class="mb-5 text-sm text-ash">Nama, zona di halaman Ekowisata, dan letak destinasi.</p>
		<div class="grid gap-5 md:grid-cols-2">
			<Field label="Nama (ID) *">
				<input name="name" class={inputCls} bind:value={form.name} oninput={() => clearErr('name')} maxlength="120" placeholder="Contoh: Kawah Ijen" />
				{@render errLine('name')}
			</Field>
			<Field label="Nama (EN)">
				{#snippet action()}<TranslateButton run={() => tr('name', 'nameEn')} source={form.name} target="nameEn" disabled={!form.name.trim()} />{/snippet}
				<input name="nameEn" class={inputCls} bind:value={form.nameEn} oninput={() => clearErr('nameEn')} maxlength="120" placeholder="Kosong = pakai nama ID" />
				{@render errLine('nameEn')}
			</Field>
			<Field label="Slug (alamat halaman)">
				<input name="slug" class={inputCls} bind:value={form.slug} oninput={() => clearErr('slug')} maxlength="80" placeholder={autoSlug || 'otomatis dari nama'} />
				<p class="mt-1.5 font-mono text-[11px] text-ash-2">/ecotourism/{slugShown}</p>
				{@render errLine('slug')}
			</Field>
			<Field label="Zona *">
				<select name="zone" class={inputCls} bind:value={form.zone} onchange={() => clearErr('zone')}>
					{#each ECO_ZONES as z (z.value)}<option value={z.value}>{z.label}</option>{/each}
				</select>
				<p class="mt-1.5 text-[12px] text-ash">{zoneHint}</p>
			</Field>
			<Field label="Provinsi / pulau *">
				<input name="region" class={inputCls} bind:value={form.region} oninput={() => clearErr('region')} maxlength="120" placeholder="Contoh: Jawa Timur" />
				{@render errLine('region')}
			</Field>
			<Field label="Kawasan / pengelola wilayah">
				<input name="area" class={inputCls} bind:value={form.area} oninput={() => clearErr('area')} maxlength="160" placeholder="Contoh: Taman Wisata Alam Kawah Ijen" />
				{@render errLine('area')}
			</Field>
			<Field label="Ketinggian (m dpl)">
				<input name="elevation" class={inputCls} bind:value={form.elevation} oninput={() => clearErr('elevation')} inputmode="numeric" placeholder="Contoh: 2386 — di bawah laut: -18" />
				{@render errLine('elevation')}
			</Field>
			<div class="grid grid-cols-2 gap-3">
				<Field label="Lintang">
					<input name="latitude" class={inputCls} bind:value={form.latitude} oninput={() => clearErr('latitude')} inputmode="decimal" placeholder="-8.058" />
					{@render errLine('latitude')}
				</Field>
				<Field label="Bujur">
					<input name="longitude" class={inputCls} bind:value={form.longitude} oninput={() => clearErr('longitude')} inputmode="decimal" placeholder="114.242" />
					{@render errLine('longitude')}
				</Field>
			</div>
		</div>
	</Panel>

	<!-- Cerita -->
	<Panel class="p-6">
		<h2 class="mb-1 font-display text-xl">Cerita</h2>
		<p class="mb-5 text-sm text-ash">Ringkasan tampil di kartu & mesin pencari. Cerita: pisahkan paragraf dengan baris kosong.</p>
		<div class="grid gap-5 md:grid-cols-2">
			<Field label={`Ringkasan (ID) * — ${form.summary.length}/300`}>
				<textarea name="summary" class={ta} bind:value={form.summary} oninput={() => clearErr('summary')} maxlength="300" placeholder="Satu-dua kalimat: apa yang membuat tempat ini istimewa."></textarea>
				{@render errLine('summary')}
			</Field>
			<Field label={`Ringkasan (EN) — ${form.summaryEn.length}/300`}>
				{#snippet action()}<TranslateButton run={() => tr('summary', 'summaryEn')} source={form.summary} target="summaryEn" disabled={!form.summary.trim()} />{/snippet}
				<textarea name="summaryEn" class={ta} bind:value={form.summaryEn} oninput={() => clearErr('summaryEn')} maxlength="300"></textarea>
				{@render errLine('summaryEn')}
			</Field>
			<Field label="Cerita (ID) *">
				<textarea name="story" class={cn(ta, 'min-h-[16rem]')} bind:value={form.story} oninput={() => clearErr('story')} placeholder="Sejarah, ekosistem, warga yang menjaganya…"></textarea>
				{@render errLine('story')}
			</Field>
			<Field label="Cerita (EN)">
				{#snippet action()}<TranslateButton run={() => tr('story', 'storyEn', 'paras')} source={form.story} target="storyEn" disabled={!form.story.trim()} />{/snippet}
				<textarea name="storyEn" class={cn(ta, 'min-h-[16rem]')} bind:value={form.storyEn} oninput={() => clearErr('storyEn')}></textarea>
				{@render errLine('storyEn')}
			</Field>
		</div>
	</Panel>

	<!-- Info kunjungan -->
	<Panel class="p-6">
		<h2 class="mb-1 font-display text-xl">Info kunjungan</h2>
		<p class="mb-5 text-sm text-ash">Kegiatan & aturan: satu butir per baris (maks 15).</p>
		<div class="grid gap-5 md:grid-cols-2">
			<Field label="Waktu terbaik (ID)">
				<input name="bestTime" class={inputCls} bind:value={form.bestTime} oninput={() => clearErr('bestTime')} maxlength="200" placeholder="Contoh: April–Oktober (musim kemarau)" />
				{@render errLine('bestTime')}
			</Field>
			<Field label="Waktu terbaik (EN)">
				{#snippet action()}<TranslateButton run={() => tr('bestTime', 'bestTimeEn')} source={form.bestTime} target="bestTimeEn" disabled={!form.bestTime.trim()} />{/snippet}
				<input name="bestTimeEn" class={inputCls} bind:value={form.bestTimeEn} oninput={() => clearErr('bestTimeEn')} maxlength="200" />
				{@render errLine('bestTimeEn')}
			</Field>
			<Field label="Cara ke sana (ID)">
				<textarea name="access" class={ta} bind:value={form.access} oninput={() => clearErr('access')} placeholder="Bandara/kota terdekat, jalur darat/laut, izin masuk…"></textarea>
				{@render errLine('access')}
			</Field>
			<Field label="Cara ke sana (EN)">
				{#snippet action()}<TranslateButton run={() => tr('access', 'accessEn', 'paras')} source={form.access} target="accessEn" disabled={!form.access.trim()} />{/snippet}
				<textarea name="accessEn" class={ta} bind:value={form.accessEn} oninput={() => clearErr('accessEn')}></textarea>
				{@render errLine('accessEn')}
			</Field>
			<Field label="Kegiatan (ID)">
				<textarea name="activities" class={ta} bind:value={form.activities} oninput={() => clearErr('activities')} placeholder={'Pendakian subuh\nMelihat api biru'}></textarea>
				{@render errLine('activities')}
			</Field>
			<Field label="Kegiatan (EN)">
				{#snippet action()}<TranslateButton run={() => tr('activities', 'activitiesEn', 'lines')} source={form.activities} target="activitiesEn" disabled={!form.activities.trim()} />{/snippet}
				<textarea name="activitiesEn" class={ta} bind:value={form.activitiesEn} oninput={() => clearErr('activitiesEn')}></textarea>
				{@render errLine('activitiesEn')}
			</Field>
			<Field label="Aturan kawasan & etika (ID)">
				<textarea name="rules" class={ta} bind:value={form.rules} oninput={() => clearErr('rules')} placeholder={'Pakai masker gas di bibir kawah\nJangan tinggalkan sampah'}></textarea>
				{@render errLine('rules')}
			</Field>
			<Field label="Aturan kawasan & etika (EN)">
				{#snippet action()}<TranslateButton run={() => tr('rules', 'rulesEn', 'lines')} source={form.rules} target="rulesEn" disabled={!form.rules.trim()} />{/snippet}
				<textarea name="rulesEn" class={ta} bind:value={form.rulesEn} oninput={() => clearErr('rulesEn')}></textarea>
				{@render errLine('rulesEn')}
			</Field>
			<Field label="Pengelola / komunitas setempat">
				<input name="manager" class={inputCls} bind:value={form.manager} oninput={() => clearErr('manager')} maxlength="160" placeholder="Contoh: Pokdarwis Desa Tamansari" />
				{@render errLine('manager')}
			</Field>
			<Field label="Website resmi">
				<input name="website" class={inputCls} bind:value={form.website} oninput={() => clearErr('website')} maxlength="300" inputmode="url" placeholder="https://…" />
				{@render errLine('website')}
			</Field>
		</div>
	</Panel>

	<!-- Foto & video -->
	<Panel class="p-6">
		<h2 class="mb-1 font-display text-xl">Foto & video</h2>
		<p class="mb-5 text-sm text-ash">Dari arsip yang sudah disetujui. Urutan = urutan di halaman; ★ = sampul (kosong = foto pertama).</p>
		{#if photos.length}
			<ol class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{#each photos as p, i (p.id)}
					{@const isCover = coverShown?.id === p.id}
					<li class={cn('overflow-hidden rounded-[3px] border bg-card-2', isCover ? 'border-safelight' : 'hairline')}>
						<div class="relative aspect-[4/3] bg-ink/5">
							{#if p.thumbUrl}<img src={p.thumbUrl} alt="" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />{/if}
							<span class="absolute left-1.5 top-1.5 rounded-[2px] bg-ink/75 px-1.5 py-0.5 font-mono text-[10px] text-paper">{i + 1}</span>
							{#if p.type === 'VIDEO'}<span class="absolute right-1.5 top-1.5 rounded-[2px] bg-ink/75 px-1.5 py-0.5 font-mono text-[10px] text-paper">VIDEO</span>{/if}
							{#if isCover}<span class="absolute bottom-1.5 left-1.5 rounded-[2px] bg-safelight px-1.5 py-0.5 font-mono text-[10px] text-white">SAMPUL</span>{/if}
						</div>
						<p class="truncate px-2 pt-1.5 text-[12px]" title={p.title}>{p.title}</p>
						<div class="flex items-center gap-1 px-1.5 pb-1.5 pt-1">
							<button type="button" class="eco-ico" onclick={() => move(i, -1)} disabled={i === 0} aria-label={`Geser ${p.title} ke kiri`}>←</button>
							<button type="button" class="eco-ico" onclick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={`Geser ${p.title} ke kanan`}>→</button>
							<button type="button" class={cn('eco-ico', isCover && 'text-safelight')} onclick={() => (coverId = p.id)} aria-pressed={isCover} aria-label={`Jadikan ${p.title} sampul`}>★</button>
							<button type="button" class="eco-ico ml-auto" onclick={() => removePhoto(p.id)} aria-label={`Lepas ${p.title}`}>✕</button>
						</div>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="mb-5 rounded-[3px] border hairline border-dashed px-4 py-6 text-center text-sm text-ash">Belum ada foto. Cari dari arsip di bawah lalu klik untuk menambahkan.</p>
		{/if}
		{@render errLine('photoIds')}
		{@render errLine('coverPhotoId')}

		<div class="mt-2 flex items-center gap-3">
			<input class={cn(inputCls, 'max-w-md')} bind:value={pickQ} placeholder="Cari foto/video arsip: judul, lokasi, kata kunci…" aria-label="Cari foto arsip" />
			{#if picking}<Spinner />{/if}
			<span class="ml-auto font-mono text-[11px] text-ash">{photos.length}/40 dipilih</span>
		</div>
		<div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
			{#each pickResults as p (p.id)}
				{@const on = chosen.has(p.id)}
				<button
					type="button"
					onclick={() => (on ? removePhoto(p.id) : addPhoto(p))}
					class={cn('group relative aspect-square overflow-hidden rounded-[3px] border bg-ink/5 text-left', on ? 'border-safelight' : 'hairline')}
					aria-pressed={on}
					title={p.title}
				>
					{#if p.thumbUrl}<img src={p.thumbUrl} alt="" class="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-80" loading="lazy" />{/if}
					<span class={cn('absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-[12px]', on ? 'bg-safelight text-white' : 'bg-ink/60 text-paper')}>{on ? '✓' : '+'}</span>
					<span class="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/80 to-transparent px-1.5 pb-1 pt-4 text-[10.5px] text-paper">{p.title}</span>
				</button>
			{:else}
				{#if !picking}<p class="col-span-full py-4 text-sm text-ash">Tidak ada foto yang cocok.</p>{/if}
			{/each}
		</div>
	</Panel>

	<!-- Terbit -->
	<Panel class="flex flex-wrap items-center gap-x-8 gap-y-4 p-6">
		<label class="flex cursor-pointer items-center gap-3">
			<input type="checkbox" bind:checked={form.published} onchange={() => clearErr('photoIds')} class="h-4 w-4 accent-[var(--color-safelight,#c2410c)]" />
			<span>
				<span class="block text-sm text-ink">Terbitkan di situs</span>
				<span class="block text-[12px] text-ash">Draf hanya terlihat di Studio.</span>
			</span>
		</label>
		<Field label="Urutan dalam zona" class="w-40">
			<input name="sortOrder" class={inputCls} bind:value={form.sortOrder} inputmode="numeric" placeholder="0" />
		</Field>
		<div class="ml-auto flex flex-wrap items-center gap-3">
			{#if general}<p class="text-sm text-safelight-dim" role="alert">{general}</p>{/if}
			{#if savedAt && !general}<p class="text-sm text-ash" role="status">Tersimpan.</p>{/if}
			{#if isEdit && site && initial?.published}
				<a href={`${site}/ecotourism/${initial.slug}`} target="_blank" rel="noopener" class="font-mono text-[11px] uppercase tracking-[0.16em] text-ink underline underline-offset-4 hover:text-safelight">Lihat di situs ↗</a>
			{/if}
			<Btn type="submit" variant="primary" disabled={saving}>
				{#if saving}<Spinner />{/if}
				{isEdit ? 'Simpan perubahan' : 'Simpan destinasi'}
			</Btn>
		</div>
	</Panel>
</form>

<style>
	.eco-ico {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 3px;
		font-size: 12px;
		color: var(--color-ink, #16171a);
		transition: background-color 0.15s ease;
	}
	.eco-ico:hover:not(:disabled) {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.eco-ico:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.eco-ico:focus-visible {
		outline: 2px solid var(--color-safelight, #c2410c);
		outline-offset: 1px;
	}
</style>
