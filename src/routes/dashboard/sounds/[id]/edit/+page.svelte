<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice } from '$lib/format';
	import { loadPriceOptions } from '$lib/photo-types';
	import { translateToEn } from '$lib/translate';
	import { AUDIO_ACCEPT, AUDIO_HINT, SOUND_KINDS, defaultSoundPrice, fmtDuration, isAudioFile, withAudioMime, type SoundKind } from '$lib/sound-types';
	import { SOUND_MIN_CATEGORIES, SOUND_MIN_KEYWORDS } from '$lib/sound-item';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import CategorySearch from '$lib/components/CategorySearch.svelte';
	import KeywordPicker from '$lib/components/KeywordPicker.svelte';
	import TranslateButton from '$lib/components/TranslateButton.svelte';

	interface Named {
		id: string;
		name: string;
	}
	interface SoundDetail {
		id: string;
		type: string;
		title: string;
		titleEn?: string | null;
		description?: string | null;
		descriptionEn?: string | null;
		photographer: string;
		price: number;
		thumbUrl?: string | null;
		watermarkUrl?: string | null;
		duration?: number | null;
		bpm?: number | null;
		audioKind?: SoundKind | null;
		format?: string | null;
		photoCategories?: Array<{ category: Named }>;
		photoKeywords?: Array<{ keyword: Named & { lang?: 'id' | 'en' } }>;
	}

	// Di-encode: id dari URL tidak boleh membawa "../" ke path API (request bertoken admin).
	const id = encodeURIComponent(page.params.id ?? '');

	let fetching = $state(true);
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});
	let detail = $state<SoundDetail | null>(null);
	let form = $state({ title: '', titleEn: '', description: '', descriptionEn: '', photographer: '', price: 0, bpm: '', kind: 'MUSIC' as SoundKind });
	let categories = $state<Named[]>([]);
	let photographers = $state<Named[]>([]);
	let priceOptions = $state<number[]>(SOUND_KINDS.map((k) => k.price));
	const prices = $derived([...new Set([...priceOptions, form.price])].filter((p) => p > 0).sort((a, b) => a - b));
	let selectedCategories = $state<string[]>([]);
	let selectedKeywords = $state<string[]>([]);
	let selectedKeywordsEn = $state<string[]>([]);
	let kwNames = $state<Record<string, string>>({});
	let kwEnPicker = $state<ReturnType<typeof KeywordPicker>>();

	let audioFile = $state<File | null>(null);
	let audioPreview = $state<string | null>(null);
	let cover = $state<File | null>(null);
	let coverPreview = $state<string | null>(null);
	let audioInput = $state<HTMLInputElement>();
	let coverInput = $state<HTMLInputElement>();

	onMount(() => {
		void loadPriceOptions().then((o) => (priceOptions = [...new Set([...SOUND_KINDS.map((k) => k.price), ...o])].sort((a, b) => a - b)));
		void fetchAll();
		return () => {
			if (audioPreview) URL.revokeObjectURL(audioPreview);
			if (coverPreview) URL.revokeObjectURL(coverPreview);
		};
	});

	async function fetchAll() {
		fetching = true;
		try {
			const [cats, phs] = await Promise.all([api<Named[]>('/categories?limit=100'), api<Named[]>('/photographers?limit=200')]);
			categories = cats ?? [];
			photographers = phs ?? [];
		} catch (err) {
			console.error(err);
		}
		try {
			for (const k of (await api<Named[]>('/keywords?limit=200')) ?? []) kwNames[k.id] = k.name;
		} catch {
			/* abaikan */
		}
		try {
			const d = await api<SoundDetail>(`/photos/${id}`);
			if (d.type !== 'AUDIO') {
				// Bukan audio → editor Foto / Video.
				await goto(`/dashboard/photos/${id}/edit`, { replaceState: true });
				return;
			}
			detail = d;
			form = {
				title: d.title ?? '',
				titleEn: d.titleEn ?? '',
				description: d.description ?? '',
				descriptionEn: d.descriptionEn ?? '',
				photographer: d.photographer ?? '',
				price: d.price,
				bpm: d.bpm ? String(d.bpm) : '',
				kind: d.audioKind === 'SFX' ? 'SFX' : 'MUSIC'
			};
			if (form.photographer && !photographers.some((p) => p.name === form.photographer)) {
				photographers = [...photographers, { id: `cur-${form.photographer}`, name: form.photographer }];
			}
			selectedCategories = (d.photoCategories ?? []).map((pc) => pc.category.id);
			for (const pc of d.photoCategories ?? []) {
				if (!categories.some((c) => c.id === pc.category.id)) categories = [...categories, pc.category];
			}
			const kws = (d.photoKeywords ?? []).map((pk) => pk.keyword);
			selectedKeywords = kws.filter((k) => k.lang !== 'en').map((k) => k.id);
			selectedKeywordsEn = kws.filter((k) => k.lang === 'en').map((k) => k.id);
			for (const k of kws) kwNames[k.id] = k.name;
		} catch (err) {
			console.error(err);
			errors = { general: 'Gagal memuat audio' };
		} finally {
			fetching = false;
		}
	}

	function clearError(name: string) {
		if (errors[name]) errors = { ...errors, [name]: '' };
	}

	function pickKind(k: SoundKind) {
		if (form.price === defaultSoundPrice(form.kind)) form.price = defaultSoundPrice(k);
		form.kind = k;
		if (k === 'SFX') form.bpm = '';
	}

	function pickAudio(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		if (!isAudioFile(f)) {
			errors = { ...errors, file: 'Berkas pengganti harus audio' };
			return;
		}
		if (audioPreview) URL.revokeObjectURL(audioPreview);
		audioFile = withAudioMime(f);
		audioPreview = URL.createObjectURL(audioFile);
		clearError('file');
	}

	function pickCover(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
			errors = { ...errors, cover: 'Sampul harus JPG, PNG, atau WebP' };
			return;
		}
		if (coverPreview) URL.revokeObjectURL(coverPreview);
		cover = f;
		coverPreview = URL.createObjectURL(f);
		clearError('cover');
	}

	async function translateTitle() {
		const [en] = await translateToEn([form.title.trim()]);
		form.titleEn = (en ?? '').slice(0, 100);
	}
	async function translateDescription() {
		const [en] = await translateToEn([form.description.trim()]);
		form.descriptionEn = (en ?? '').slice(0, 500);
	}
	async function translateKeywords() {
		const names = selectedKeywords.map((k) => kwNames[k]).filter((x): x is string => !!x);
		if (!names.length) return;
		const en = await translateToEn(names, { list: true });
		await kwEnPicker?.addByNames(en.map((w) => w.trim().toLowerCase()).filter(Boolean));
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const next: Record<string, string> = {};
		if (!form.title.trim()) next.title = 'Judul harus diisi';
		if (!form.photographer.trim()) next.photographer = 'Kreator / komposer harus diisi';
		const bpm = form.bpm.trim();
		if (bpm && !(/^\d{2,3}$/.test(bpm) && Number(bpm) >= 20 && Number(bpm) <= 300)) next.bpm = 'BPM 20–300 (angka bulat)';
		if (selectedCategories.length < SOUND_MIN_CATEGORIES) next.categories = `Kategori minimal ${SOUND_MIN_CATEGORIES}`;
		if (selectedKeywords.length < SOUND_MIN_KEYWORDS) next.keywords = `Keyword minimal ${SOUND_MIN_KEYWORDS}`;
		if (Object.keys(next).length) {
			errors = next;
			return;
		}
		saving = true;
		try {
			const fd = new FormData();
			fd.append('title', form.title.trim());
			fd.append('titleEn', form.titleEn.trim());
			fd.append('description', form.description.trim());
			fd.append('descriptionEn', form.descriptionEn.trim());
			fd.append('photographer', form.photographer.trim());
			fd.append('price', String(form.price));
			fd.append('audioKind', form.kind);
			// '' = tempo dikosongkan.
			fd.append('bpm', form.kind === 'MUSIC' ? bpm : '');
			if (audioFile) fd.append('photo', audioFile);
			if (cover) fd.append('cover', cover);
			const res = await apiFetch(`/photos/${id}`, { method: 'PATCH', body: fd });
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as { error?: { message?: string | Record<string, string> }; message?: string } | null;
				const msg = j?.error?.message ?? j?.message;
				errors = typeof msg === 'object' && msg ? msg : { general: (msg as string) || `Gagal menyimpan (${res.status})` };
				return;
			}

			// Kategori & keyword: disinkronkan terhadap keadaan server (pola editor Foto / Video).
			const cur = await api<SoundDetail>(`/photos/${id}`);
			const haveCats = (cur.photoCategories ?? []).map((pc) => pc.category.id);
			for (const cid of haveCats) if (!selectedCategories.includes(cid)) await apiFetch(`/photos/${id}/categories/${cid}`, { method: 'DELETE' });
			const addCats = selectedCategories.filter((c) => !haveCats.includes(c));
			if (addCats.length) await api(`/photos/${id}/categories`, { method: 'POST', body: JSON.stringify({ categoryIds: addCats }) });
			const haveKws = (cur.photoKeywords ?? []).map((pk) => pk.keyword.id);
			const wanted = [...new Set([...selectedKeywords, ...selectedKeywordsEn])];
			for (const kid of haveKws) if (!wanted.includes(kid)) await apiFetch(`/photos/${id}/keywords/${kid}`, { method: 'DELETE' });
			const addKws = wanted.filter((k) => !haveKws.includes(k));
			if (addKws.length) await api(`/photos/${id}/keywords`, { method: 'POST', body: JSON.stringify({ keywordIds: addKws }) });

			await goto('/dashboard/sounds');
		} catch (err) {
			console.error(err);
			errors = { general: err instanceof ApiError ? err.message : 'Terjadi kesalahan' };
		} finally {
			saving = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio · Sounds" title="Edit Audio" class="mb-8">
		<a href="/dashboard/sounds"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>

	{#if fetching}
		<Panel class="p-7"><Skeleton class="h-96" /></Panel>
	{:else if !detail}
		<Panel class="p-7"><p class="font-mono text-xs text-safelight-dim">{errors.general || 'Audio tidak ditemukan'}</p></Panel>
	{:else}
		<Panel class="p-7">
			<form onsubmit={handleSubmit} class="space-y-6">
				<div class="grid gap-6 sm:grid-cols-[minmax(0,12rem)_1fr]">
					<div>
						<span class={labelCls}>Sampul</span>
						<button
							type="button"
							onclick={() => coverInput?.click()}
							class="group relative block aspect-square w-full overflow-hidden rounded-[3px] bg-ink"
						>
							{#if coverPreview || detail.thumbUrl}
								<img src={coverPreview || detail.thumbUrl} alt="Sampul {detail.title}" class="h-full w-full object-cover object-top" />
							{/if}
							<span class="absolute inset-x-0 bottom-0 bg-ink/70 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-paper opacity-0 transition-opacity group-hover:opacity-100">Ganti sampul</span>
						</button>
						<input bind:this={coverInput} type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={pickCover} />
						{#if errors.cover}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.cover}</p>{/if}
					</div>
					<div class="space-y-5">
						<div>
							<span class={labelCls}>
								{audioFile ? `Berkas baru — ${audioFile.name}` : `Pratinjau saat ini · ${(detail.format ?? '').toUpperCase()} · ${fmtDuration(detail.duration)}`}
							</span>
							<audio src={audioPreview || detail.watermarkUrl || ''} controls preload="metadata" class="w-full"></audio>
							<div class="mt-2 flex flex-wrap items-center gap-3">
								<button type="button" onclick={() => audioInput?.click()} class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash transition-colors hover:text-safelight">
									Ganti berkas audio →
								</button>
								<span class="font-mono text-[10px] text-ash-2">{AUDIO_HINT}</span>
							</div>
							<input bind:this={audioInput} type="file" accept={AUDIO_ACCEPT} class="hidden" onchange={pickAudio} />
							{#if errors.file}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.file}</p>{/if}
						</div>
						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<span class={labelCls}>Jenis</span>
								<div class="flex gap-2" role="radiogroup" aria-label="Jenis audio">
									{#each SOUND_KINDS as k (k.key)}
										<button
											type="button"
											role="radio"
											aria-checked={form.kind === k.key}
											onclick={() => pickKind(k.key)}
											class={cn(
												'flex-1 rounded-[3px] border px-3 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors',
												form.kind === k.key ? 'border-ink bg-ink text-paper' : 'hairline border-solid text-ash hover:text-ink'
											)}
										>
											{k.label}
										</button>
									{/each}
								</div>
							</div>
							<Field label="Harga">
								<select value={String(form.price)} onchange={(e) => (form.price = Number(e.currentTarget.value))} class={inputCls}>
									{#each prices as p (p)}
										<option value={String(p)}>{formatPrice(p)}</option>
									{/each}
								</select>
							</Field>
						</div>
						<div class="grid gap-5 sm:grid-cols-2">
							<Field label="Kreator / komposer">
								<select bind:value={form.photographer} onchange={() => clearError('photographer')} class={inputCls}>
									<option value="">Pilih kreator…</option>
									{#each photographers as p (p.id)}
										<option value={p.name}>{p.name}</option>
									{/each}
								</select>
								{#if errors.photographer}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.photographer}</p>{/if}
							</Field>
							<Field label="Tempo (BPM) · opsional">
								<input bind:value={form.bpm} oninput={() => clearError('bpm')} inputmode="numeric" maxlength={3} disabled={form.kind === 'SFX'} class={cn(inputCls, 'tnum disabled:opacity-50')} placeholder="mis. 96" />
								{#if errors.bpm}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.bpm}</p>{/if}
							</Field>
						</div>
					</div>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Judul (ID)">
						<input name="title" bind:value={form.title} oninput={() => clearError('title')} maxlength={100} class={inputCls} />
						{#if errors.title}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.title}</p>{/if}
					</Field>
					<Field label="Title (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateTitle} disabled={!form.title.trim()} source={form.title.trim()} target="titleEn" />{/snippet}
						<input name="titleEn" bind:value={form.titleEn} maxlength={100} class={inputCls} />
					</Field>
				</div>
				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Deskripsi (ID) · opsional">
						<textarea name="description" bind:value={form.description} maxlength={500} rows={3} class={cn(inputCls, 'resize-none')}></textarea>
					</Field>
					<Field label="Description (EN) · opsional">
						{#snippet action()}<TranslateButton run={translateDescription} disabled={!form.description.trim()} source={form.description.trim()} target="descriptionEn" />{/snippet}
						<textarea name="descriptionEn" bind:value={form.descriptionEn} maxlength={500} rows={3} class={cn(inputCls, 'resize-none')}></textarea>
					</Field>
				</div>

				<div>
					<span class={labelCls}>Kategori — mood / genre <span class="normal-case tracking-normal text-ash-2">(minimal {SOUND_MIN_CATEGORIES})</span></span>
					<CategorySearch
						bind:selected={selectedCategories}
						{categories}
						invalid={selectedCategories.length < SOUND_MIN_CATEGORIES}
						error={errors.categories ?? ''}
						onChange={() => clearError('categories')}
					/>
				</div>
				<div class="grid gap-5 sm:grid-cols-2">
					<KeywordPicker
						bind:selected={selectedKeywords}
						bind:names={kwNames}
						lang="id"
						label="Keyword (ID)"
						min={SOUND_MIN_KEYWORDS}
						invalid={selectedKeywords.length < SOUND_MIN_KEYWORDS}
						error={errors.keywords ?? ''}
						onChange={() => clearError('keywords')}
					/>
					<KeywordPicker bind:this={kwEnPicker} bind:selected={selectedKeywordsEn} bind:names={kwNames} lang="en" label="Keyword (EN)" min={0}>
						{#snippet action()}<TranslateButton label="Terjemahkan keyword ID" run={translateKeywords} disabled={!selectedKeywords.length} source={selectedKeywords.join(',')} />{/snippet}
					</KeywordPicker>
				</div>

				{#if errors.general}<p class="font-mono text-xs text-safelight-dim">{errors.general}</p>{/if}

				<Btn type="submit" variant="primary" disabled={saving} class="w-full">
					{#if saving}<Spinner />{audioFile ? 'Memproses audio…' : 'Menyimpan…'}{:else}Simpan{/if}
				</Btn>
			</form>
		</Panel>
	{/if}
</div>
