<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, apiFetch, clearTokens } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls } from '$lib/ui-classes';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	const NAV = [
		{ label: 'Dashboard', href: '/dashboard/contributor' },
		{ label: 'Upload', href: '/dashboard/contributor/upload' },
		{ label: 'Penghasilan', href: '/dashboard/contributor/earnings' }
	];

	const pathname = $derived($page.url.pathname);

	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let form = $state({
		title: '',
		titleEn: '',
		photographer: '',
		price: '',
		description: '',
		descriptionEn: '',
		type: 'FOTO'
	});
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let fileType = $state<'image' | 'video'>('image');
	let pricePresets = $state<number[]>([]);

	onMount(() => {
		api<{ value?: string }>('/settings/photo_price_presets')
			.then((d) => {
				pricePresets = JSON.parse(d?.value || '[]');
			})
			.catch(() => {});
	});

	function handleChange(e: Event) {
		const el = e.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
		form = { ...form, [el.name]: el.value };
		errors = { ...errors, [el.name]: '' };
	}

	function handleFile(e: Event) {
		const selected = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!selected) return;
		file = selected;
		fileType = selected.type.startsWith('video/') ? 'video' : 'image';
		preview = URL.createObjectURL(selected);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const newErrors: Record<string, string> = {};
		if (!form.title) newErrors.title = 'Title harus diisi';
		if (!form.photographer) newErrors.photographer = 'Photographer harus diisi';
		if (!form.price) newErrors.price = 'Price harus diisi';
		if (!file) newErrors.file = 'Photo/Video harus diupload';
		if (Object.keys(newErrors).length > 0) {
			errors = newErrors;
			return;
		}
		loading = true;
		try {
			const formData = new FormData();
			formData.append('title', form.title);
			formData.append('photographer', form.photographer);
			formData.append('price', form.price);
			formData.append('type', form.type);
			if (form.description) formData.append('description', form.description);
			if (form.titleEn.trim()) formData.append('titleEn', form.titleEn.trim());
			if (form.descriptionEn.trim()) formData.append('descriptionEn', form.descriptionEn.trim());
			formData.append('photo', file as File);
			const res = await apiFetch('/photos', { method: 'POST', body: formData });
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				const msg = json?.error?.message ?? json?.message;
				if (msg && typeof msg === 'object') {
					errors = msg as Record<string, string>;
				} else {
					errors = { general: (msg as string) || 'Terjadi kesalahan' };
				}
				return;
			}
			alert('Foto berhasil diupload dan menunggu persetujuan admin');
			goto('/dashboard/contributor');
		} catch (err) {
			errors = { general: (err as Error)?.message || 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}

	function logout() {
		clearTokens();
		goto('/login');
	}
</script>

<div class="min-h-screen">
	<header class="bg-ink text-paper rounded-[3px]">
		<div class="px-6 pt-6 pb-4 flex items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2.5">
					<span aria-hidden="true" class="text-safelight text-lg leading-none">▣</span>
					<span class="font-display text-[1.4rem] leading-none tracking-[-0.01em]">Lakuna</span>
				</div>
				<p class="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40 pl-7">
					Kontributor
				</p>
			</div>
			<button
				onclick={logout}
				class="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/55 hover:text-safelight transition-colors"
			>
				Keluar
			</button>
		</div>
		<nav class="px-6 pb-5 flex gap-2">
			{#each NAV as item}
				{@const active = pathname === item.href}
				<a
					href={item.href}
					class={cn(
						'px-3.5 py-2 rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors',
						active ? 'bg-paper/[0.08] text-paper' : 'text-paper/55 hover:text-paper/90 hover:bg-paper/[0.04]'
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<div class="rise py-10">
		<SectionHeader index="01" kicker="Kontribusi" title="Upload Foto" class="mb-8" />

		<Panel class="p-7">
			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>{/if}

				<Field label="Tipe">
					<select name="type" value={form.type} onchange={handleChange} class={inputCls}>
						<option value="FOTO">Foto</option>
						<option value="VIDEO">Video</option>
					</select>
				</Field>

				<Field label={form.type === 'VIDEO' ? 'Video' : 'Foto'}>
					<div
						class="border border-dashed border-ink/20 rounded-[3px] p-5 text-center cursor-pointer hover:border-safelight hover:bg-ink/[0.02] transition-colors"
						onclick={() => document.getElementById('fileInput')?.click()}
						onkeydown={(e) => {
							if ((e as KeyboardEvent).key === 'Enter')
								document.getElementById('fileInput')?.click();
						}}
						role="button"
						tabindex="0"
					>
						{#if preview}
							{#if fileType === 'video'}
								<!-- svelte-ignore a11y_media_has_caption -- video preview only -->
								<video src={preview} class="mx-auto max-h-60 rounded-[3px] object-cover" controls></video>
							{:else}
								<img src={preview} alt="preview" class="mx-auto max-h-60 rounded-[3px] object-cover" />
							{/if}
						{:else}
							<p class="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
								Klik untuk upload {form.type === 'VIDEO' ? 'video' : 'foto'}
							</p>
						{/if}
					</div>
					<input id="fileInput" type="file" accept="image/*,video/*" class="hidden" onchange={handleFile} />
					{#if errors.file}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.file}</p>{/if}
				</Field>

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Judul (ID)">
					<input
						name="title"
						value={form.title}
						oninput={handleChange}
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
						value={form.titleEn}
						oninput={handleChange}
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
					<input
						name="photographer"
						type="text"
						value={form.photographer}
						oninput={handleChange}
						maxlength={100}
						class={inputCls}
						placeholder="Nama fotografer (bebas)"
					/>
					{#if errors.photographer}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.photographer}</p>{/if}
				</Field>
				<Field label="Harga">
					<input
						name="price"
						type="number"
						min={0}
						value={form.price}
						oninput={handleChange}
						class={cn(inputCls, 'tnum')}
						placeholder="0"
					/>
					{#if pricePresets.length > 0}
						<div class="flex flex-wrap gap-1.5 mt-2">
							{#each pricePresets as p (p)}
								<button
									type="button"
									onclick={() => {
										form = { ...form, price: String(p) };
										errors = { ...errors, price: '' };
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

				<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Deskripsi (ID) · opsional">
					<textarea
						name="description"
						value={form.description}
						oninput={handleChange}
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
						value={form.descriptionEn}
						oninput={handleChange}
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

				<Btn type="submit" variant="primary" disabled={loading} class="w-full">
					{#if loading}<Spinner />Mengupload{:else}Upload{/if}
				</Btn>
			</form>
		</Panel>
	</div>
</div>
