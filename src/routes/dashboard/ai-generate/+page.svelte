<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import {
		ASPECT_LABEL,
		PHOTO_STATUS_LABEL,
		STATUS_LABEL,
		isOpen,
		type AiAspect,
		type AiConfig,
		type AiJob,
		type AiPhoto,
		type AiType
	} from '$lib/ai-generate';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Field from '$lib/components/Field.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	/**
	 * AI Generate: prompt → penyedia AI (API /ai-generations, diproses di latar) → tiap hasil otomatis masuk tabel
	 * foto/video sebagai "Menunggu kurasi" berkategori "AI Generated". Kurasi di sini atau di Persetujuan; hanya yang
	 * disetujui yang tayang.
	 */

	type Named = { id: string; name: string };

	let config = $state<AiConfig | null>(null);
	let loadError = $state('');
	let categories = $state<Named[]>([]);
	let presets = $state<number[]>([]);

	let form = $state({
		type: 'FOTO' as AiType,
		prompt: '',
		aspectRatio: '3:2' as AiAspect,
		count: 2,
		price: '',
		title: '',
		keywords: '',
		categoryIds: [] as string[]
	});
	let submitting = $state(false);
	let formMsg = $state('');

	let jobs = $state<AiJob[]>([]);
	let jobsLoading = $state(true);
	let page = $state(1);
	let totalPages = $state(1);

	let limitsOpen = $state(false);
	let limitDraft = $state({ image: '', video: '' });
	let limitMsg = $state('');

	/** Pratinjau besar + kurasi satu hasil. */
	let preview = $state<{ job: AiJob; photo: AiPhoto } | null>(null);
	let rejectNote = $state('');
	let acting = $state<string | null>(null);
	let actMsg = $state('');

	const provider = $derived(form.type === 'VIDEO' ? config?.video : config?.image);
	const limit = $derived(form.type === 'VIDEO' ? config?.limits.video : config?.limits.image);
	const wanted = $derived(form.type === 'VIDEO' ? 1 : form.count);
	const overLimit = $derived(!!limit && limit.remaining !== null && wanted > limit.remaining);
	const AI_CATEGORY = 'AI Generated';

	onMount(() => {
		void loadConfig();
		void loadJobs();
		void (async () => {
			try {
				const [cats, pr] = await Promise.all([
					api<Named[]>('/categories'),
					api<{ value?: string }>('/settings/photo_price_presets')
				]);
				categories = (cats ?? []).filter((c) => c.name !== AI_CATEGORY);
				presets = JSON.parse(pr?.value || '[]');
				if (!form.price && presets.length) form.price = String(presets[Math.min(1, presets.length - 1)]);
			} catch {
				// kategori/preset opsional — form tetap bisa dipakai
			}
		})();
		// Pantau permintaan yang masih diproses.
		const t = setInterval(() => {
			if (jobs.some((j) => isOpen(j.status))) void refreshOpen();
		}, 3000);
		return () => clearInterval(t);
	});

	async function loadConfig() {
		try {
			config = await api<AiConfig>('/ai-generations/config');
			limitDraft = { image: String(config.limits.image.limit), video: String(config.limits.video.limit) };
			// Rasio pertama yang didukung penyedia.
			const asp = (form.type === 'VIDEO' ? config.video : config.image)?.aspects ?? [];
			if (asp.length && !asp.includes(form.aspectRatio)) form.aspectRatio = asp.includes('3:2') ? '3:2' : asp[0];
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Gagal memuat';
		}
	}

	async function loadJobs(p = 1) {
		try {
			const r = await apiEnvelope<AiJob[]>(`/ai-generations?page=${p}&limit=10`);
			jobs = p === 1 ? r.data : [...jobs, ...r.data.filter((j) => !jobs.some((x) => x.id === j.id))];
			page = p;
			totalPages = r.meta?.totalPages ?? 1;
		} catch (err) {
			console.error(err);
		} finally {
			jobsLoading = false;
		}
	}

	/** Perbarui hanya permintaan yang masih berjalan (hemat permintaan). */
	async function refreshOpen() {
		const open = jobs.filter((j) => isOpen(j.status));
		const fresh = await Promise.all(open.map((j) => api<AiJob>(`/ai-generations/${j.id}`).catch(() => j)));
		const byId = new Map(fresh.map((j) => [j.id, j]));
		jobs = jobs.map((j) => byId.get(j.id) ?? j);
		if (fresh.some((j) => !isOpen(j.status))) void loadConfig();
	}

	function setType(t: AiType) {
		form.type = t;
		const asp = (t === 'VIDEO' ? config?.video : config?.image)?.aspects ?? [];
		if (!asp.includes(form.aspectRatio)) form.aspectRatio = t === 'VIDEO' ? '16:9' : asp.includes('3:2') ? '3:2' : asp[0];
	}

	function toggleCategory(id: string) {
		form.categoryIds = form.categoryIds.includes(id) ? form.categoryIds.filter((x) => x !== id) : [...form.categoryIds, id];
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formMsg = '';
		const price = Number(form.price);
		if (form.prompt.trim().length < 5) return (formMsg = 'Prompt minimal 5 karakter');
		if (!Number.isInteger(price) || price < 0) return (formMsg = 'Harga tidak valid');
		submitting = true;
		try {
			const job = await api<AiJob>('/ai-generations', {
				method: 'POST',
				headers: { 'Idempotency-Key': crypto.randomUUID() },
				body: JSON.stringify({
					type: form.type,
					prompt: form.prompt.trim(),
					aspectRatio: form.aspectRatio,
					count: wanted,
					price,
					title: form.title.trim() || undefined,
					keywords: form.keywords.trim() || undefined,
					categoryIds: form.categoryIds.length ? form.categoryIds : undefined
				})
			});
			jobs = [{ ...job, creator: null, photos: [] }, ...jobs];
			formMsg = 'Diantrekan — hasil muncul di bawah dan otomatis masuk antre kurasi';
			void loadConfig();
		} catch (err) {
			formMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			submitting = false;
		}
	}

	function reuse(j: AiJob) {
		setType(j.type);
		form.prompt = j.prompt;
		form.aspectRatio = j.aspectRatio;
		form.count = j.type === 'VIDEO' ? 1 : Math.min(j.count, config?.maxImagesPerRequest ?? 4);
		form.price = String(j.price);
		form.title = j.title ?? '';
		form.keywords = j.keywords ?? '';
		form.categoryIds = (j.categoryIds ?? []).filter((id) => categories.some((c) => c.id === id));
		formMsg = '';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function saveLimits() {
		limitMsg = '';
		const img = Number(limitDraft.image);
		const vid = Number(limitDraft.video);
		if (!Number.isInteger(img) || img < 0 || img > 1000) return (limitMsg = 'Gambar: 0–1.000');
		if (!Number.isInteger(vid) || vid < 0 || vid > 100) return (limitMsg = 'Video: 0–100');
		try {
			await api('/settings/ai_image_daily_limit', { method: 'PATCH', body: JSON.stringify({ value: String(img) }) });
			await api('/settings/ai_video_daily_limit', { method: 'PATCH', body: JSON.stringify({ value: String(vid) }) });
			limitMsg = 'Tersimpan';
			await loadConfig();
		} catch (err) {
			limitMsg = `Gagal${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
		}
	}

	/* ── Kurasi ── */

	function patchPhoto(jobId: string, photoId: string, patch: Partial<AiPhoto>) {
		jobs = jobs.map((j) => (j.id === jobId ? { ...j, photos: j.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)) } : j));
		if (preview?.photo.id === photoId) preview = { ...preview, photo: { ...preview.photo, ...patch } };
	}

	async function approve(job: AiJob, photo: AiPhoto) {
		acting = photo.id;
		actMsg = '';
		try {
			await api(`/photos/${photo.id}/approve`, { method: 'PATCH' });
			patchPhoto(job.id, photo.id, { status: 'APPROVED', rejectNote: null });
		} catch (err) {
			actMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			acting = null;
		}
	}

	async function reject(job: AiJob, photo: AiPhoto) {
		acting = photo.id;
		actMsg = '';
		try {
			const note = rejectNote.trim() || undefined;
			await api(`/photos/${photo.id}/reject`, { method: 'PATCH', body: JSON.stringify({ note }) });
			patchPhoto(job.id, photo.id, { status: 'REJECTED', rejectNote: note ?? null });
			rejectNote = '';
		} catch (err) {
			actMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			acting = null;
		}
	}

	async function approveAll(job: AiJob) {
		const n = job.photos.filter((p) => p.status === 'PENDING').length;
		if (!confirm(`Setujui ${n} hasil yang masih menunggu kurasi? Semuanya langsung tayang di situs.`)) return;
		acting = job.id;
		try {
			await api(`/ai-generations/${job.id}/approve-all`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
			for (const p of job.photos) if (p.status === 'PENDING') patchPhoto(job.id, p.id, { status: 'APPROVED' });
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Gagal');
		} finally {
			acting = null;
		}
	}

	const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const pendingOf = (j: AiJob) => j.photos.filter((p) => p.status === 'PENDING').length;
	const remainingLabel = (l: { remaining: number | null }) => (l.remaining === null ? 'tanpa batas' : `sisa ${l.remaining}`);
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="AI Generate" class="mb-3" />
	<p class="text-sm text-ash mb-10 max-w-2xl">
		Tulis prompt, AI membuat foto atau video, lalu setiap hasil otomatis masuk katalog berkategori
		<span class="text-ink">AI Generated</span> dengan status menunggu kurasi. Hanya hasil yang disetujui yang tayang.
	</p>

	{#if loadError}
		<p class="text-sm text-safelight-dim mb-8">{loadError}</p>
	{/if}

	<div class="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
		<!-- Formulir -->
		<Panel class="p-7 xl:sticky xl:top-6">
			<Kicker class="mb-5">Prompt baru</Kicker>
			{#if !config}
				<Skeleton class="h-72" />
			{:else}
				<form onsubmit={submit} class="space-y-5">
					<div class="grid grid-cols-2 gap-2">
						{#each [{ t: 'FOTO', label: 'Foto', p: config.image }, { t: 'VIDEO', label: 'Video', p: config.video }] as opt (opt.t)}
							<button
								type="button"
								onclick={() => setType(opt.t as AiType)}
								disabled={!opt.p?.configured}
								class={cn(
									'border hairline rounded-[3px] px-3 py-2.5 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
									form.type === opt.t ? 'border-safelight bg-safelight-soft' : 'hover:bg-ink/[0.03]'
								)}
							>
								<span class="block text-sm text-ink">{opt.label}</span>
								<span class="block font-mono text-[10px] text-ash-2 truncate">
									{opt.p?.configured ? `${opt.p.provider} · ${opt.p.model}` : 'Belum dipasang'}
								</span>
							</button>
						{/each}
					</div>
					{#if provider?.provider === 'SIMULASI'}
						<p class="text-[11px] font-mono text-ash border-l-2 border-ash-2 pl-3 py-1">
							Mode SIMULASI (lokal): hasilnya gambar/video contoh, bukan buatan AI sungguhan.
						</p>
					{:else if !provider?.configured}
						<p class="text-[11px] font-mono text-safelight-dim border-l-2 border-safelight pl-3 py-1">
							Penyedia {form.type === 'VIDEO' ? 'video' : 'gambar'} AI belum dipasang di server API
							({form.type === 'VIDEO' ? 'AI_VIDEO_PROVIDER' : 'AI_IMAGE_PROVIDER'} + kunci API).
						</p>
					{/if}

					<div>
						<div class="flex items-baseline justify-between">
							<label class={labelCls} for="ai-prompt">Prompt</label>
							<span class="font-mono text-[10px] text-ash-2 tnum">{form.prompt.length}/2000</span>
						</div>
						<textarea
							id="ai-prompt"
							bind:value={form.prompt}
							maxlength={2000}
							rows={6}
							placeholder="mis. Terraced rice fields in Bali at sunrise, mist over the valley, a farmer with a straw hat, photorealistic"
							class={cn(inputCls, 'resize-y leading-relaxed')}
						></textarea>
						<p class="mt-1.5 font-mono text-[10px] text-ash-2">
							Bahasa Inggris atau Indonesia. Hindari tokoh nyata, merek, dan karya berhak cipta.
						</p>
					</div>

					<div>
						<p class={labelCls}>Rasio</p>
						<div class="flex flex-wrap gap-2">
							{#each provider?.aspects ?? [] as a (a)}
								<button
									type="button"
									onclick={() => (form.aspectRatio = a)}
									class={cn(
										'font-mono text-[11px] px-3 py-1.5 rounded-[3px] border hairline',
										form.aspectRatio === a ? 'border-safelight text-safelight' : 'text-ink hover:bg-ink/[0.04]'
									)}>{ASPECT_LABEL[a]}</button
								>
							{/each}
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						{#if form.type === 'FOTO'}
							<Field label="Jumlah hasil">
								<select bind:value={form.count} class={inputCls}>
									{#each Array.from({ length: config.maxImagesPerRequest }, (_, i) => i + 1) as n (n)}
										<option value={n}>{n}</option>
									{/each}
								</select>
							</Field>
						{/if}
						<Field label="Harga" class={form.type === 'VIDEO' ? 'col-span-2' : ''}>
							{#if presets.length}
								<select bind:value={form.price} class={inputCls}>
									{#each presets as p (p)}<option value={String(p)}>{formatPrice(p)}</option>{/each}
								</select>
							{:else}
								<input type="number" min={0} bind:value={form.price} class={cn(inputCls, 'tnum')} />
							{/if}
						</Field>
					</div>

					<details class="group">
						<summary class="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ash select-none">
							Metadata (opsional) <span class="inline-block transition-transform group-open:rotate-180">▾</span>
						</summary>
						<div class="mt-4 space-y-4">
							<Field label="Judul (kosong = otomatis dari prompt)">
								<input type="text" bind:value={form.title} maxlength={120} class={inputCls} />
							</Field>
							<Field label="Kata kunci tambahan (pisahkan koma)">
								<input type="text" bind:value={form.keywords} maxlength={500} class={inputCls} placeholder="bali, sawah, subak" />
							</Field>
							{#if categories.length}
								<div>
									<p class={labelCls}>Kategori tambahan</p>
									<div class="flex flex-wrap gap-1.5">
										{#each categories as c (c.id)}
											<button
												type="button"
												onclick={() => toggleCategory(c.id)}
												class={cn(
													'text-xs px-2.5 py-1 rounded-[3px] border hairline',
													form.categoryIds.includes(c.id) ? 'border-safelight text-safelight bg-safelight-soft' : 'text-ink hover:bg-ink/[0.04]'
												)}>{c.name}</button
											>
										{/each}
									</div>
								</div>
							{/if}
							<p class="font-mono text-[10px] text-ash-2">
								Metadata: {config.metadata === 'HEURISTIK' ? 'dibuat dari prompt + terjemahan' : `ditulis ${config.metadata}`} · kategori
								AI Generated selalu dipasang
							</p>
						</div>
					</details>

					{#if formMsg}
						<p class={cn('text-xs font-mono border-l-2 pl-3 py-1', /Diantrekan/.test(formMsg) ? 'border-safelight text-safelight' : 'border-safelight text-safelight-dim')}>
							{formMsg}
						</p>
					{/if}

					<div class="flex items-center justify-between gap-3">
						<span class="font-mono text-[10px] text-ash-2">
							Hari ini: {config.limits.image.used} gambar ({remainingLabel(config.limits.image)}) · {config.limits.video.used} video ({remainingLabel(
								config.limits.video
							)})
						</span>
						<Btn type="submit" variant="primary" disabled={submitting || !provider?.configured || overLimit}>
							{#if submitting}<Spinner />{/if}Generate
						</Btn>
					</div>
					{#if overLimit}
						<p class="text-[11px] font-mono text-safelight-dim">Melebihi batas harian — kurangi jumlah atau ubah batas di bawah.</p>
					{/if}
				</form>

				<div class="mt-6 border-t hairline border-solid pt-4">
					<button type="button" class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash" onclick={() => (limitsOpen = !limitsOpen)}>
						Batas harian (kendali biaya) {limitsOpen ? '▴' : '▾'}
					</button>
					{#if limitsOpen}
						<div class="mt-4 grid grid-cols-2 gap-4">
							<Field label="Gambar / hari">
								<input type="number" min={0} max={1000} bind:value={limitDraft.image} class={cn(inputCls, 'tnum')} />
							</Field>
							<Field label="Video / hari">
								<input type="number" min={0} max={100} bind:value={limitDraft.video} class={cn(inputCls, 'tnum')} />
							</Field>
						</div>
						<div class="mt-3 flex items-center gap-3">
							<Btn variant="dark" onclick={saveLimits}>Simpan batas</Btn>
							<span class="font-mono text-[10px] text-ash-2">0 = tanpa batas</span>
							{#if limitMsg}<span class="font-mono text-[11px] text-ash">{limitMsg}</span>{/if}
						</div>
					{/if}
				</div>
			{/if}
		</Panel>

		<!-- Riwayat & kurasi -->
		<div class="space-y-5 min-w-0">
			{#if jobsLoading}
				<Skeleton class="h-48" /><Skeleton class="h-48" />
			{:else if jobs.length === 0}
				<Panel><EmptyState>Belum ada permintaan — tulis prompt pertama di sebelah kiri</EmptyState></Panel>
			{:else}
				{#each jobs as j (j.id)}
					<Panel class="p-6">
						<div class="flex flex-wrap items-start justify-between gap-3 mb-3">
							<div class="min-w-0">
								<p class="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">
									{j.type === 'VIDEO' ? 'Video' : 'Foto'} · {ASPECT_LABEL[j.aspectRatio]} · {j.provider} · {fmt(j.createdAt)}{j.creator
										? ` · ${j.creator.username}`
										: ''}
								</p>
							</div>
							<span
								class={cn(
									'inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]',
									j.status === 'FAILED' ? 'text-safelight-dim' : j.status === 'SUCCEEDED' ? 'text-safelight' : 'text-ink/70'
								)}
							>
								{#if isOpen(j.status)}<Spinner />{/if}
								{STATUS_LABEL[j.status]} · {j.done}/{j.count}
							</span>
						</div>
						<p class="text-sm text-ink leading-relaxed line-clamp-3 mb-3">{j.prompt}</p>
						{#if j.error && j.status !== 'SUCCEEDED'}
							<p class="text-xs font-mono text-safelight-dim border-l-2 border-safelight pl-3 py-1 mb-3">{j.error}</p>
						{/if}

						{#if j.photos.length || isOpen(j.status)}
							<div class="grid gap-3 grid-cols-2 sm:grid-cols-4">
								{#each j.photos as p (p.id)}
									<div class="min-w-0">
										<button
											type="button"
											class="relative block w-full aspect-square overflow-hidden rounded-[3px] bg-ink/[0.06] group"
											onclick={() => {
												preview = { job: j, photo: p };
												rejectNote = '';
												actMsg = '';
											}}
										>
											<img src={p.thumbUrl} alt={p.title} class="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
											{#if p.type === 'VIDEO'}
												<span class="absolute inset-0 grid place-items-center text-white text-2xl drop-shadow">▶</span>
											{/if}
										</button>
										<p
											class={cn(
												'mt-1.5 font-mono text-[10px] uppercase tracking-wider',
												p.status === 'APPROVED' ? 'text-safelight' : p.status === 'REJECTED' ? 'text-ash-2 line-through' : 'text-ink/70'
											)}
										>
											{PHOTO_STATUS_LABEL[p.status]}
										</p>
										<p class="text-xs text-ash truncate" title={p.title}>{p.title}</p>
									</div>
								{/each}
								{#if isOpen(j.status)}
									{#each Array.from({ length: Math.max(0, j.count - j.done - j.failed) }) as _, i (i)}
										<div class="aspect-square rounded-[3px] bg-ink/[0.05] animate-pulse grid place-items-center">
											<span class="font-mono text-[10px] text-ash-2">membuat…</span>
										</div>
									{/each}
								{/if}
							</div>
						{/if}

						<div class="mt-4 flex flex-wrap gap-2">
							{#if pendingOf(j) > 0}
								<Btn variant="primary" onclick={() => approveAll(j)} disabled={acting === j.id}>
									{#if acting === j.id}<Spinner />{/if}Setujui semua ({pendingOf(j)})
								</Btn>
							{/if}
							<Btn onclick={() => reuse(j)}>Pakai prompt lagi</Btn>
						</div>
					</Panel>
				{/each}
				{#if page < totalPages}
					<div class="text-center"><Btn onclick={() => loadJobs(page + 1)}>Muat lebih banyak</Btn></div>
				{/if}
			{/if}
		</div>
	</div>
</div>

{#if preview}
	{@const p = preview.photo}
	<Modal kicker={`${PHOTO_STATUS_LABEL[p.status]} · AI Generated`} title={p.title} onclose={() => (preview = null)} class="max-w-3xl!">
		<div class="-mx-2 mb-4 bg-ink/[0.04] rounded-[3px] overflow-hidden grid place-items-center">
			{#if p.type === 'VIDEO'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={p.watermarkUrl} poster={p.thumbUrl} controls autoplay loop muted class="max-h-[60vh] w-auto"></video>
			{:else}
				<img src={p.watermarkUrl} alt={p.title} class="max-h-[60vh] w-auto" />
			{/if}
		</div>
		<p class="font-mono text-[11px] text-ash mb-1">
			{p.width && p.height ? `${p.width}×${p.height}` : ''}{p.titleEn ? ` · EN: ${p.titleEn}` : ''}
		</p>
		<p class="text-xs text-ash mb-4 line-clamp-3">Prompt: {preview.job.prompt}</p>
		{#if p.status === 'REJECTED' && p.rejectNote}
			<p class="text-xs font-mono text-ash mb-4">Alasan ditolak: {p.rejectNote}</p>
		{/if}
		{#if p.status === 'PENDING'}
			<Field label="Catatan bila ditolak (opsional)">
				<input type="text" bind:value={rejectNote} maxlength={500} class={inputCls} placeholder="mis. Tangan cacat, teks rusak" />
			</Field>
		{/if}
		{#if actMsg}<p class="mt-3 font-mono text-[11px] text-safelight-dim">{actMsg}</p>{/if}
		<div class="mt-5 flex flex-wrap gap-2">
			{#if p.status !== 'APPROVED'}
				<Btn variant="primary" onclick={() => approve(preview!.job, p)} disabled={acting === p.id}>
					{#if acting === p.id}<Spinner />{/if}Setujui & tayangkan
				</Btn>
			{/if}
			{#if p.status !== 'REJECTED'}
				<Btn variant="danger" onclick={() => reject(preview!.job, p)} disabled={acting === p.id}>Tolak</Btn>
			{/if}
			<a href={`/dashboard/photos/${p.id}/edit`} class="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.16em] px-4 py-2.5 rounded-[3px] border hairline text-ink hover:bg-ink/[0.04]">
				Edit metadata
			</a>
		</div>
	</Modal>
{/if}
