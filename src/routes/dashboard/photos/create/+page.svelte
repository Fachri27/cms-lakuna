<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import CategorySearch from '$lib/components/CategorySearch.svelte';
	import KeywordPicker from '$lib/components/KeywordPicker.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';

	interface Category {
		id: string;
		name: string;
	}

	interface Keyword {
		id: string;
		name: string;
	}

	interface Photographer {
		id: string;
		name: string;
	}

	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let form = $state({
		title: '',
		titleEn: '',
		photographer: '',
		location: '',
		price: '',
		description: '',
		descriptionEn: '',
		type: 'FOTO'
	});
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let fileType = $state<'image' | 'video'>('image');

	let categories = $state<Category[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedKeywords = $state<string[]>([]);
	let selectedKeywordsEn = $state<string[]>([]);

	let pricePresets = $state<number[]>([]);
	let photographers = $state<Photographer[]>([]);

	let kwNames = $state<Record<string, string>>({});

	let catInvalid = $derived(selectedCategories.length < 5);
	let kwInvalid = $derived(selectedKeywords.length < 5);

	onMount(() => {
		void fetchInitial();
	});

	async function fetchInitial() {
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
			const preset = await api<{ value: string }>('/settings/photo_price_presets');
			pricePresets = JSON.parse(preset?.value || '[]');
		} catch {
			pricePresets = [];
		}
		try {
			const all = await api<Keyword[]>('/keywords?limit=200');
			for (const k of all ?? []) kwNames[k.id] = k.name;
		} catch {
			/* nama keyword tetap tampil sebagai id */
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
		clearError('file');
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const next: Record<string, string> = {};
		if (!form.title.trim()) next.title = 'Title harus diisi';
		if (!form.photographer) next.photographer = 'Photographer harus diisi';
		if (!form.price) next.price = 'Price harus diisi';
		if (!file) next.file = 'Photo/Video harus diupload';
		if (selectedCategories.length < 5) next.categories = 'Category minimal 5';
		if (selectedKeywords.length < 5) next.keywords = 'Keyword minimal 5';
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
			fd.append('type', form.type);
			if (form.description.trim()) fd.append('description', form.description.trim());
			if (form.titleEn.trim()) fd.append('titleEn', form.titleEn.trim());
			if (form.descriptionEn.trim()) fd.append('descriptionEn', form.descriptionEn.trim());
			if (form.location.trim()) fd.append('location', form.location.trim());
			fd.append('photo', file as File);

			const res = await apiFetch('/photos', { method: 'POST', body: fd });
			const json = (await res.json().catch(() => null)) as {
				data?: { id?: string };
				error?: { message?: string };
				message?: string | Record<string, string>;
			} | null;
			if (!res.ok) {
				const msg = json?.error?.message ?? json?.message;
				errors = typeof msg === 'object' ? (msg as Record<string, string>) : { general: (msg as string) || 'Terjadi kesalahan' };
				return;
			}
			const photoId = json?.data?.id;
			if (!photoId) {
				errors = { general: 'Upload berhasil tetapi id foto tidak ditemukan' };
				return;
			}
			if (selectedCategories.length > 0) {
				await api(`/photos/${photoId}/categories`, {
					method: 'POST',
					body: JSON.stringify({ categoryIds: selectedCategories })
				});
			}
			const keywordIds = [...new Set([...selectedKeywords, ...selectedKeywordsEn])];
			if (keywordIds.length > 0) {
				await api(`/photos/${photoId}/keywords`, {
					method: 'POST',
					body: JSON.stringify({ keywordIds })
				});
			}
			await goto('/dashboard/photos');
		} catch (err) {
			console.error(err);
			errors =
				err instanceof ApiError && typeof err.payload === 'object' && err.payload !== null
					? ((err.payload as { message?: Record<string, string> }).message ?? {
							general: err.message
						})
					: { general: err instanceof ApiError ? err.message : 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Upload Photo / Video" class="mb-8">
		<a href="/dashboard/photos"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>

	<Panel class="p-7">
		<form onsubmit={handleSubmit} class="space-y-5">
			{#if errors.general}
				<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>
			{/if}

			<Field label="Tipe">
				<select
					name="type"
					bind:value={form.type}
					onchange={() => clearError('type')}
					class={inputCls}
				>
					<option value="FOTO">Foto</option>
					<option value="VIDEO">Video</option>
				</select>
				{#if errors.type}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.type}</p>{/if}
			</Field>

			<div>
				<span class={labelCls}>{form.type === 'VIDEO' ? 'Video' : 'Foto'}</span>
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
							Klik untuk upload {form.type === 'VIDEO' ? 'video' : 'foto'}
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
				{#if errors.file}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.file}</p>{/if}
			</div>

			<div class="grid gap-5 sm:grid-cols-2">
			<Field label="Judul (ID)">
				<input
					name="title"
					bind:value={form.title}
					oninput={() => clearError('title')}
					maxlength={100}
					class={inputCls}
					placeholder="Masukkan judul"
				/>
				<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
					{form.title.length}/100
				</span>
				{#if errors.title}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.title}</p>{/if}
			</Field>

			<Field label="Title (EN) · opsional">
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

			<Field label="Harga">
				<input
					name="price"
					type="number"
					min={0}
					bind:value={form.price}
					oninput={() => clearError('price')}
					class={cn(inputCls, 'tnum')}
					placeholder="0"
				/>
				{#if pricePresets.length > 0}
					<div class="flex flex-wrap gap-1.5 mt-2">
						{#each pricePresets as p (p)}
							<button
								type="button"
								onclick={() => {
									form.price = String(p);
									clearError('price');
								}}
								class={cn(
									'px-2.5 py-1 rounded-[3px] text-xs border hairline border-solid transition-colors tnum',
									Number(form.price) === p
										? 'bg-ink text-paper border-ink'
										: 'text-ink hover:bg-ink/[0.04]'
								)}
							>
								{formatPrice(p)}
							</button>
						{/each}
					</div>
				{/if}
				{#if errors.price}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.price}</p>{/if}
			</Field>
			</div>

			<Field label="Lokasi (opsional)">
				<LocationPicker bind:value={form.location} />
			</Field>

			<div class="grid gap-5 sm:grid-cols-2">
			<Field label="Deskripsi (ID) · opsional">
				<textarea
					name="description"
					bind:value={form.description}
					maxlength={500}
					rows={4}
					class={cn(inputCls, 'resize-none')}
					placeholder="Deskripsi…"
				></textarea>
				<span class="block text-right mt-1 font-mono text-[10px] text-ash-2 tnum">
					{form.description.length}/500
				</span>
			</Field>

			<Field label="Description (EN) · opsional">
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
				bind:selected={selectedKeywordsEn}
				bind:names={kwNames}
				lang="en"
				label="Keyword (EN)"
				min={0}
			/>
			</div>

			<Btn type="submit" variant="primary" disabled={loading} class="w-full">
				{#if loading}<Spinner />Mengupload{:else}Upload{/if}
			</Btn>
		</form>
	</Panel>
</div>
