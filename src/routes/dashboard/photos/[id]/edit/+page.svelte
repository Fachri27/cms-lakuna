<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import { formatPrice } from '$lib/format';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import CategorySearch from '$lib/components/CategorySearch.svelte';
	import KeywordPicker from '$lib/components/KeywordPicker.svelte';

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

	interface PhotoDetail {
		id: string;
		title: string;
		description?: string;
		photographer: string;
		location?: string;
		price: number;
		thumbUrl: string;
		type: 'FOTO' | 'VIDEO';
		photoCategories?: Array<{ category: { id: string; name: string } }>;
		photoKeywords?: Array<{ keyword: { id: string; name: string } }>;
	}

	const id = page.params.id;

	let fetching = $state(true);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let form = $state({
		title: '',
		photographer: '',
		location: '',
		price: '',
		description: '',
		type: 'FOTO'
	});
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let fileType = $state<'image' | 'video'>('image');

	let categories = $state<Category[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedKeywords = $state<string[]>([]);

	let pricePresets = $state<number[]>([]);
	let photographers = $state<Photographer[]>([]);

	let kwNames = $state<Record<string, string>>({});

	let catInvalid = $derived(selectedCategories.length < 5);
	let kwInvalid = $derived(selectedKeywords.length < 5);

	onMount(() => {
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
			const preset = await api<{ value: string }>('/settings/photo_price_presets');
			pricePresets = JSON.parse(preset?.value || '[]');
		} catch {
			pricePresets = [];
		}
		try {
			const all = await api<Keyword[]>('/keywords?limit=200');
			for (const k of all ?? []) kwNames[k.id] = k.name;
		} catch {
			/* abaikan */
		}
		try {
			const photo = await api<PhotoDetail>(`/photos/${id}`);
			form = {
				title: photo.title ?? '',
				photographer: photo.photographer ?? '',
				location: photo.location ?? '',
				price: String(photo.price ?? ''),
				description: photo.description ?? '',
				type: photo.type ?? 'FOTO'
			};
			preview = photo.thumbUrl ?? null;
			fileType = photo.type === 'VIDEO' ? 'video' : 'image';
			selectedCategories = (photo.photoCategories?.map((pc) => pc.category?.id) ?? []).filter(
				(cid): cid is string => !!cid
			);
			const kwPairs = (photo.photoKeywords?.map((pk) => pk.keyword) ?? []).filter(
				(k): k is { id: string; name: string } => !!k?.id
			);
			selectedKeywords = kwPairs.map((k) => k.id);
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
			// Selalu dikirim, termasuk string kosong, supaya field bisa dikosongkan.
			fd.append('description', form.description.trim());
			fd.append('location', form.location.trim());
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
			for (const kid of existingKwIds) {
				if (!selectedKeywords.includes(kid)) {
					await apiFetch(`/photos/${id}/keywords/${kid}`, { method: 'DELETE' });
				}
			}
			const newKwIds = selectedKeywords.filter((kid) => !existingKwIds.includes(kid));
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
					<select name="type" bind:value={form.type} class={inputCls}>
						<option value="FOTO">Foto</option>
						<option value="VIDEO">Video</option>
					</select>
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
								Klik untuk ganti {form.type === 'VIDEO' ? 'video' : 'foto'}
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
				<Field label="Judul">
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
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Lokasi (opsional)">
					<input
						name="location"
						bind:value={form.location}
						maxlength={200}
						class={inputCls}
						placeholder="Contoh: Bromo, Jawa Timur"
					/>
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

				<Field label="Deskripsi (opsional)">
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

				<div class="grid gap-5 sm:grid-cols-2">
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

				<KeywordPicker
					bind:selected={selectedKeywords}
					bind:names={kwNames}
					invalid={kwInvalid}
					error={errors.keywords ?? ''}
					onChange={() => clearError('keywords')}
				/>
				</div>

				<Btn type="submit" variant="primary" disabled={loading} class="w-full">
					{#if loading}<Spinner />Menyimpan{:else}Simpan Perubahan{/if}
				</Btn>
			</form>
		</Panel>
	{/if}
</div>
