<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, apiFetch } from '$lib/api';
	import { formatPrice, localInputToIso, takenAtError, takenAtMax, TAKEN_AT_MIN } from '$lib/format';
	import { inputCls } from '$lib/ui-classes';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import UploadQuotaPanel from '$lib/components/UploadQuotaPanel.svelte';
	import { blockedMessage, fetchMyQuota, fileTooBig, type UploadQuota } from '$lib/upload-quota';



	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let form = $state({
		title: '',
		titleEn: '',
		photographer: '',
		price: '',
		description: '',
		descriptionEn: '',
		/** Tanggal & waktu pengambilan: nilai datetime-local (waktu lokal browser). */
		takenAt: '',
		type: 'FOTO'
	});
	const takenMax = takenAtMax();
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let fileType = $state<'image' | 'video'>('image');
	let pricePresets = $state<number[]>([]);
	/** Kuota unggah akun ini (null = belum/gagal dimuat — server tetap menegakkannya). */
	let quota = $state<UploadQuota | null>(null);

	function loadQuota() {
		fetchMyQuota()
			.then((q) => (quota = q))
			.catch(() => {});
	}

	onMount(() => {
		loadQuota();
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
		// Berkas melebihi batas ukuran kontributor ditolak di sini — tak perlu menunggu unggahan ratusan MB selesai.
		const tooBig = fileTooBig(selected, quota);
		if (tooBig) {
			errors = { ...errors, file: tooBig };
			(e.currentTarget as HTMLInputElement).value = '';
			return;
		}
		errors = { ...errors, file: '' };
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
		const takenErr = takenAtError(form.takenAt);
		if (takenErr) newErrors.takenAt = takenErr;
		if (Object.keys(newErrors).length > 0) {
			errors = newErrors;
			return;
		}
		const blocked = quota ? blockedMessage(quota) : null;
		if (blocked) {
			errors = { general: blocked };
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
			// datetime-local (waktu lokal browser) → ISO UTC.
			const takenAt = localInputToIso(form.takenAt);
			if (takenAt) formData.append('takenAt', takenAt);
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
				// Kuota habis / dicabut / unggahan lain berjalan: perbarui meteran supaya sebabnya terlihat.
				if ([403, 409, 413, 429].includes(res.status)) loadQuota();
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

</script>

<div>
	<div class="rise py-10">
		<SectionHeader index="01" kicker="Kontribusi" title="Upload Foto" class="mb-8" />

		{#if quota && !quota.unlimited}
			<UploadQuotaPanel {quota} class="mb-5" />
		{/if}

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

				<Field label="Tanggal & waktu pengambilan (opsional)">
					<input
						name="takenAt"
						type="datetime-local"
						value={form.takenAt}
						oninput={handleChange}
						min={TAKEN_AT_MIN}
						max={takenMax}
						class={cn(inputCls, 'tnum')}
					/>
					{#if errors.takenAt}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.takenAt}</p>{/if}
				</Field>

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

				<Btn type="submit" variant="primary" disabled={loading || quota?.canUpload === false} class="w-full">
					{#if loading}<Spinner />Mengupload{:else}Upload{/if}
				</Btn>
			</form>
		</Panel>
	</div>
</div>
