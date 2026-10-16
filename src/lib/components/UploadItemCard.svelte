<script lang="ts">
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice, takenAtMax, TAKEN_AT_MIN } from '$lib/format';
	import { PHOTO_TYPES, isVideoKey } from '$lib/photo-types';
	import { translateToEn } from '$lib/translate';
	import { fileSizeLabel, type UploadItem } from '$lib/upload-item';
	import Field from './Field.svelte';
	import Spinner from './Spinner.svelte';
	import CategorySearch from './CategorySearch.svelte';
	import KeywordPicker from './KeywordPicker.svelte';
	import TranslateButton from './TranslateButton.svelte';
	import LocationPicker from './LocationPicker.svelte';

	/**
	 * Isian satu berkas di form upload multi-berkas. Kolomnya sama dengan form satu berkas sebelumnya;
	 * atribut `name` diberi akhiran id item supaya sorotan TranslateButton (cari `[name=…]`) mengenai
	 * kolom item ini, bukan kolom item pertama.
	 */
	let {
		item = $bindable(),
		index,
		total,
		categories,
		photographers,
		kwNames = $bindable({}),
		busy = false,
		onRemove,
		onCopyToAll
	}: {
		item: UploadItem;
		index: number;
		total: number;
		categories: { id: string; name: string }[];
		photographers: { id: string; name: string }[];
		kwNames?: Record<string, string>;
		/** Unggahan sedang berjalan: semua isian dikunci. */
		busy?: boolean;
		onRemove: () => void;
		onCopyToAll: () => void;
	} = $props();

	const n = (name: string) => `${name}-${item.id}`;
	// Tipe hanya yang cocok dengan berkasnya (foto → Foto/Foto eksklusif, video → Video/Video eksklusif).
	const typeOptions = $derived(PHOTO_TYPES.filter((t) => isVideoKey(t.key) === (item.kind === 'video')));
	const price = $derived(PHOTO_TYPES.find((t) => t.key === item.type)?.price ?? 0);
	const done = $derived(item.status === 'done');
	// Berkas sudah tersimpan tapi kategori/keyword gagal: hanya dua bagian itu yang masih bisa diubah.
	const fileSaved = $derived(!!item.photoId);
	const hasErrors = $derived(Object.values(item.errors).some(Boolean));

	let kwEnPicker = $state<ReturnType<typeof KeywordPicker>>();
	// Batas atas pemilih tanggal pengambilan (hari ini + 1 hari) — sama dengan validasi API.
	const takenMax = takenAtMax();

	function clearError(name: string) {
		if (item.errors[name]) item.errors = { ...item.errors, [name]: '' };
	}

	async function translateTitle() {
		const [en] = await translateToEn([item.title.trim()]);
		item.titleEn = (en ?? '').slice(0, 100);
	}
	async function translateDescription() {
		const [en] = await translateToEn([item.description.trim()]);
		item.descriptionEn = (en ?? '').slice(0, 500);
	}
	async function translateKeywords() {
		const names = item.keywords.map((id) => kwNames[id]).filter((x): x is string => !!x);
		if (!names.length) return;
		const en = await translateToEn(names, { list: true });
		await kwEnPicker?.addByNames(en.map((w) => w.trim().toLowerCase()).filter(Boolean));
	}
</script>

<div
	id="item-{item.id}"
	class={cn(
		'rounded-[3px] border hairline border-solid scroll-mt-6 transition-colors',
		item.status === 'error' || hasErrors ? 'border-safelight/60' : '',
		done ? 'opacity-70' : ''
	)}
>
	<div class="flex items-center gap-3 p-3 sm:p-4">
		<button
			type="button"
			onclick={() => (item.open = !item.open)}
			aria-expanded={item.open}
			class="flex min-w-0 flex-1 items-center gap-4 text-left"
		>
			<span class="w-6 shrink-0 font-mono text-[10px] text-ash-2 tnum">{String(index + 1).padStart(2, '0')}</span>
			{#if item.kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -- thumbnail pratinjau saja -->
				<video src={item.preview} muted preload="metadata" class="h-14 w-20 shrink-0 rounded-[3px] bg-ink/5 object-cover"></video>
			{:else}
				<img src={item.preview} alt="" class="h-14 w-20 shrink-0 rounded-[3px] bg-ink/5 object-cover" />
			{/if}
			<span class="min-w-0 flex-1">
				<span class={cn('block truncate text-sm', item.title.trim() ? 'text-ink' : 'text-ash-2 italic')}>
					{item.title.trim() || 'Belum berjudul'}
				</span>
				<span class="block truncate font-mono text-[10px] text-ash-2">
					{item.file.name} · {fileSizeLabel(item.file.size)} · {PHOTO_TYPES.find((t) => t.key === item.type)?.label}
				</span>
			</span>
			<span class="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]">
				{#if item.status === 'uploading'}
					<span class="inline-flex items-center gap-1.5 text-ash"><Spinner />Mengupload</span>
				{:else if done}
					<span class="text-ink">✓ Terupload</span>
				{:else if item.status === 'error'}
					<span class="text-safelight-dim">Gagal</span>
				{:else if hasErrors}
					<span class="text-safelight-dim">Belum lengkap</span>
				{/if}
			</span>
			<span aria-hidden="true" class={cn('shrink-0 text-ash-2 transition-transform', item.open ? 'rotate-180' : '')}>▾</span>
		</button>
		{#if !busy && !done}
			<button
				type="button"
				onclick={onRemove}
				aria-label="Hapus {item.file.name} dari daftar"
				title="Hapus dari daftar"
				class="shrink-0 rounded-[3px] px-2 py-1 text-ash-2 transition-colors hover:bg-ink/[0.04] hover:text-safelight"
			>
				✕
			</button>
		{/if}
	</div>

	{#if item.message}
		<p class="px-4 pb-3 font-mono text-xs text-safelight-dim">{item.message}</p>
	{/if}

	{#if item.open}
		<div class="space-y-5 border-t hairline border-solid p-5">
			<fieldset disabled={busy || done || fileSaved} class="space-y-5">
				<div class="grid gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]">
					<div>
						<span class={labelCls}>{item.kind === 'video' ? 'Video' : 'Foto'}</span>
						{#if item.kind === 'video'}
							<!-- svelte-ignore a11y_media_has_caption -- pratinjau saja -->
							<video src={item.preview} controls class="max-h-52 w-full rounded-[3px] bg-ink/5 object-contain"></video>
						{:else}
							<img src={item.preview} alt="Pratinjau {item.file.name}" class="max-h-52 w-full rounded-[3px] bg-ink/5 object-contain" />
						{/if}
					</div>
					<div class="space-y-5">
						<Field label="Tipe">
							<select name={n('type')} bind:value={item.type} class={inputCls}>
								{#each typeOptions as t (t.key)}
									<option value={t.key}>{t.label} — {formatPrice(t.price)}</option>
								{/each}
							</select>
							<p class="mt-1 font-mono text-[10px] text-ash-2">Harga otomatis dari tipe: {formatPrice(price)}</p>
						</Field>
						<Field label="Fotografer / Videografer">
							<select
								name={n('photographer')}
								bind:value={item.photographer}
								onchange={() => clearError('photographer')}
								class={inputCls}
							>
								<option value="">Pilih fotografer atau videografer…</option>
								{#each photographers as p (p.id)}
									<option value={p.name}>{p.name}</option>
								{/each}
							</select>
							{#if item.errors.photographer}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.photographer}</p>{/if}
						</Field>
					</div>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Judul (ID)">
						<input
							name={n('title')}
							bind:value={item.title}
							oninput={() => clearError('title')}
							maxlength={100}
							class={inputCls}
							placeholder="Masukkan judul"
						/>
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.title.length}/100</span>
						{#if item.errors.title}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.title}</p>{/if}
					</Field>
					<Field label="Title (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateTitle} disabled={!item.title.trim()} source={item.title.trim()} target={n('titleEn')} />{/snippet}
						<input name={n('titleEn')} bind:value={item.titleEn} maxlength={100} class={inputCls} placeholder="English title" />
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.titleEn.length}/100</span>
						{#if item.errors.titleEn}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.titleEn}</p>{/if}
					</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Lokasi (opsional)">
						<LocationPicker bind:value={item.location} />
					</Field>
					<!-- Waktu lokal browser; dikirim sebagai ISO (lihat uploadOne di halaman upload). -->
					<Field label="Tanggal & waktu pengambilan (opsional)">
						<input
							type="datetime-local"
							name={n('takenAt')}
							bind:value={item.takenAt}
							oninput={() => clearError('takenAt')}
							min={TAKEN_AT_MIN}
							max={takenMax}
							class={cn(inputCls, 'tnum')}
						/>
						{#if item.errors.takenAt}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.takenAt}</p>{/if}
					</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Deskripsi (ID) · opsional">
						<textarea
							name={n('description')}
							bind:value={item.description}
							maxlength={500}
							rows={3}
							class={cn(inputCls, 'resize-none')}
							placeholder="Deskripsi…"
						></textarea>
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.description.length}/500</span>
					</Field>
					<Field label="Description (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateDescription} disabled={!item.description.trim()} source={item.description.trim()} target={n('descriptionEn')} />{/snippet}
						<textarea
							name={n('descriptionEn')}
							bind:value={item.descriptionEn}
							maxlength={500}
							rows={3}
							class={cn(inputCls, 'resize-none')}
							placeholder="English description…"
						></textarea>
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.descriptionEn.length}/500</span>
					</Field>
				</div>
			</fieldset>

			<fieldset disabled={busy || done} class="space-y-5">
				<div>
					<span class={labelCls}>Category <span class="normal-case tracking-normal text-ash-2">(minimal 5)</span></span>
					<CategorySearch
						bind:selected={item.categories}
						{categories}
						invalid={item.categories.length < 5}
						error={item.errors.categories ?? ''}
						onChange={() => clearError('categories')}
					/>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<KeywordPicker
						bind:selected={item.keywords}
						bind:names={kwNames}
						lang="id"
						label="Keyword (ID)"
						invalid={item.keywords.length < 5}
						error={item.errors.keywords ?? ''}
						onChange={() => clearError('keywords')}
					/>
					<KeywordPicker bind:this={kwEnPicker} bind:selected={item.keywordsEn} bind:names={kwNames} lang="en" label="Keyword (EN)" min={0}>
						{#snippet action()}<TranslateButton label="Terjemahkan keyword ID" run={translateKeywords} disabled={!item.keywords.length} source={item.keywords.join(',')} />{/snippet}
					</KeywordPicker>
				</div>
			</fieldset>

			{#if total > 1 && !busy && !done}
				<div class="flex justify-end border-t hairline border-solid pt-4">
					<button
						type="button"
						onclick={onCopyToAll}
						class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash transition-colors hover:text-safelight"
						title="Judul, deskripsi & tanggal pengambilan tidak ikut disalin"
					>
						Salin fotografer, lokasi, kategori & keyword ke semua item →
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
