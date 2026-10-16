<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { labelCls, cn } from '$lib/ui-classes';
	import { toApi, defaultPriceFor } from '$lib/photo-types';
	import { localInputToIso } from '$lib/format';
	import { newUploadItem, validateItem, type UploadItem } from '$lib/upload-item';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import UploadItemCard from '$lib/components/UploadItemCard.svelte';

	/**
	 * Upload multi-berkas: pilih/seret beberapa foto & video sekaligus, lalu tiap berkas diisi sendiri
	 * (judul, deskripsi, fotografer, lokasi, tanggal pengambilan, kategori, keyword) di kartunya masing-masing. Saat "Upload",
	 * berkas dikirim SATU PER SATU (POST /photos lalu kategori & keyword) — video bisa ratusan MB dan
	 * server pernah OOM saat menerima banyak unggahan sekaligus. Yang gagal tetap di daftar dengan
	 * pesannya; "Upload" lagi hanya mengulang yang belum berhasil.
	 */

	interface Named {
		id: string;
		name: string;
	}

	let items = $state<UploadItem[]>([]);
	let categories = $state<Named[]>([]);
	let photographers = $state<Named[]>([]);
	let kwNames = $state<Record<string, string>>({});
	let uploading = $state(false);
	let progress = $state({ at: 0, of: 0 });
	let general = $state('');
	let dragOver = $state(false);
	let fileInput = $state<HTMLInputElement>();

	const pendingCount = $derived(items.filter((i) => i.status !== 'done').length);

	onMount(() => {
		void fetchInitial();
		// Pratinjau blob: dilepas saat halaman ditinggalkan.
		return () => {
			for (const it of items) URL.revokeObjectURL(it.preview);
		};
	});

	async function fetchInitial() {
		try {
			const [cats, phs] = await Promise.all([
				api<Named[]>('/categories'),
				api<Named[]>('/photographers?limit=200')
			]);
			categories = cats ?? [];
			photographers = phs ?? [];
		} catch (err) {
			console.error('Failed to fetch data:', err);
		}
		try {
			const all = await api<Named[]>('/keywords?limit=200');
			for (const k of all ?? []) kwNames[k.id] = k.name;
		} catch {
			/* nama keyword tetap tampil sebagai id */
		}
	}

	function addFiles(list: FileList | File[] | null | undefined) {
		const all = [...(list ?? [])];
		if (!all.length) return;
		const media = all.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
		const skipped = all.length - media.length;
		const first = items.length === 0;
		items.push(...media.map((f, i) => newUploadItem(f, first && i === 0)));
		general = skipped ? `${skipped} berkas dilewati — hanya foto atau video yang bisa diupload` : '';
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		addFiles(input.files);
		// Kosongkan supaya memilih berkas yang sama lagi tetap memicu change.
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (!uploading) addFiles(e.dataTransfer?.files);
	}

	function removeItem(id: string) {
		const it = items.find((x) => x.id === id);
		if (it) URL.revokeObjectURL(it.preview);
		items = items.filter((x) => x.id !== id);
	}

	/** Fotografer, lokasi, kategori & keyword item ini → semua item lain yang belum terupload. */
	function copyToAll(src: UploadItem) {
		for (const it of items) {
			if (it === src || it.status === 'done') continue;
			it.photographer = src.photographer;
			it.location = src.location;
			it.categories = [...src.categories];
			it.keywords = [...src.keywords];
			it.keywordsEn = [...src.keywordsEn];
			it.errors = { ...it.errors, photographer: '', categories: '', keywords: '' };
		}
		general = `Isian dari item ${items.indexOf(src) + 1} disalin ke ${items.length - 1} item lain`;
	}

	async function uploadOne(it: UploadItem) {
		it.status = 'uploading';
		it.message = '';
		try {
			if (!it.photoId) {
				const fd = new FormData();
				fd.append('title', it.title.trim());
				fd.append('photographer', it.photographer);
				fd.append('price', String(defaultPriceFor(it.type)));
				// Eksklusif = tipe FOTO/VIDEO + penanda isExclusive (galeri dan filter tak berubah).
				const t = toApi(it.type);
				fd.append('type', t.type);
				if (t.isExclusive) fd.append('isExclusive', 'true');
				if (it.description.trim()) fd.append('description', it.description.trim());
				if (it.titleEn.trim()) fd.append('titleEn', it.titleEn.trim());
				if (it.descriptionEn.trim()) fd.append('descriptionEn', it.descriptionEn.trim());
				if (it.location.trim()) fd.append('location', it.location.trim());
				// datetime-local (waktu lokal browser) → ISO UTC.
				const takenAt = localInputToIso(it.takenAt);
				if (takenAt) fd.append('takenAt', takenAt);
				fd.append('photo', it.file);

				const res = await apiFetch('/photos', { method: 'POST', body: fd });
				const json = (await res.json().catch(() => null)) as {
					data?: { id?: string };
					error?: { message?: string | Record<string, string> };
					message?: string | Record<string, string>;
				} | null;
				if (!res.ok) {
					const msg = json?.error?.message ?? json?.message;
					if (msg && typeof msg === 'object') {
						it.errors = msg;
						it.message = 'Periksa isian yang ditandai';
					} else {
						it.message = msg || `Upload gagal (${res.status})`;
					}
					it.status = 'error';
					it.open = true;
					return;
				}
				const id = json?.data?.id;
				if (!id) {
					it.status = 'error';
					it.message = 'Upload berhasil tetapi id foto tidak ditemukan';
					return;
				}
				it.photoId = id;
			}
			if (it.categories.length > 0) {
				await api(`/photos/${it.photoId}/categories`, {
					method: 'POST',
					body: JSON.stringify({ categoryIds: it.categories })
				});
			}
			const keywordIds = [...new Set([...it.keywords, ...it.keywordsEn])];
			if (keywordIds.length > 0) {
				await api(`/photos/${it.photoId}/keywords`, {
					method: 'POST',
					body: JSON.stringify({ keywordIds })
				});
			}
			it.status = 'done';
			it.open = false;
		} catch (err) {
			console.error(err);
			it.status = 'error';
			it.open = true;
			const msg = err instanceof ApiError ? err.message : 'Koneksi terputus';
			it.message = it.photoId
				? `Berkas sudah tersimpan, tetapi kategori/keyword gagal disimpan (${msg}). Klik Upload untuk mencoba lagi.`
				: msg;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		general = '';
		if (!items.length) {
			general = 'Pilih minimal satu foto atau video';
			return;
		}
		let firstBad: UploadItem | null = null;
		for (const it of items) {
			if (it.status === 'done') continue;
			it.errors = validateItem(it);
			if (Object.values(it.errors).some(Boolean)) {
				it.open = true;
				firstBad ??= it;
			}
		}
		if (firstBad) {
			general = 'Lengkapi isian yang ditandai dulu';
			await tick();
			document.getElementById(`item-${firstBad.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}

		uploading = true;
		const todo = items.filter((i) => i.status !== 'done');
		progress = { at: 0, of: todo.length };
		for (const it of todo) {
			progress.at += 1;
			await uploadOne(it);
		}
		uploading = false;

		const failed = items.filter((i) => i.status !== 'done');
		if (!failed.length) {
			for (const it of items) URL.revokeObjectURL(it.preview);
			await goto('/dashboard/photos');
			return;
		}
		general = `${items.length - failed.length} berhasil, ${failed.length} gagal. Periksa item yang ditandai, lalu klik Upload lagi.`;
		await tick();
		document.getElementById(`item-${failed[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Jangan sampai tab tertutup / pindah halaman di tengah unggahan tanpa sengaja.
	$effect(() => {
		if (!uploading) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Upload Photo / Video" class="mb-8">
		<a href="/dashboard/photos"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>

	<Panel class="p-7">
		<form onsubmit={handleSubmit} class="space-y-5">
			<div>
				<span class={labelCls}>Foto / Video <span class="normal-case tracking-normal text-ash-2">(bisa lebih dari satu)</span></span>
				<button
					type="button"
					disabled={uploading}
					onclick={() => fileInput?.click()}
					ondragover={(e) => {
						e.preventDefault();
						dragOver = true;
					}}
					ondragleave={() => (dragOver = false)}
					ondrop={onDrop}
					class={cn(
						'w-full cursor-pointer rounded-[3px] border border-dashed p-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60',
						dragOver ? 'border-safelight bg-ink/[0.04]' : 'border-ink/20 hover:border-safelight hover:bg-ink/[0.02]'
					)}
				>
					<span class="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
						{items.length ? 'Tambah berkas lagi' : 'Klik atau seret foto/video ke sini'}
					</span>
				</button>
				<input bind:this={fileInput} type="file" accept="image/*,video/*" multiple class="hidden" onchange={onPick} />
				<p class="mt-1 font-mono text-[10px] text-ash-2">
					JPG, PNG, GIF, MP4, WebM, MOV · maks 100MB untuk video · tiap berkas diisi judul &amp; datanya sendiri
				</p>
			</div>

			{#if items.length}
				<div class="space-y-3">
					{#each items as item, i (item.id)}
						<UploadItemCard
							bind:item={items[i]}
							bind:kwNames
							index={i}
							total={items.length}
							{categories}
							{photographers}
							busy={uploading}
							onRemove={() => removeItem(item.id)}
							onCopyToAll={() => copyToAll(item)}
						/>
					{/each}
				</div>
			{/if}

			{#if general}
				<p class="font-mono text-xs text-safelight-dim">{general}</p>
			{/if}

			<Btn type="submit" variant="primary" disabled={uploading || !pendingCount} class="w-full">
				{#if uploading}
					<Spinner />Mengupload {progress.at}/{progress.of}
				{:else if items.length > 1}
					Upload {pendingCount} berkas
				{:else}
					Upload
				{/if}
			</Btn>
		</form>
	</Panel>
</div>
