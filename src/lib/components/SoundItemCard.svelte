<script lang="ts">
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice } from '$lib/format';
	import { translateToEn } from '$lib/translate';
	import { SOUND_KINDS, defaultSoundPrice, fmtDuration, soundKindLabel, type SoundKind } from '$lib/sound-types';
	import { SOUND_MIN_CATEGORIES, SOUND_MIN_KEYWORDS, type SoundItem } from '$lib/sound-item';
	import { fileSizeLabel } from '$lib/upload-item';
	import Field from './Field.svelte';
	import Spinner from './Spinner.svelte';
	import CategorySearch from './CategorySearch.svelte';
	import KeywordPicker from './KeywordPicker.svelte';
	import TranslateButton from './TranslateButton.svelte';

	/**
	 * Isian satu audio di form unggah Sounds — pola kartu UploadItemCard (foto/video), dengan kolom khusus audio:
	 * jenis (musik / efek suara), tempo, sampul, dan pemutar pratinjau lokal. `artistMode`: admin memilih dari
	 * daftar Fotografer / Videografer, kontributor mengetik namanya sendiri.
	 */
	let {
		item = $bindable(),
		index,
		total,
		categories,
		photographers = [],
		artistMode = 'select',
		priceOptions,
		kwNames = $bindable({}),
		busy = false,
		onRemove,
		onCopyToAll
	}: {
		item: SoundItem;
		index: number;
		total: number;
		categories: { id: string; name: string }[];
		photographers?: { id: string; name: string }[];
		artistMode?: 'select' | 'text';
		priceOptions: number[];
		kwNames?: Record<string, string>;
		busy?: boolean;
		onRemove: () => void;
		onCopyToAll: () => void;
	} = $props();

	const n = (name: string) => `${name}-${item.id}`;
	const done = $derived(item.status === 'done');
	const fileSaved = $derived(!!item.photoId);
	const hasErrors = $derived(Object.values(item.errors).some(Boolean));
	const prices = $derived([...new Set([...priceOptions, item.price])].filter((p) => p > 0).sort((a, b) => a - b));

	let kwEnPicker = $state<ReturnType<typeof KeywordPicker>>();
	let coverInput = $state<HTMLInputElement>();

	function clearError(name: string) {
		if (item.errors[name]) item.errors = { ...item.errors, [name]: '' };
	}

	function pickKind(k: SoundKind) {
		// Harga ikut jenis bila masih harga bawaan jenis sebelumnya (tak menimpa harga yang dipilih manual).
		if (item.price === defaultSoundPrice(item.kind)) item.price = defaultSoundPrice(k);
		item.kind = k;
		if (k === 'SFX') item.bpm = '';
	}

	function pickCover(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
			item.errors = { ...item.errors, cover: 'Sampul harus JPG, PNG, atau WebP' };
			return;
		}
		if (item.coverPreview) URL.revokeObjectURL(item.coverPreview);
		item.cover = f;
		item.coverPreview = URL.createObjectURL(f);
		clearError('cover');
	}
	function clearCover() {
		if (item.coverPreview) URL.revokeObjectURL(item.coverPreview);
		item.cover = null;
		item.coverPreview = null;
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
			<span class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-ink text-paper">
				{#if item.coverPreview}
					<img src={item.coverPreview} alt="" class="h-full w-full object-cover" />
				{:else}
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></svg>
				{/if}
			</span>
			<span class="min-w-0 flex-1">
				<span class={cn('block truncate text-sm', item.title.trim() ? 'text-ink' : 'text-ash-2 italic')}>
					{item.title.trim() || 'Belum berjudul'}
				</span>
				<span class="block truncate font-mono text-[10px] text-ash-2">
					{item.file.name} · {fileSizeLabel(item.file.size)} · {fmtDuration(item.duration)} · {soundKindLabel(item.kind)}
				</span>
			</span>
			<span class="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]">
				{#if item.status === 'uploading'}
					<span class="inline-flex items-center gap-1.5 text-ash"><Spinner />Memproses</span>
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
				<!-- Pratinjau lokal + sampul -->
				<div class="grid gap-5 sm:grid-cols-[minmax(0,11rem)_1fr]">
					<div>
						<span class={labelCls}>Sampul · opsional</span>
						<button
							type="button"
							onclick={() => coverInput?.click()}
							class="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-[3px] border border-dashed border-ink/20 bg-ink/[0.03] text-center transition-colors hover:border-safelight"
						>
							{#if item.coverPreview}
								<img src={item.coverPreview} alt="Sampul {item.title}" class="absolute inset-0 h-full w-full object-cover" />
								<span class="absolute inset-x-0 bottom-0 bg-ink/70 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper opacity-0 transition-opacity group-hover:opacity-100">Ganti</span>
							{:else}
								<span class="px-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ash-2">Pilih gambar<br />(persegi)</span>
							{/if}
						</button>
						<input bind:this={coverInput} type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={pickCover} />
						{#if item.coverPreview}
							<button type="button" onclick={clearCover} class="mt-1.5 font-mono text-[10px] text-ash-2 hover:text-safelight">Hapus sampul</button>
						{:else}
							<p class="mt-1.5 font-mono text-[10px] leading-relaxed text-ash-2">Kosong = gambar gelombang otomatis</p>
						{/if}
						{#if item.errors.cover}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.cover}</p>{/if}
					</div>
					<div class="space-y-5">
						<div>
							<span class={labelCls}>Dengarkan</span>
							<audio src={item.preview} controls preload="metadata" class="w-full"></audio>
						</div>
						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<span class={labelCls}>Jenis</span>
								<div class="flex gap-2" role="radiogroup" aria-label="Jenis audio">
									{#each SOUND_KINDS as k (k.key)}
										<button
											type="button"
											role="radio"
											aria-checked={item.kind === k.key}
											onclick={() => pickKind(k.key)}
											class={cn(
												'flex-1 rounded-[3px] border px-3 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors',
												item.kind === k.key ? 'border-ink bg-ink text-paper' : 'hairline border-solid text-ash hover:text-ink'
											)}
										>
											{k.label}
										</button>
									{/each}
								</div>
							</div>
							<Field label="Harga">
								<select
									name={n('price')}
									value={String(item.price)}
									onchange={(e) => ((item.price = Number(e.currentTarget.value)), clearError('price'))}
									class={inputCls}
								>
									{#each prices as p (p)}
										<option value={String(p)}>{formatPrice(p)}</option>
									{/each}
								</select>
								{#if item.errors.price}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.price}</p>{/if}
							</Field>
						</div>
						<div class="grid gap-5 sm:grid-cols-2">
							<Field label="Kreator / komposer">
								{#if artistMode === 'select'}
									<select name={n('photographer')} bind:value={item.photographer} onchange={() => clearError('photographer')} class={inputCls}>
										<option value="">Pilih kreator…</option>
										{#each photographers as p (p.id)}
											<option value={p.name}>{p.name}</option>
										{/each}
									</select>
								{:else}
									<input name={n('photographer')} bind:value={item.photographer} oninput={() => clearError('photographer')} maxlength={80} class={inputCls} placeholder="Nama yang tampil di situs" />
								{/if}
								{#if item.errors.photographer}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.photographer}</p>{/if}
							</Field>
							<Field label={item.kind === 'SFX' ? 'Tempo (BPM) · tak dipakai efek suara' : 'Tempo (BPM) · opsional'}>
								<input
									name={n('bpm')}
									bind:value={item.bpm}
									oninput={() => clearError('bpm')}
									inputmode="numeric"
									maxlength={3}
									disabled={item.kind === 'SFX'}
									class={cn(inputCls, 'tnum disabled:opacity-50')}
									placeholder="mis. 96"
								/>
								{#if item.errors.bpm}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.bpm}</p>{/if}
							</Field>
						</div>
					</div>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Judul (ID)">
						<input name={n('title')} bind:value={item.title} oninput={() => clearError('title')} maxlength={100} class={inputCls} placeholder="Masukkan judul" />
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.title.length}/100</span>
						{#if item.errors.title}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{item.errors.title}</p>{/if}
					</Field>
					<Field label="Title (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateTitle} disabled={!item.title.trim()} source={item.title.trim()} target={n('titleEn')} />{/snippet}
						<input name={n('titleEn')} bind:value={item.titleEn} maxlength={100} class={inputCls} placeholder="English title" />
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.titleEn.length}/100</span>
					</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Deskripsi (ID) · opsional">
						<textarea name={n('description')} bind:value={item.description} maxlength={500} rows={3} class={cn(inputCls, 'resize-none')} placeholder="Suasana, alat musik, tempat rekaman…"></textarea>
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.description.length}/500</span>
					</Field>
					<Field label="Description (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateDescription} disabled={!item.description.trim()} source={item.description.trim()} target={n('descriptionEn')} />{/snippet}
						<textarea name={n('descriptionEn')} bind:value={item.descriptionEn} maxlength={500} rows={3} class={cn(inputCls, 'resize-none')} placeholder="English description…"></textarea>
						<span class="mt-1 block text-right font-mono text-[10px] text-ash-2 tnum">{item.descriptionEn.length}/500</span>
					</Field>
				</div>
			</fieldset>

			<fieldset disabled={busy || done} class="space-y-5">
				<div>
					<span class={labelCls}>Kategori — mood / genre <span class="normal-case tracking-normal text-ash-2">(minimal {SOUND_MIN_CATEGORIES})</span></span>
					<CategorySearch
						bind:selected={item.categories}
						{categories}
						invalid={item.categories.length < SOUND_MIN_CATEGORIES}
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
						min={SOUND_MIN_KEYWORDS}
						invalid={item.keywords.length < SOUND_MIN_KEYWORDS}
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
						title="Judul, deskripsi, sampul & tempo tidak ikut disalin"
					>
						Salin kreator, jenis, harga, kategori & keyword ke semua item →
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
