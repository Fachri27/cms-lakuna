<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { api, apiFetch, ApiError } from '$lib/api';
	import { labelCls, cn } from '$lib/ui-classes';
	import { loadPriceOptions } from '$lib/photo-types';
	import { AUDIO_ACCEPT, AUDIO_HINT, SOUND_KINDS, defaultSoundPrice, isAudioFile, readDuration, withAudioMime } from '$lib/sound-types';
	import { newSoundItem, releaseSoundItem, validateSound, type SoundItem } from '$lib/sound-item';
	import { blockedMessage, fileTooBig, type UploadQuota } from '$lib/upload-quota';
	import Btn from './Btn.svelte';
	import Spinner from './Spinner.svelte';
	import SoundItemCard from './SoundItemCard.svelte';

	/**
	 * Form unggah Sounds multi-berkas — terpisah dari unggah Foto / Video. Berkas dikirim SATU PER SATU
	 * (POST /photos: tipe AUDIO otomatis dari berkasnya, lalu kategori & keyword); yang gagal tetap di daftar dengan
	 * pesannya dan "Upload" lagi hanya mengulang yang belum berhasil. Dipakai admin (Studio › Sounds) dan kontributor.
	 */
	let {
		artistMode = 'select',
		quota = null,
		onFinished
	}: {
		artistMode?: 'select' | 'text';
		/** Kuota kontributor (null = admin / belum dimuat — server tetap menegakkannya). */
		quota?: UploadQuota | null;
		/** Semua berkas berhasil (admin: pindah ke daftar; kontributor: muat ulang daftar & kuota). */
		onFinished: (count: number) => void;
	} = $props();

	interface Named {
		id: string;
		name: string;
	}

	let items = $state<SoundItem[]>([]);
	let categories = $state<Named[]>([]);
	let photographers = $state<Named[]>([]);
	let kwNames = $state<Record<string, string>>({});
	let priceOptions = $state<number[]>(SOUND_KINDS.map((k) => k.price));
	let uploading = $state(false);
	let progress = $state({ at: 0, of: 0 });
	let general = $state('');
	let dragOver = $state(false);
	let fileInput = $state<HTMLInputElement>();

	const pendingCount = $derived(items.filter((i) => i.status !== 'done').length);

	onMount(() => {
		void (async () => {
			try {
				categories = (await api<Named[]>('/categories?limit=100')) ?? [];
			} catch {
				/* daftar kategori kosong — pilih lagi nanti */
			}
			if (artistMode === 'select') {
				photographers = (await api<Named[]>('/photographers?limit=200').catch(() => [])) ?? [];
			}
			try {
				for (const k of (await api<Named[]>('/keywords?limit=200')) ?? []) kwNames[k.id] = k.name;
			} catch {
				/* nama keyword tampil sebagai id */
			}
			const presets = await loadPriceOptions();
			priceOptions = [...new Set([...SOUND_KINDS.map((k) => k.price), ...presets])].sort((a, b) => a - b);
		})();
		return () => items.forEach(releaseSoundItem);
	});

	function addFiles(list: FileList | File[] | null | undefined) {
		const all = [...(list ?? [])];
		if (!all.length) return;
		const audio = all.filter(isAudioFile).map(withAudioMime);
		const tooBig = audio.map((f) => [f, fileTooBig(f, quota)] as const).filter(([, m]) => m);
		const ok = audio.filter((f) => !tooBig.some(([b]) => b === f));
		const skipped = all.length - audio.length;
		const first = items.length === 0;
		const fresh = ok.map((f, i) => newSoundItem(f, first && i === 0));
		items.push(...fresh);
		// Durasi dibaca peramban; berkas < 30 dtk yang belum diubah jenisnya dianggap efek suara.
		for (const it of fresh) {
			void readDuration(it.preview).then((d) => {
				const live = items.find((x) => x.id === it.id);
				if (!live) return;
				live.duration = d;
				if (d > 0 && d < 30 && live.kind === 'MUSIC' && live.price === defaultSoundPrice('MUSIC')) {
					live.kind = 'SFX';
					live.price = defaultSoundPrice('SFX');
				}
			});
		}
		const notes: string[] = [];
		if (skipped) notes.push(`${skipped} berkas dilewati — halaman ini hanya untuk audio (foto & video lewat menu Foto / Video)`);
		for (const [f, m] of tooBig) notes.push(`${f.name}: ${m}`);
		general = notes.join(' · ');
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		addFiles(input.files);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (!uploading) addFiles(e.dataTransfer?.files);
	}

	function removeItem(id: string) {
		const it = items.find((x) => x.id === id);
		if (it) releaseSoundItem(it);
		items = items.filter((x) => x.id !== id);
	}

	function copyToAll(src: SoundItem) {
		for (const it of items) {
			if (it === src || it.status === 'done') continue;
			it.photographer = src.photographer;
			it.kind = src.kind;
			it.price = src.price;
			if (src.kind === 'SFX') it.bpm = '';
			it.categories = [...src.categories];
			it.keywords = [...src.keywords];
			it.keywordsEn = [...src.keywordsEn];
			it.errors = { ...it.errors, photographer: '', categories: '', keywords: '' };
		}
		general = `Isian dari item ${items.indexOf(src) + 1} disalin ke ${items.length - 1} item lain`;
	}

	async function uploadOne(it: SoundItem) {
		it.status = 'uploading';
		it.message = '';
		try {
			if (!it.photoId) {
				const fd = new FormData();
				fd.append('title', it.title.trim());
				fd.append('photographer', it.photographer.trim());
				fd.append('price', String(it.price));
				fd.append('type', 'AUDIO');
				fd.append('audioKind', it.kind);
				if (it.kind === 'MUSIC' && it.bpm.trim()) fd.append('bpm', it.bpm.trim());
				if (it.description.trim()) fd.append('description', it.description.trim());
				if (it.titleEn.trim()) fd.append('titleEn', it.titleEn.trim());
				if (it.descriptionEn.trim()) fd.append('descriptionEn', it.descriptionEn.trim());
				fd.append('photo', it.file);
				if (it.cover) fd.append('cover', it.cover);

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
					it.message = 'Upload berhasil tetapi id audio tidak ditemukan';
					return;
				}
				it.photoId = id;
			}
			if (it.categories.length > 0) {
				await api(`/photos/${it.photoId}/categories`, { method: 'POST', body: JSON.stringify({ categoryIds: it.categories }) });
			}
			const keywordIds = [...new Set([...it.keywords, ...it.keywordsEn])];
			if (keywordIds.length > 0) {
				await api(`/photos/${it.photoId}/keywords`, { method: 'POST', body: JSON.stringify({ keywordIds }) });
			}
			it.status = 'done';
			it.open = false;
		} catch (err) {
			console.error(err);
			it.status = 'error';
			it.open = true;
			const msg = err instanceof ApiError ? err.message : 'Koneksi terputus';
			it.message = it.photoId
				? `Audio sudah tersimpan, tetapi kategori/keyword gagal disimpan (${msg}). Klik Upload untuk mencoba lagi.`
				: msg;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		general = '';
		if (!items.length) {
			general = 'Pilih minimal satu berkas audio';
			return;
		}
		const blocked = quota ? blockedMessage(quota) : null;
		if (blocked) {
			general = blocked;
			return;
		}
		let firstBad: SoundItem | null = null;
		for (const it of items) {
			if (it.status === 'done') continue;
			it.errors = validateSound(it);
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
			const count = items.length;
			items.forEach(releaseSoundItem);
			items = [];
			onFinished(count);
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

<form onsubmit={handleSubmit} class="space-y-5">
	<div>
		<span class={labelCls}>Berkas audio <span class="normal-case tracking-normal text-ash-2">(bisa lebih dari satu)</span></span>
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
				{items.length ? 'Tambah audio lagi' : 'Klik atau seret musik / efek suara ke sini'}
			</span>
		</button>
		<input bind:this={fileInput} type="file" accept={AUDIO_ACCEPT} multiple class="hidden" onchange={onPick} />
		<p class="mt-1 font-mono text-[10px] text-ash-2">
			{AUDIO_HINT} · pratinjau MP3 bertanda suara & gelombang dibuat otomatis · berkas asli hanya untuk pembeli
		</p>
	</div>

	{#if items.length}
		<div class="space-y-3">
			{#each items as item, i (item.id)}
				<SoundItemCard
					bind:item={items[i]}
					bind:kwNames
					index={i}
					total={items.length}
					{categories}
					{photographers}
					{artistMode}
					{priceOptions}
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
			Upload {pendingCount} audio
		{:else}
			Upload
		{/if}
	</Btn>
</form>
