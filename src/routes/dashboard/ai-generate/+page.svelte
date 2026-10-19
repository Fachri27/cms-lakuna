<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { cn } from '$lib/ui-classes';
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
	import {
		ArrowUp,
		Check,
		ChevronDown,
		ChevronLeft,
		CircleCheck,
		ClipboardCheck,
		Coins,
		Film,
		Gauge,
		Hash,
		Image as ImageIcon,
		Info,
		LoaderCircle,
		Minus,
		Pencil,
		Plus,
		Ratio,
		RotateCcw,
		Sparkles,
		Tag,
		TriangleAlert,
		X
	} from '@lucide/svelte';

	/**
	 * AI Generate — editor gelap layar penuh (acuan tampilan: editor gambar Magnific): kanvas hasil di tengah,
	 * bilah prompt mengambang di bawah, panel kanan Detail / Riwayat / Opsi. Prompt → penyedia AI (API
	 * /ai-generations, diproses di latar) → tiap hasil otomatis masuk tabel foto/video sebagai "Menunggu kurasi"
	 * berkategori "AI Generated". Kurasi di panel Detail atau di Persetujuan; hanya yang disetujui yang tayang.
	 * Lapisan `fixed` di atas layout dashboard, jadi pengaman login/peran di layout tetap berlaku.
	 */

	type Named = { id: string; name: string };
	type Tab = 'detail' | 'history' | 'options';

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

	let tab = $state<Tab>('detail');
	/** Permintaan yang dibuka admin (dari Riwayat / baru dikirim); null = otomatis: yang masih perlu perhatian. */
	let selectedJobId = $state<string | null>(null);
	let selectedPhotoId = $state<string | null>(null);
	/** Menu chip yang terbuka di bilah prompt. */
	let menu = $state<'type' | 'aspect' | 'price' | null>(null);
	/** Baris opsi (akordeon) yang terbuka di tab Opsi. */
	let openOption = $state<string | null>('metadata');
	/** Petunjuk yang sudah ditutup, per penyedia (peringatan Pollinations tetap muncul walau petunjuk lain ditutup). */
	let hintsClosed = $state<string[]>([]);

	let limitDraft = $state({ image: '', video: '' });
	let limitMsg = $state('');
	let rejectNote = $state('');
	let rejectOpen = $state(false);
	let acting = $state<string | null>(null);
	let actMsg = $state('');
	let promptEl = $state<HTMLTextAreaElement | null>(null);

	const provider = $derived(form.type === 'VIDEO' ? config?.video : config?.image);
	const limit = $derived(form.type === 'VIDEO' ? config?.limits.video : config?.limits.image);
	const wanted = $derived(form.type === 'VIDEO' ? 1 : form.count);
	const overLimit = $derived(!!limit && limit.remaining !== null && wanted > limit.remaining);
	const offline = $derived(provider?.online === false);
	const canSubmit = $derived(!!provider?.configured && !offline && !overLimit && !submitting && form.prompt.trim().length >= 5);
	/** Masih diproses atau masih ada hasil yang menunggu kurasi. Yang sudah tuntas dikurasi tak tampil lagi di kanvas. */
	const needsAttention = (j: AiJob) => isOpen(j.status) || j.photos.some((p) => p.status === 'PENDING');
	const selectedJob = $derived(
		selectedJobId ? (jobs.find((j) => j.id === selectedJobId) ?? null) : (jobs.find(needsAttention) ?? null)
	);
	const selectedPhoto = $derived(
		selectedJob
			? (selectedJob.photos.find((p) => p.id === selectedPhotoId) ??
				selectedJob.photos.find((p) => p.status === 'PENDING') ??
				selectedJob.photos[0] ??
				null)
			: null
	);
	const allCurated = $derived(jobs.length > 0 && !jobs.some(needsAttention));
	const pendingSlots = $derived(
		selectedJob && isOpen(selectedJob.status) ? Math.max(0, selectedJob.count - selectedJob.done - selectedJob.failed) : 0
	);
	const AI_CATEGORY = 'AI Generated';
	const EXAMPLES = [
		'Terraced rice fields in Bali at sunrise, mist over the valley, photorealistic',
		'Pasar terapung Banjarmasin pagi hari, perahu penuh buah, cahaya hangat',
		'Aerial view of Raja Ampat islands, turquoise water, golden hour'
	];

	onMount(() => {
		try {
			hintsClosed = JSON.parse(localStorage.getItem('ai-generate:hints') || '[]');
		} catch {
			/* penyimpanan diblokir — petunjuk tampil lagi, tak apa */
		}
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
		// Editor layar penuh: halaman dashboard di belakangnya tak ikut bergulir.
		const prev = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') menu = null;
		};
		document.addEventListener('keydown', onKey);
		return () => {
			clearInterval(t);
			document.documentElement.style.overflow = prev;
			document.removeEventListener('keydown', onKey);
		};
	});

	async function loadConfig() {
		try {
			config = await api<AiConfig>('/ai-generations/config');
			limitDraft = { image: String(config.limits.image.limit), video: String(config.limits.video.limit) };
			const asp = (form.type === 'VIDEO' ? config.video : config.image)?.aspects ?? [];
			if (asp.length && !asp.includes(form.aspectRatio)) form.aspectRatio = asp.includes('3:2') ? '3:2' : asp[0];
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Gagal memuat';
		}
	}

	async function loadJobs(p = 1) {
		try {
			const r = await apiEnvelope<AiJob[]>(`/ai-generations?page=${p}&limit=12`);
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
		menu = null;
	}

	function toggleCategory(id: string) {
		form.categoryIds = form.categoryIds.includes(id) ? form.categoryIds.filter((x) => x !== id) : [...form.categoryIds, id];
	}

	function selectJob(j: AiJob) {
		selectedJobId = j.id;
		selectedPhotoId = j.photos[0]?.id ?? null;
		rejectOpen = false;
		actMsg = '';
		tab = 'detail';
	}

	function selectPhoto(id: string) {
		selectedPhotoId = id;
		rejectOpen = false;
		actMsg = '';
	}

	async function submit(e?: Event) {
		e?.preventDefault();
		formMsg = '';
		const price = Number(form.price);
		if (form.prompt.trim().length < 5) return (formMsg = 'Prompt minimal 5 karakter');
		if (!Number.isInteger(price) || price < 0) return (formMsg = 'Harga tidak valid');
		if (!canSubmit) return;
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
			selectedJobId = job.id;
			selectedPhotoId = null;
			tab = 'detail';
			void loadConfig();
		} catch (err) {
			formMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			submitting = false;
		}
	}

	function onPromptKey(e: KeyboardEvent) {
		// Enter = kirim, Shift+Enter = baris baru (seperti editor acuan).
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			void submit();
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
		promptEl?.focus();
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

	function closeHint() {
		if (!provider) return;
		hintsClosed = [...hintsClosed, provider.provider];
		try {
			localStorage.setItem('ai-generate:hints', JSON.stringify(hintsClosed));
		} catch {
			/* abaikan */
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (menu && !(e.target as HTMLElement).closest('[data-menu]')) menu = null;
	}

	/* ── Kurasi ── */

	function patchPhoto(jobId: string, photoId: string, patch: Partial<AiPhoto>) {
		jobs = jobs.map((j) => (j.id === jobId ? { ...j, photos: j.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)) } : j));
	}

	/**
	 * Setelah menyetujui/menolak: lanjut ke hasil berikutnya yang masih menunggu; bila semua hasil permintaan ini
	 * sudah dikurasi (dan tak ada yang masih dibuat), kanvas dikosongkan sejenak kemudian (status barunya sempat
	 * terlihat) — tetap bisa dibuka lagi dari Riwayat.
	 */
	function afterCurate(jobId: string) {
		const j = jobs.find((x) => x.id === jobId);
		if (!j) return;
		const next = j.photos.find((p) => p.status === 'PENDING');
		if (next) {
			selectPhoto(next.id);
			return;
		}
		if (isOpen(j.status)) return;
		setTimeout(() => {
			if (selectedJob?.id !== jobId || needsAttention(j)) return;
			selectedJobId = null;
			selectedPhotoId = null;
			rejectOpen = false;
		}, 700);
	}

	async function approve(job: AiJob, photo: AiPhoto) {
		acting = photo.id;
		actMsg = '';
		try {
			await api(`/photos/${photo.id}/approve`, { method: 'PATCH' });
			patchPhoto(job.id, photo.id, { status: 'APPROVED', rejectNote: null });
			afterCurate(job.id);
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
			rejectOpen = false;
			afterCurate(job.id);
		} catch (err) {
			actMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			acting = null;
		}
	}

	async function approveAll(job: AiJob) {
		const n = pendingOf(job);
		if (!confirm(`Setujui ${n} hasil yang masih menunggu kurasi? Semuanya langsung tayang di situs.`)) return;
		acting = job.id;
		try {
			await api(`/ai-generations/${job.id}/approve-all`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
			for (const p of job.photos) if (p.status === 'PENDING') patchPhoto(job.id, p.id, { status: 'APPROVED' });
			afterCurate(job.id);
		} catch (err) {
			actMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			acting = null;
		}
	}

	const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const pendingOf = (j: AiJob) => j.photos.filter((p) => p.status === 'PENDING').length;
	const usage = (l: { used: number; limit: number }) => (l.limit === 0 ? `${l.used}` : `${l.used}/${l.limit}`);
	/** Rasio CSS untuk kerangka "sedang dibuat". */
	const cssAspect = (a: AiAspect) => a.replace(':', ' / ');
	const STATUS_TONE: Record<AiPhoto['status'], string> = {
		PENDING: 'bg-amber-400/15 text-amber-200',
		APPROVED: 'bg-emerald-400/15 text-emerald-300',
		REJECTED: 'bg-white/[0.06] text-neutral-400'
	};
	const TYPE_OPTIONS = $derived([
		{ t: 'FOTO' as AiType, label: 'Foto', p: config?.image },
		{ t: 'VIDEO' as AiType, label: 'Video', p: config?.video }
	]);
	const TABS: { k: Tab; l: string }[] = [
		{ k: 'detail', l: 'Detail' },
		{ k: 'history', l: 'Riwayat' },
		{ k: 'options', l: 'Opsi' }
	];

	/* ── kelas bersama (tema gelap editor) ── */
	const chip =
		'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-neutral-200 transition-colors hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:bg-transparent';
	const field =
		'w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-neutral-100 outline-none transition-colors placeholder:text-neutral-500 focus:border-white/25';
	const label = 'mb-1.5 block text-[12px] text-neutral-400';
	const menuBox = 'absolute bottom-full left-0 z-20 mb-2 min-w-44 rounded-xl border border-white/10 bg-[#1f1f1f] p-1 shadow-2xl';
	const menuItem =
		'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:bg-transparent';
	const optionRow =
		'flex h-11 w-full items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/[0.07]';
</script>

<svelte:window onclick={onWindowClick} />

{#snippet optionHead(key: string, title: string, hint: string)}
	<button type="button" onclick={() => (openOption = openOption === key ? null : key)} aria-expanded={openOption === key} class={optionRow}>
		{#if key === 'metadata'}<Hash size={15} class="text-neutral-400" />{:else if key === 'category'}<Tag size={15} class="text-neutral-400" />{:else if key === 'limits'}<Gauge
				size={15}
				class="text-neutral-400"
			/>{:else}<Info size={15} class="text-neutral-400" />{/if}
		<span class="flex-1">{title}</span>
		{#if hint}<span class="text-[11px] font-normal text-neutral-500">{hint}</span>{/if}
		{#if openOption === key}<Minus size={15} class="text-neutral-400" />{:else}<Plus size={15} class="text-neutral-400" />{/if}
	</button>
{/snippet}

<div class="ai-editor fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#0f0f0f] text-neutral-100 lg:overflow-hidden">
	<!-- Bilah atas -->
	<header class="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-5">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/dashboard"
				aria-label="Kembali ke dashboard"
				class="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-neutral-200 transition-colors hover:bg-white/[0.12]"
			>
				<ChevronLeft size={18} />
			</a>
			<div class="flex min-w-0 items-center gap-2">
				<Sparkles size={15} class="shrink-0 text-[#a78bfa]" />
				<span class="truncate text-[14px] font-medium">AI Generate</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if config}
				<span
					class="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-[12px] text-neutral-400 md:inline-flex"
					title="Pemakaian hari ini (batas harian)"
				>
					<Gauge size={14} />
					<span class="tabular-nums">{usage(config.limits.image)} gambar · {usage(config.limits.video)} video</span>
				</span>
			{/if}
			<a
				href="/dashboard/approval"
				class="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.12] px-3 text-[13px] text-neutral-100 transition-colors hover:bg-white/[0.06]"
			>
				<ClipboardCheck size={15} />
				<span class="hidden sm:inline">Persetujuan</span>
			</a>
		</div>
	</header>

	<div class="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4 lg:flex-row">
		<!-- Kanvas -->
		<section class="relative flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl lg:min-h-0">
			<!-- Rel variasi hasil -->
			{#if selectedJob && (selectedJob.photos.length > 1 || pendingSlots > 0)}
				<div class="absolute left-3 top-3 z-10 flex gap-2 sm:left-4 sm:top-1/2 sm:-translate-y-1/2 sm:flex-col">
					{#each selectedJob.photos as p (p.id)}
						<button
							type="button"
							onclick={() => selectPhoto(p.id)}
							aria-label={`Hasil: ${p.title}`}
							class={cn(
								'relative size-14 overflow-hidden rounded-lg ring-2 transition-all',
								selectedPhoto?.id === p.id ? 'ring-white' : 'opacity-70 ring-transparent hover:opacity-100'
							)}
						>
							<img src={p.thumbUrl} alt="" class="size-full object-cover" />
							{#if p.status !== 'PENDING'}
								<span
									class={cn(
										'absolute bottom-1 right-1 grid size-4 place-items-center rounded-full',
										p.status === 'APPROVED' ? 'bg-emerald-400 text-black' : 'bg-neutral-700 text-neutral-300'
									)}
								>
									{#if p.status === 'APPROVED'}<Check size={11} strokeWidth={3} />{:else}<X size={10} strokeWidth={3} />{/if}
								</span>
							{/if}
						</button>
					{/each}
					{#each Array.from({ length: pendingSlots }) as _, i (i)}
						<div class="grid size-14 place-items-center rounded-lg bg-white/[0.05]">
							<LoaderCircle size={16} class="animate-spin text-neutral-500" />
						</div>
					{/each}
				</div>
			{/if}

			<!-- Pratinjau -->
			<div class="flex min-h-0 flex-1 items-center justify-center px-4 pb-52 pt-20 sm:px-24 sm:pt-6">
				{#if loadError}
					<p class="text-[13px] text-red-300">{loadError}</p>
				{:else if selectedPhoto}
					{#key selectedPhoto.id}
						{#if selectedPhoto.type === 'VIDEO'}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={selectedPhoto.watermarkUrl}
								poster={selectedPhoto.thumbUrl}
								controls
								autoplay
								loop
								muted
								class="max-h-full max-w-full rounded-lg shadow-2xl"
							></video>
						{:else}
							<img
								src={selectedPhoto.watermarkUrl}
								alt={selectedPhoto.title}
								class="ai-fade max-h-full max-w-full rounded-lg object-contain shadow-2xl"
							/>
						{/if}
					{/key}
				{:else if selectedJob && isOpen(selectedJob.status)}
					<div class="ai-shimmer w-full max-w-[640px] rounded-xl" style:aspect-ratio={cssAspect(selectedJob.aspectRatio)}>
						<div class="flex size-full flex-col items-center justify-center gap-2 text-neutral-400">
							<LoaderCircle size={22} class="animate-spin" />
							<span class="text-[13px]">
								{selectedJob.status === 'QUEUED'
									? 'Antre…'
									: `Membuat ${selectedJob.type === 'VIDEO' ? 'video' : `${selectedJob.done + 1} dari ${selectedJob.count}`}…`}
							</span>
						</div>
					</div>
				{:else if selectedJob && selectedJob.status === 'FAILED'}
					<div class="max-w-md text-center">
						<TriangleAlert size={36} class="mx-auto mb-3 text-neutral-300" />
						<p class="mb-1 text-[15px] font-medium">Tidak ada hasil</p>
						<p class="text-[13px] text-neutral-400">{selectedJob.error ?? 'Permintaan gagal'}</p>
					</div>
				{:else if !jobsLoading}
					<div class="max-w-lg text-center">
						<div class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-white/[0.06]">
							<Sparkles size={22} class="text-[#a78bfa]" />
						</div>
						<p class="mb-1 text-[17px] font-medium">{allCurated ? 'Semua hasil sudah dikurasi' : 'Buat foto atau video dengan AI'}</p>
						<p class="mb-5 text-[13px] text-neutral-400">
							Tulis prompt di bawah. Setiap hasil masuk katalog berkategori AI Generated dan menunggu kurasi sebelum tayang.
						</p>
						<div class="flex flex-col items-center gap-2">
							{#each EXAMPLES as ex (ex)}
								<button
									type="button"
									onclick={() => {
										form.prompt = ex;
										promptEl?.focus();
									}}
									class="max-w-full truncate rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[12px] text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
								>
									{ex}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Ukuran hasil (kiri bawah) -->
			{#if selectedPhoto}
				<span
					class="absolute bottom-4 left-4 hidden h-7 items-center rounded-lg bg-white/[0.06] px-2.5 text-[11px] tabular-nums text-neutral-400 xl:inline-flex"
				>
					{selectedPhoto.width && selectedPhoto.height ? `${selectedPhoto.width}×${selectedPhoto.height} px` : selectedPhoto.type}
				</span>
			{/if}

			<!-- Bilah prompt mengambang -->
			<form onsubmit={submit} class="absolute bottom-3 left-1/2 z-10 w-[min(720px,calc(100%-1.5rem))] -translate-x-1/2 sm:bottom-4">
				{#if config && provider && (offline || !hintsClosed.includes(provider.provider))}
					<div
						class="mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-[#161616]/90 py-1 pl-1.5 pr-1 text-[12px] text-neutral-300 backdrop-blur"
					>
						<span
							class={cn(
								'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
								provider.provider === 'POLLINATIONS' || offline ? 'bg-amber-400/20 text-amber-200' : 'bg-[#7c3aed]/25 text-[#c4b5fd]'
							)}
						>
							{offline
								? 'Mati'
								: provider.provider === 'SIMULASI'
									? 'Simulasi'
									: provider.provider === 'POLLINATIONS'
										? 'Gratis'
										: provider.provider === 'LOKAL'
											? 'Lokal'
											: 'Baru'}
						</span>
						<span class="truncate">
							{offline
								? 'Server AI lokal belum menyala — jalankan apps/api/scripts/ai-local/start.sh di Mac ini'
								: provider.provider === 'SIMULASI'
									? 'Mode lokal: hasil contoh, bukan buatan AI sungguhan'
									: provider.provider === 'POLLINATIONS'
										? 'Pollinations: ≤768 px & berlogo pollinations.ai — untuk uji coba, jangan disetujui untuk dijual'
										: provider.provider === 'LOKAL'
											? `Dibuat di Mac ini (${provider.model}) — gratis, tanpa logo, ±3–4 menit per gambar`
											: 'Hasil otomatis masuk antre kurasi berkategori AI Generated'}
						</span>
						{#if !offline}
						<button
							type="button"
							onclick={closeHint}
							aria-label="Tutup petunjuk"
							class="grid size-6 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-200"
						>
							<X size={13} />
						</button>
						{/if}
					</div>
				{/if}
				<div class="rounded-2xl border border-white/[0.09] bg-[#1a1a1a] p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] transition-colors focus-within:border-white/20">
					<textarea
						bind:this={promptEl}
						bind:value={form.prompt}
						onkeydown={onPromptKey}
						maxlength={2000}
						rows={2}
						aria-label="Prompt"
						placeholder={provider?.configured === false
							? `Penyedia ${form.type === 'VIDEO' ? 'video' : 'gambar'} AI belum dipasang di server API`
							: 'Deskripsikan foto atau video yang ingin dibuat…'}
						class="block max-h-40 min-h-12 w-full resize-none bg-transparent px-2 pt-1 text-[15px] leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-500"
					></textarea>
					<div class="mt-1 flex items-center justify-between gap-2">
						<div class="flex min-w-0 flex-wrap items-center gap-0.5">
							<!-- Jenis -->
							<div class="relative" data-menu>
								<button
									type="button"
									class={chip}
									onclick={() => (menu = menu === 'type' ? null : 'type')}
									aria-haspopup="menu"
									aria-expanded={menu === 'type'}
								>
									{#if form.type === 'VIDEO'}<Film size={15} />{:else}<ImageIcon size={15} />{/if}
									{form.type === 'VIDEO' ? 'Video' : 'Foto'}
									<ChevronDown size={13} class="text-neutral-500" />
								</button>
								{#if menu === 'type'}
									<div class={menuBox} role="menu">
										{#each TYPE_OPTIONS as o (o.t)}
											<button type="button" role="menuitem" class={menuItem} disabled={!o.p?.configured} onclick={() => setType(o.t)}>
												<span class="flex items-center gap-2">
													{#if o.t === 'VIDEO'}<Film size={15} />{:else}<ImageIcon size={15} />{/if}{o.label}
												</span>
												<span class="text-[11px] text-neutral-500">{o.p?.configured ? o.p.provider : 'belum dipasang'}</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<!-- Rasio -->
							<div class="relative" data-menu>
								<button
									type="button"
									class={chip}
									onclick={() => (menu = menu === 'aspect' ? null : 'aspect')}
									aria-haspopup="menu"
									aria-expanded={menu === 'aspect'}
								>
									<Ratio size={15} />{form.aspectRatio}<ChevronDown size={13} class="text-neutral-500" />
								</button>
								{#if menu === 'aspect'}
									<div class={menuBox} role="menu">
										{#each provider?.aspects ?? [] as a (a)}
											<button
												type="button"
												role="menuitem"
												class={menuItem}
												onclick={() => {
													form.aspectRatio = a;
													menu = null;
												}}
											>
												{ASPECT_LABEL[a]}
												{#if form.aspectRatio === a}<Check size={14} />{/if}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<!-- Jumlah -->
							{#if form.type === 'FOTO' && config}
								<div class="inline-flex h-8 items-center rounded-lg text-[13px] text-neutral-200">
									<button
										type="button"
										class="grid size-7 place-items-center rounded-md hover:bg-white/[0.07] disabled:opacity-30"
										aria-label="Kurangi jumlah"
										disabled={form.count <= 1}
										onclick={() => (form.count = Math.max(1, form.count - 1))}><Minus size={13} /></button
									>
									<span class="w-8 text-center tabular-nums" title="Jumlah hasil">×{form.count}</span>
									<button
										type="button"
										class="grid size-7 place-items-center rounded-md hover:bg-white/[0.07] disabled:opacity-30"
										aria-label="Tambah jumlah"
										disabled={form.count >= config.maxImagesPerRequest}
										onclick={() => (form.count = Math.min(config?.maxImagesPerRequest ?? 4, form.count + 1))}><Plus size={13} /></button
									>
								</div>
							{/if}
							<!-- Harga -->
							<div class="relative" data-menu>
								<button
									type="button"
									class={chip}
									onclick={() => (menu = menu === 'price' ? null : 'price')}
									aria-haspopup="menu"
									aria-expanded={menu === 'price'}
								>
									<Coins size={15} /><span class="tabular-nums">{form.price ? formatPrice(Number(form.price)) : 'Harga'}</span><ChevronDown
										size={13}
										class="text-neutral-500"
									/>
								</button>
								{#if menu === 'price'}
									<div class={cn(menuBox, 'max-h-64 overflow-y-auto')} role="menu">
										{#each presets as p (p)}
											<button
												type="button"
												role="menuitem"
												class={menuItem}
												onclick={() => {
													form.price = String(p);
													menu = null;
												}}
											>
												<span class="tabular-nums">{formatPrice(p)}</span>
												{#if Number(form.price) === p}<Check size={14} />{/if}
											</button>
										{/each}
										{#if presets.length === 0}<p class="px-2.5 py-2 text-[12px] text-neutral-500">Atur preset harga di Pengaturan</p>{/if}
									</div>
								{/if}
							</div>
							<!-- Opsi lanjutan -->
							<button
								type="button"
								class={cn(chip, (form.title || form.keywords || form.categoryIds.length > 0) && 'text-[#c4b5fd]')}
								onclick={() => {
									tab = 'options';
									openOption = 'metadata';
								}}
							>
								<Tag size={15} /><span class="hidden sm:inline">Metadata</span>
							</button>
						</div>
						<button
							type="submit"
							disabled={!canSubmit}
							aria-label="Generate"
							title={overLimit ? 'Melebihi batas harian' : 'Generate (Enter)'}
							class="grid size-9 shrink-0 place-items-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:bg-white/20 disabled:text-white/50"
						>
							{#if submitting}<LoaderCircle size={17} class="animate-spin" />{:else}<ArrowUp size={18} strokeWidth={2.4} />{/if}
						</button>
					</div>
				</div>
				{#if formMsg || overLimit}
					<p class="mt-2 text-center text-[12px] text-red-300">
						{formMsg || 'Melebihi batas harian — kurangi jumlah atau ubah batas di tab Opsi.'}
					</p>
				{/if}
			</form>
		</section>

		<!-- Panel kanan -->
		<aside class="flex min-h-[420px] w-full shrink-0 flex-col rounded-2xl border border-white/[0.06] bg-[#161616] lg:min-h-0 lg:w-[340px]">
			<div class="p-3 pb-0">
				<div class="grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1" role="tablist">
					{#each TABS as t (t.k)}
						<button
							type="button"
							role="tab"
							aria-selected={tab === t.k}
							onclick={() => (tab = t.k)}
							class={cn(
								'h-8 rounded-lg text-[13px] font-medium transition-colors',
								tab === t.k ? 'bg-white/[0.12] text-white' : 'text-neutral-400 hover:text-neutral-200'
							)}
						>
							{t.l}
						</button>
					{/each}
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto p-3">
				{#if tab === 'detail'}
					{#if !selectedJob}
						<p class="px-1 py-6 text-center text-[13px] text-neutral-500">
							{allCurated
								? 'Tidak ada hasil yang menunggu kurasi. Hasil sebelumnya ada di tab Riwayat.'
								: 'Belum ada hasil. Tulis prompt pertama di bilah bawah.'}
						</p>
					{:else}
						{@const j = selectedJob}
						<div class="space-y-3">
							<div class="rounded-xl bg-white/[0.04] p-3">
								<div class="mb-2 flex items-center justify-between gap-2 text-[12px]">
									<span class="inline-flex items-center gap-1.5 text-neutral-400">
										{#if isOpen(j.status)}<LoaderCircle size={13} class="animate-spin" />{/if}
										{STATUS_LABEL[j.status]} · {j.done}/{j.count}
									</span>
									<span class="text-neutral-500">{fmt(j.createdAt)}</span>
								</div>
								<p class="text-[13px] leading-relaxed text-neutral-200">{j.prompt}</p>
								<p class="mt-2 text-[11px] text-neutral-500">
									{j.type === 'VIDEO' ? 'Video' : 'Foto'} · {ASPECT_LABEL[j.aspectRatio]} · {j.provider}{j.model && j.model !== 'simulasi'
										? ` ${j.model}`
										: ''} · {formatPrice(j.price)}
								</p>
								{#if j.error && j.status !== 'SUCCEEDED'}
									<p class="mt-2 flex gap-1.5 text-[12px] text-red-300"><TriangleAlert size={14} class="mt-0.5 shrink-0" />{j.error}</p>
								{/if}
								<div class="mt-3 flex flex-wrap gap-2">
									<button
										type="button"
										onclick={() => reuse(j)}
										class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[12px] text-neutral-200 hover:bg-white/[0.06]"
									>
										<RotateCcw size={13} />Pakai prompt lagi
									</button>
									{#if pendingOf(j) > 0}
										<button
											type="button"
											onclick={() => approveAll(j)}
											disabled={acting === j.id}
											class="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-medium text-black hover:opacity-90 disabled:opacity-50"
										>
											<CircleCheck size={13} />Setujui semua ({pendingOf(j)})
										</button>
									{/if}
								</div>
							</div>

							{#if selectedPhoto}
								{@const p = selectedPhoto}
								<div class="rounded-xl bg-white/[0.04] p-3">
									<div class="mb-2 flex items-center justify-between gap-2">
										<span class={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[p.status])}>{PHOTO_STATUS_LABEL[p.status]}</span>
										<span class="text-[11px] text-neutral-500">AI Generated</span>
									</div>
									<p class="text-[14px] font-medium leading-snug">{p.title}</p>
									{#if p.titleEn && p.titleEn !== p.title}<p class="mt-0.5 text-[12px] text-neutral-400">EN · {p.titleEn}</p>{/if}
									{#if p.status === 'REJECTED' && p.rejectNote}
										<p class="mt-2 text-[12px] text-neutral-400">Alasan ditolak: {p.rejectNote}</p>
									{/if}
									<div class="mt-3 grid gap-2">
										{#if p.status !== 'APPROVED'}
											<button
												type="button"
												onclick={() => approve(j, p)}
												disabled={acting === p.id}
												class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white text-[13px] font-medium text-black hover:opacity-90 disabled:opacity-50"
											>
												{#if acting === p.id}<LoaderCircle size={15} class="animate-spin" />{:else}<Check size={15} />{/if}Setujui & tayangkan
											</button>
										{/if}
										{#if p.status !== 'REJECTED'}
											{#if rejectOpen}
												<input type="text" bind:value={rejectNote} maxlength={500} placeholder="Catatan (opsional), mis. tangan cacat" class={field} />
												<div class="grid grid-cols-2 gap-2">
													<button
														type="button"
														onclick={() => (rejectOpen = false)}
														class="h-9 rounded-lg border border-white/10 text-[13px] text-neutral-300 hover:bg-white/[0.06]">Batal</button
													>
													<button
														type="button"
														onclick={() => reject(j, p)}
														disabled={acting === p.id}
														class="h-9 rounded-lg bg-red-500/15 text-[13px] font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50">Tolak</button
													>
												</div>
											{:else}
												<button
													type="button"
													onclick={() => (rejectOpen = true)}
													class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 text-[13px] text-neutral-200 hover:bg-white/[0.06]"
												>
													<X size={15} />Tolak
												</button>
											{/if}
										{/if}
										<a
											href={`/dashboard/photos/${p.id}/edit`}
											class="inline-flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
										>
											<Pencil size={14} />Edit metadata
										</a>
									</div>
									{#if actMsg}<p class="mt-2 text-[12px] text-red-300">{actMsg}</p>{/if}
								</div>
							{/if}
						</div>
					{/if}
				{:else if tab === 'history'}
					{#if jobsLoading}
						<div class="space-y-2">
							{#each [1, 2, 3] as i (i)}<div class="h-16 animate-pulse rounded-xl bg-white/[0.04]"></div>{/each}
						</div>
					{:else if jobs.length === 0}
						<p class="px-1 py-6 text-center text-[13px] text-neutral-500">Belum ada riwayat</p>
					{:else}
						<ul class="space-y-1.5">
							{#each jobs as j (j.id)}
								<li>
									<button
										type="button"
										onclick={() => selectJob(j)}
										class={cn(
											'flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors',
											selectedJob?.id === j.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
										)}
									>
										<div class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.05]">
											{#if j.photos[0]}
												<img src={j.photos[0].thumbUrl} alt="" class="size-full object-cover" />
											{:else if isOpen(j.status)}
												<LoaderCircle size={16} class="animate-spin text-neutral-500" />
											{:else}
												<TriangleAlert size={16} class="text-neutral-500" />
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="line-clamp-2 text-[12.5px] leading-snug text-neutral-200">{j.prompt}</p>
											<p class="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
												{#if j.type === 'VIDEO'}<Film size={11} />{:else}<ImageIcon size={11} />{/if}
												{STATUS_LABEL[j.status]} · {j.done}/{j.count}{pendingOf(j)
													? ` · ${pendingOf(j)} menunggu kurasi`
													: j.photos.length && !isOpen(j.status)
														? ' · dikurasi'
														: ''}
											</p>
										</div>
									</button>
								</li>
							{/each}
						</ul>
						{#if page < totalPages}
							<button
								type="button"
								onclick={() => loadJobs(page + 1)}
								class="mt-2 h-9 w-full rounded-lg text-[13px] text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200"
							>
								Muat lebih banyak
							</button>
						{/if}
					{/if}
				{:else}
					<!-- Opsi: baris akordeon seperti daftar alat di editor acuan -->
					<div class="space-y-2">
						<div>
							{@render optionHead('metadata', 'Judul & kata kunci', form.title || form.keywords ? 'diisi' : 'otomatis')}
							{#if openOption === 'metadata'}
								<div class="space-y-3 px-1 pb-1 pt-3">
									<div>
										<label class={label} for="ai-title">Judul (kosong = dari prompt)</label>
										<input id="ai-title" type="text" bind:value={form.title} maxlength={120} class={field} />
									</div>
									<div>
										<label class={label} for="ai-kw">Kata kunci tambahan (pisahkan koma)</label>
										<input id="ai-kw" type="text" bind:value={form.keywords} maxlength={500} placeholder="bali, sawah, subak" class={field} />
									</div>
									<p class="text-[11px] text-neutral-500">
										Metadata ID + EN {config?.metadata === 'HEURISTIK' ? 'dibuat dari prompt + terjemahan' : `ditulis ${config?.metadata ?? ''}`}.
									</p>
								</div>
							{/if}
						</div>

						<div>
							{@render optionHead('category', 'Kategori tambahan', form.categoryIds.length ? `${form.categoryIds.length} dipilih` : '')}
							{#if openOption === 'category'}
								<div class="px-1 pb-1 pt-3">
									<div class="flex flex-wrap gap-1.5">
										{#each categories as c (c.id)}
											<button
												type="button"
												onclick={() => toggleCategory(c.id)}
												class={cn(
													'rounded-lg px-2.5 py-1 text-[12px] transition-colors',
													form.categoryIds.includes(c.id) ? 'bg-white text-black' : 'bg-white/[0.05] text-neutral-300 hover:bg-white/[0.1]'
												)}
											>
												{c.name}
											</button>
										{/each}
									</div>
									<p class="mt-2 text-[11px] text-neutral-500">Kategori AI Generated selalu dipasang.</p>
								</div>
							{/if}
						</div>

						<div>
							{@render optionHead('limits', 'Batas harian', config ? `${usage(config.limits.image)} · ${usage(config.limits.video)}` : '')}
							{#if openOption === 'limits'}
								<div class="space-y-3 px-1 pb-1 pt-3">
									<div class="grid grid-cols-2 gap-2">
										<div>
											<label class={label} for="ai-lim-img">Gambar / hari</label>
											<input id="ai-lim-img" type="number" min={0} max={1000} bind:value={limitDraft.image} class={cn(field, 'tabular-nums')} />
										</div>
										<div>
											<label class={label} for="ai-lim-vid">Video / hari</label>
											<input id="ai-lim-vid" type="number" min={0} max={100} bind:value={limitDraft.video} class={cn(field, 'tabular-nums')} />
										</div>
									</div>
									<div class="flex items-center gap-3">
										<button type="button" onclick={saveLimits} class="h-8 rounded-lg bg-white px-3 text-[12px] font-medium text-black hover:opacity-90">Simpan</button>
										<span class="text-[11px] text-neutral-500">{limitMsg || '0 = tanpa batas · kendali biaya penyedia'}</span>
									</div>
								</div>
							{/if}
						</div>

						<div>
							{@render optionHead('provider', 'Penyedia AI', '')}
							{#if openOption === 'provider'}
								<div class="space-y-1.5 px-1 pb-1 pt-3 text-[12px] text-neutral-400">
									<p>
										Gambar: <span class="text-neutral-200">{config?.image?.configured ? `${config.image.provider} · ${config.image.model}` : 'belum dipasang'}</span>
									</p>
									<p>
										Video: <span class="text-neutral-200">{config?.video?.configured ? `${config.video.provider} · ${config.video.model}` : 'belum dipasang'}</span>
									</p>
									<p class="pt-1 text-[11px] text-neutral-500">Diatur di server API: AI_IMAGE_PROVIDER, AI_VIDEO_PROVIDER + kunci API.</p>
								</div>
							{/if}
						</div>

						<p class="px-1 pt-2 text-[11px] leading-relaxed text-neutral-500">
							Hindari tokoh nyata, merek, dan karya berhak cipta dalam prompt.
						</p>
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	/* Kerangka "sedang dibuat" berkilau, dan hasil yang muncul perlahan. */
	.ai-shimmer {
		background: linear-gradient(110deg, #181818 30%, #232323 50%, #181818 70%);
		background-size: 220% 100%;
		animation: ai-shimmer 1.6s linear infinite;
	}
	@keyframes ai-shimmer {
		to {
			background-position: -220% 0;
		}
	}
	.ai-fade {
		animation: ai-fade 0.35s ease-out;
	}
	@keyframes ai-fade {
		from {
			opacity: 0;
			transform: scale(0.985);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ai-shimmer,
		.ai-fade {
			animation: none;
		}
	}
	.ai-editor :global(::selection) {
		background: rgba(167, 139, 250, 0.35);
	}
	/* Tema gelap: penanda fokus putih (bukan ungu CMS); kolom isian cukup tepinya yang menyala. */
	.ai-editor :global(:focus-visible) {
		outline-color: rgba(255, 255, 255, 0.55);
	}
	.ai-editor :global(textarea:focus-visible),
	.ai-editor :global(input:focus-visible) {
		outline: none;
	}
</style>
