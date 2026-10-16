<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice, isoToLocalInput, localInputToIso, takenAtError, takenAtMax, TAKEN_AT_MIN } from '$lib/format';
	import {
		PHOTO_TYPES,
		loadPriceOptions,
		priceOptionsFrom,
		defaultPriceFor,
		fromApi,
		isVideoKey,
		toApi,
		type PhotoTypeKey
	} from '$lib/photo-types';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import CategorySearch from '$lib/components/CategorySearch.svelte';
	import KeywordPicker from '$lib/components/KeywordPicker.svelte';
	import TranslateButton from '$lib/components/TranslateButton.svelte';
	import { translateToEn } from '$lib/translate';
	import LocationPicker from '$lib/components/LocationPicker.svelte';

	interface Category {
		id: string;
		name: string;
	}

	interface Keyword {
		id: string;
		name: string;
		lang?: 'id' | 'en';
	}

	interface Photographer {
		id: string;
		name: string;
	}

	interface PhotoDetail {
		id: string;
		title: string;
		titleEn?: string | null;
		description?: string;
		descriptionEn?: string | null;
		photographer: string;
		location?: string;
		/** Tanggal & waktu pengambilan (ISO) atau null. */
		takenAt?: string | null;
		price: number;
		thumbUrl: string;
		type: 'FOTO' | 'VIDEO';
		isExclusive?: boolean;
		photoCategories?: Array<{ category: { id: string; name: string } }>;
		photoKeywords?: Array<{ keyword: { id: string; name: string; lang?: 'id' | 'en' } }>;
	}

	// Di-encode: id dari URL tidak boleh membawa "../" ke path API (request bertoken admin).
	const id = encodeURIComponent(page.params.id ?? '');

	let fetching = $state(true);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let form = $state({
		title: '',
		titleEn: '',
		photographer: '',
		location: '',
		/** Nilai datetime-local (waktu lokal browser); '' = kosong. */
		takenAt: '',
		price: '',
		description: '',
		descriptionEn: '',
		type: 'FOTO' as PhotoTypeKey
	});
	const takenMax = takenAtMax();
	const isVideo = $derived(isVideoKey(form.type));
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let fileType = $state<'image' | 'video'>('image');

	let categories = $state<Category[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedKeywords = $state<string[]>([]);
	let selectedKeywordsEn = $state<string[]>([]);

	// Harga lama yang tak ada di daftar baku (data lama) tetap muncul supaya tidak terbaca kosong.
	let basePrices = $state<number[]>(priceOptionsFrom());
	const priceOptions = $derived(priceOptionsFrom(basePrices, [Number(form.price)]));
	let photographers = $state<Photographer[]>([]);

	let kwNames = $state<Record<string, string>>({});
	let kwEnPicker = $state<ReturnType<typeof KeywordPicker>>();

	// Terjemah otomatis ID → EN (tombol di samping kolom EN). Hasil tetap bisa disunting sebelum disimpan.
	async function translateTitle() {
		const [en] = await translateToEn([form.title.trim()]);
		form.titleEn = (en ?? '').slice(0, 100);
	}
	async function translateDescription() {
		const [en] = await translateToEn([form.description.trim()]);
		form.descriptionEn = (en ?? '').slice(0, 500);
	}
	async function translateKeywords() {
		const names = selectedKeywords.map((id) => kwNames[id]).filter((n): n is string => !!n);
		if (!names.length) return;
		const en = await translateToEn(names, { list: true });
		await kwEnPicker?.addByNames(en.map((w) => w.trim().toLowerCase()).filter(Boolean));
	}

	let catInvalid = $derived(selectedCategories.length < 5);
	let kwInvalid = $derived(selectedKeywords.length < 5);

	onMount(() => {
		void loadPriceOptions().then((o) => (basePrices = o));
		void fetchAll();
	});

	async function fetchAll() {
		fetching = true;
		try {
			const [cats, photos] = await Promise.all([
				api<Category[]>('/categories'),
				api<Photographer[]>('/photographers?limit=200')
			]);
			categories = cats ?? [];
			photographers = photos ?? [];
		} catch (err) {
			console.error('Failed to fetch data:', err);
		}
		try {
			const all = await api<Keyword[]>('/keywords?limit=100');
			for (const k of all ?? []) kwNames[k.id] = k.name;
		} catch {
			/* abaikan */
		}
		try {
			const photo = await api<PhotoDetail>(`/photos/${id}`);
			form = {
				title: photo.title ?? '',
				titleEn: photo.titleEn ?? '',
				photographer: photo.photographer ?? '',
				location: photo.location ?? '',
				takenAt: isoToLocalInput(photo.takenAt),
				price: String(photo.price ?? ''),
				description: photo.description ?? '',
				descriptionEn: photo.descriptionEn ?? '',
				type: fromApi(photo.type, photo.isExclusive)
			};
			preview = photo.thumbUrl ?? null;
			fileType = photo.type === 'VIDEO' ? 'video' : 'image';
			selectedCategories = (photo.photoCategories?.map((pc) => pc.category?.id) ?? []).filter(
				(cid): cid is string => !!cid
			);
			const kwPairs = (photo.photoKeywords?.map((pk) => pk.keyword) ?? []).filter(
				(k): k is { id: string; name: string; lang?: 'id' | 'en' } => !!k?.id
			);
			// Keyword lama tanpa lang = Indonesia.
			selectedKeywords = kwPairs.filter((k) => k.lang !== 'en').map((k) => k.id);
			selectedKeywordsEn = kwPairs.filter((k) => k.lang === 'en').map((k) => k.id);
			for (const k of kwPairs) kwNames[k.id] = k.name;
			for (const pc of photo.photoCategories ?? []) {
				if (pc.category?.id && pc.category?.name)
					categories = categories.some((c) => c.id === pc.category.id)
						? categories
						: [...categories, { id: pc.category.id, name: pc.category.name }];
			}
		} catch (err) {
			console.error(err);
			errors = { general: 'Gagal memuat foto' };
		} finally {
			fetching = false;
		}
	}

	function clearError(name: string) {
		if (errors[name]) errors = { ...errors, [name]: '' };
	}

	function handleFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const selected = input.files?.[0];
		if (!selected) return;
		if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
		file = selected;
		fileType = selected.type.startsWith('video/') ? 'video' : 'image';
		preview = URL.createObjectURL(selected);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const next: Record<string, string> = {};
		if (!form.title.trim()) next.title = 'Title harus diisi';
		if (!form.photographer) next.photographer = 'Photographer harus diisi';
		if (!form.price) next.price = 'Price harus diisi';
		if (selectedCategories.length < 5) next.categories = 'Category minimal 5';
		if (selectedKeywords.length < 5) next.keywords = 'Keyword minimal 5';
		const takenErr = takenAtError(form.takenAt);
		if (takenErr) next.takenAt = takenErr;
		if (Object.keys(next).length > 0) {
			errors = next;
			return;
		}

		loading = true;
		try {
			const fd = new FormData();
			fd.append('title', form.title.trim());
			fd.append('photographer', form.photographer);
			fd.append('price', form.price);
			const api_ = toApi(form.type);
			fd.append('type', api_.type);
			fd.append('isExclusive', api_.isExclusive ? 'true' : 'false');
			// Selalu dikirim, termasuk string kosong, supaya field bisa dikosongkan.
			fd.append('description', form.description.trim());
			fd.append('titleEn', form.titleEn.trim());
			fd.append('descriptionEn', form.descriptionEn.trim());
			fd.append('location', form.location.trim());
			// datetime-local (waktu lokal) → ISO UTC; '' = tanggal pengambilan dikosongkan.
			fd.append('takenAt', localInputToIso(form.takenAt));
			if (file) fd.append('photo', file);

			const res = await apiFetch(`/photos/${id}`, { method: 'PATCH', body: fd });
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as {
					error?: { message?: string };
					message?: string | Record<string, string>;
				} | null;
				const msg = j?.error?.message ?? j?.message;
				errors =
					typeof msg === 'object'
						? (msg as Record<string, string>)
						: { general: (msg as string) || 'Terjadi kesalahan' };
				return;
			}

			// Diff-sync categories & keywords against current server state
			const current = await api<PhotoDetail>(`/photos/${id}`);
			const existingCatIds = (current.photoCategories?.map((pc) => pc.category?.id) ?? []).filter(
				(cid): cid is string => !!cid
			);
			for (const cid of existingCatIds) {
				if (!selectedCategories.includes(cid)) {
					await apiFetch(`/photos/${id}/categories/${cid}`, { method: 'DELETE' });
				}
			}
			const newCatIds = selectedCategories.filter((cid) => !existingCatIds.includes(cid));
			if (newCatIds.length > 0) {
				await api(`/photos/${id}/categories`, {
					method: 'POST',
					body: JSON.stringify({ categoryIds: newCatIds })
				});
			}

			const existingKwIds = (current.photoKeywords?.map((pk) => pk.keyword?.id) ?? []).filter(
				(kid): kid is string => !!kid
			);
			// Keyword ID + EN disinkronkan sebagai satu himpunan terhadap keadaan server.
			const wantedKwIds = [...new Set([...selectedKeywords, ...selectedKeywordsEn])];
			for (const kid of existingKwIds) {
				if (!wantedKwIds.includes(kid)) {
					await apiFetch(`/photos/${id}/keywords/${kid}`, { method: 'DELETE' });
				}
			}
			const newKwIds = wantedKwIds.filter((kid) => !existingKwIds.includes(kid));
			if (newKwIds.length > 0) {
				await api(`/photos/${id}/keywords`, {
					method: 'POST',
					body: JSON.stringify({ keywordIds: newKwIds })
				});
			}

			await goto('/dashboard/photos');
		} catch (err) {
			console.error(err);
			errors = { general: err instanceof ApiError ? err.message : 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Edit Photo / Video" class="mb-8">
		<a href="/dashboard/photos"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>

	{#if fetching}
		<Skeleton class="h-10 w-40 mb-6" />
		<Panel class="p-7 space-y-5">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
				class="h-12"
			/>
		</Panel>
	{:else}
		<Panel class="p-7">
			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}
					<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>
				{/if}

				<Field label="Tipe">
					<select
						name="type"
						bind:value={form.type}
						onchange={() => {
							// Mengganti tipe otomatis memilih harga tipe itu (tetap bisa diubah di kolom Harga).
							form.price = String(defaultPriceFor(form.type));
							clearError('price');
						}}
						class={inputCls}
					>
						{#each PHOTO_TYPES as t (t.key)}
							<option value={t.key}>{t.label} — {formatPrice(t.price)}</option>
						{/each}
					</select>
				</Field>

				<div>
					<span class={labelCls}>{isVideo ? 'Video' : 'Foto'}</span>
					<button
						type="button"
						onclick={() => document.getElementById('fileInput')?.click()}
						class="w-full border border-dashed border-ink/20 rounded-[3px] p-5 text-center cursor-pointer hover:border-safelight hover:bg-ink/[0.02] transition-colors"
					>
						{#if preview}
							{#if fileType === 'video'}
								<video src={preview} class="mx-auto max-h-60 rounded-[3px] object-cover" controls></video>
							{:else}
								<img src={preview} alt="preview" class="mx-auto max-h-60 rounded-[3px] object-cover" />
							{/if}
						{:else}
							<span class="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
								Klik untuk ganti {isVideo ? 'video' : 'foto'}
							</span>
						{/if}
					</button>
					<input
						id="fileInput"
						name="photo"
						type="file"
						accept="image/*,video/*"
						class="hidden"
						onchange={handleFile}
					/>
					<p class="mt-1 font-mono text-[10px] text-ash-2">
						JPG, PNG, GIF, MP4, WebM, MOV · maks 100MB untuk video
					</p>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Judul (ID)">
					<input
						name="title"
						bind:value={form.title}
						oninput={() => clearError('title')}
						maxlength={100}
						class={inputCls}
						placeholder="Masukkan judul foto"
					/>
					<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
						{form.title.length}/100
					</span>
					{#if errors.title}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.title}</p>{/if}
				</Field>

				<Field label="Title (EN) · opsional">
					{#snippet action()}<TranslateButton run={translateTitle} disabled={!form.title.trim()} source={form.title.trim()} target="titleEn" />{/snippet}
					<input
						name="titleEn"
						bind:value={form.titleEn}
						maxlength={100}
						class={inputCls}
						placeholder="English title"
					/>
					<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
						{form.titleEn.length}/100
					</span>
					{#if errors.titleEn}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.titleEn}</p>{/if}
				</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Fotografer">
					<select
						name="photographer"
						bind:value={form.photographer}
						onchange={() => clearError('photographer')}
						class={inputCls}
					>
						<option value="">Pilih fotografer…</option>
						{#each photographers as p (p.id)}
							<option value={p.name}>{p.name}</option>
						{/each}
					</select>
					{#if errors.photographer}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.photographer}</p>{/if}
				</Field>
				<Field label="Harga · otomatis dari tipe">
					<select
						disabled
						title="Harga mengikuti tipe aset"
						name="price"
						bind:value={form.price}
						onchange={() => clearError('price')}
						class={cn(inputCls, 'tnum disabled:cursor-not-allowed disabled:opacity-70')}
					>
						<option value="">Pilih harga…</option>
						{#each priceOptions as p (p)}
							<option value={String(p)}>{formatPrice(p)}</option>
						{/each}
					</select>
					{#if errors.price}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.price}</p>{/if}
				</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Lokasi (opsional)">
					<LocationPicker bind:value={form.location} />
				</Field>
				<Field label="Tanggal & waktu pengambilan (opsional)">
					<input
						type="datetime-local"
						name="takenAt"
						bind:value={form.takenAt}
						oninput={() => clearError('takenAt')}
						min={TAKEN_AT_MIN}
						max={takenMax}
						class={cn(inputCls, 'tnum')}
					/>
					{#if errors.takenAt}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.takenAt}</p>{/if}
				</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Deskripsi (ID) · opsional">
					<textarea
						name="description"
						bind:value={form.description}
						maxlength={500}
						rows={4}
						class={cn(inputCls, 'resize-none')}
						placeholder="Deskripsi foto…"
					></textarea>
					<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
						{form.description.length}/500
					</span>
				</Field>

				<Field label="Description (EN) · opsional">
					{#snippet action()}<TranslateButton run={translateDescription} disabled={!form.description.trim()} source={form.description.trim()} target="descriptionEn" />{/snippet}
					<textarea
						name="descriptionEn"
						bind:value={form.descriptionEn}
						maxlength={500}
						rows={4}
						class={cn(inputCls, 'resize-none')}
						placeholder="English description…"
					></textarea>
					<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
						{form.descriptionEn.length}/500
					</span>
				</Field>
				</div>

				<div>
					<span class={labelCls}>Category <span class="text-ash-2 normal-case tracking-normal">(minimal 5)</span></span>
					<CategorySearch
						bind:selected={selectedCategories}
						{categories}
						invalid={catInvalid}
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
					invalid={kwInvalid}
					error={errors.keywords ?? ''}
					onChange={() => clearError('keywords')}
				/>

				<KeywordPicker
					bind:this={kwEnPicker}
					bind:selected={selectedKeywordsEn}
					bind:names={kwNames}
					lang="en"
					label="Keyword (EN)"
					min={0}
				>
					{#snippet action()}<TranslateButton label="Terjemahkan keyword ID" run={translateKeywords} disabled={!selectedKeywords.length} source={selectedKeywords.join(",")} />{/snippet}
				</KeywordPicker>
				</div>

				<Btn type="submit" variant="primary" disabled={loading} class="w-full">
					{#if loading}<Spinner />Menyimpan{:else}Simpan Perubahan{/if}
				</Btn>
			</form>
		</Panel>
	{/if}
</div>
