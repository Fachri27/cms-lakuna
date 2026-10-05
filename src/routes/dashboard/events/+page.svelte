<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';
	import { cn } from '$lib/cn';
	import { formatPrice } from '$lib/format';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Field from '$lib/components/Field.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface EventRow {
		id: string;
		name: string;
		description: string | null;
		valueType: 'PERCENT' | 'NOMINAL';
		value: number;
		maxDiscount: number | null;
		startsAt: string;
		endsAt: string;
		isActive: boolean;
		targetType: 'PHOTO' | 'PLAN';
		_count?: { eventPhotos: number; eventPlans: number };
	}

	interface EventDetail extends EventRow {
		eventPhotos: Array<{ photo: { id: string; title: string } }>;
		eventPlans: Array<{ plan: { id: string; quota: number } }>;
	}

	interface Meta {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	}

	interface PhotoOption {
		id: string;
		title: string;
		thumbUrl: string | null;
		price: number;
	}

	interface PlanOption {
		id: string;
		quota: number;
		priceMonthly: number;
		priceAnnual: number;
		isActive: boolean;
	}

	function toLocalInput(iso?: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function formatValue(v: EventRow): string {
		if (v.valueType === 'PERCENT') {
			const base = `${v.value}%`;
			if (v.maxDiscount) return `${base} · max ${formatPrice(v.maxDiscount)}`;
			return base;
		}
		return formatPrice(v.value);
	}

	function statusOf(e: EventRow): string {
		if (!e.isActive) return 'CANCELLED';
		const now = Date.now();
		if (new Date(e.endsAt).getTime() < now) return 'EXPIRED';
		if (new Date(e.startsAt).getTime() > now) return 'PENDING';
		return 'ACTIVE';
	}

	const emptyForm = {
		name: '',
		description: '',
		valueType: 'PERCENT' as EventRow['valueType'],
		value: '',
		maxDiscount: '',
		startsAt: '',
		endsAt: '',
		isActive: true,
		targetType: 'PHOTO' as EventRow['targetType']
	};

	let events = $state<EventRow[]>([]);
	let meta = $state<Meta | null>(null);
	let fetching = $state(true);
	let loading = $state(false);
	let showForm = $state(false);
	let editEvent = $state<EventDetail | null>(null);
	let search = $state('');
	let page = $state(1);
	let form = $state({ ...emptyForm });
	let errors = $state<Record<string, string>>({});

	let targetIds = $state<string[]>([]);
	let photoSearch = $state('');
	let photoOptions = $state<PhotoOption[]>([]);
	let planOptions = $state<PlanOption[]>([]);
	let fetchingTargets = $state(false);

	async function fetchEvents(p: number = page, s: string = search) {
		fetching = true;
		try {
			const q = `/events?page=${p}&limit=10${s ? `&search=${encodeURIComponent(s)}` : ''}`;
			const res = await apiEnvelope<EventRow[]>(q);
			events = res.data ?? [];
			meta = (res.meta as Meta) ?? null;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	async function fetchPlans() {
		try {
			const data = await api<PlanOption[]>('/plans');
			planOptions = data ?? [];
		} catch {
			/* abaikan */
		}
	}

	async function fetchPhotos(q: string) {
		fetchingTargets = true;
		try {
			const path = `/photos?limit=40${q ? `&search=${encodeURIComponent(q)}` : ''}`;
			const res = await apiEnvelope<PhotoOption[]>(path);
			photoOptions = res.data ?? [];
		} catch {
			photoOptions = [];
		} finally {
			fetchingTargets = false;
		}
	}

	onMount(() => {
		void fetchEvents();
	});

	// Refetch list on page/search change (skip first run — covered by onMount).
	let skipFirst = true;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const p = page;
		const s = search;
		if (skipFirst) {
			skipFirst = false;
			return;
		}
		clearTimeout(debounce);
		debounce = setTimeout(() => void fetchEvents(p, s), 300);
		return () => clearTimeout(debounce);
	});

	// Fetch plans once when the form opens.
	$effect(() => {
		if (!showForm) return;
		if (planOptions.length > 0) return;
		void fetchPlans();
	});

	// Fetch photos (debounced 300ms) when form open + target PHOTO.
	let photoTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const open = showForm;
		const t = form.targetType;
		const q = photoSearch;
		if (!open || t !== 'PHOTO') return;
		clearTimeout(photoTimer);
		photoTimer = setTimeout(() => void fetchPhotos(q), 300);
		return () => clearTimeout(photoTimer);
	});

	function onSearchInput() {
		if (page !== 1) page = 1;
	}

	function openCreate() {
		editEvent = null;
		form = { ...emptyForm };
		targetIds = [];
		photoSearch = '';
		errors = {};
		showForm = true;
	}

	async function openEdit(e: EventRow) {
		try {
			const detail = await api<EventDetail>(`/events/${e.id}`);
			editEvent = detail;
			form = {
				name: detail.name,
				description: detail.description || '',
				valueType: detail.valueType,
				value: String(detail.value),
				maxDiscount: detail.maxDiscount != null ? String(detail.maxDiscount) : '',
				startsAt: toLocalInput(detail.startsAt),
				endsAt: toLocalInput(detail.endsAt),
				isActive: detail.isActive,
				targetType: detail.targetType
			};
			targetIds =
				detail.targetType === 'PHOTO'
					? detail.eventPhotos.map((ep) => ep.photo.id)
					: detail.eventPlans.map((ep) => ep.plan.id);
			photoSearch = '';
			errors = {};
			showForm = true;
		} catch (err) {
			alert((err as Error)?.message || 'Gagal memuat event');
		}
	}

	function toggleTarget(id: string) {
		targetIds = targetIds.includes(id) ? targetIds.filter((x) => x !== id) : [...targetIds, id];
	}

	function switchTargetType(t: EventRow['targetType']) {
		form.targetType = t;
		targetIds = [];
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const newErrors: Record<string, string> = {};
		if (!form.name.trim()) newErrors.name = 'Nama wajib diisi';
		if (!form.value || Number(form.value) <= 0) newErrors.value = 'Value harus > 0';
		if (form.valueType === 'PERCENT' && Number(form.value) > 100)
			newErrors.value = 'Persen maks 100';
		if (!form.startsAt) newErrors.startsAt = 'Mulai wajib diisi';
		if (!form.endsAt) newErrors.endsAt = 'Berakhir wajib diisi';
		if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt))
			newErrors.endsAt = 'Berakhir harus setelah mulai';
		if (targetIds.length === 0) newErrors.targets = 'Pilih minimal 1 target';
		if (Object.keys(newErrors).length > 0) {
			errors = newErrors;
			return;
		}
		loading = true;
		try {
			const payload = {
				name: form.name.trim(),
				description: form.description.trim() || undefined,
				valueType: form.valueType,
				value: Number(form.value),
				maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
				startsAt: form.startsAt,
				endsAt: form.endsAt,
				isActive: form.isActive,
				targetType: form.targetType,
				...(form.targetType === 'PHOTO' ? { photoIds: targetIds } : { planIds: targetIds })
			};
			if (editEvent) {
				await api(`/events/${editEvent.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
			} else {
				await api('/events', { method: 'POST', body: JSON.stringify(payload) });
			}
			showForm = false;
			void fetchEvents();
		} catch (err) {
			errors = { general: (err as Error)?.message || 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus event ini?')) return;
		try {
			await api(`/events/${id}`, { method: 'DELETE' });
			void fetchEvents();
		} catch (err) {
			alert((err as Error)?.message || 'Gagal menghapus event');
		}
	}

	async function toggleActive(e: EventRow) {
		try {
			await api(`/events/${e.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ isActive: !e.isActive })
			});
			void fetchEvents();
		} catch (err) {
			alert((err as Error)?.message || 'Gagal mengubah status');
		}
	}
</script>

<div class="rise">
	<SectionHeader index="07" kicker="Diskon" title="Event Diskon" class="mb-8">
		{#if !showForm}<Btn variant="primary" onclick={openCreate}>+ Tambah</Btn>{/if}
	</SectionHeader>

	{#if showForm}
		<Panel class="p-7">
			<div class="flex items-start justify-between gap-4 mb-6">
				<div>
					<Kicker class="mb-2">Diskon</Kicker>
					<h2 class="font-display text-2xl tracking-[-0.01em]">
						{editEvent ? 'Edit Event' : 'Tambah Event'}
					</h2>
				</div>
				<Btn variant="ghost" onclick={() => (showForm = false)}>← Kembali</Btn>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>{/if}

				<Field label="Nama event">
					<input
						type="text"
						value={form.name}
						oninput={(e) => (form.name = (e.currentTarget as HTMLInputElement).value)}
						maxlength={120}
						class={inputCls}
						placeholder="cth. Flash Sale Lebaran"
					/>
					{#if errors.name}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.name}</p>{/if}
				</Field>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Tipe nilai">
						<select
							value={form.valueType}
							onchange={(e) =>
								(form.valueType = (e.currentTarget as HTMLSelectElement)
									.value as EventRow['valueType'])}
							class={inputCls}
						>
							<option value="PERCENT">Persen (%)</option>
							<option value="NOMINAL">Nominal (Rp)</option>
						</select>
					</Field>
					<Field label={form.valueType === 'PERCENT' ? 'Persen' : 'Nominal'}>
						<input
							type="number"
							min={1}
							value={form.value}
							oninput={(e) => (form.value = (e.currentTarget as HTMLInputElement).value)}
							class={cn(inputCls, 'tnum')}
							placeholder="0"
						/>
						{#if errors.value}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.value}</p>{/if}
					</Field>
				</div>

				{#if form.valueType === 'PERCENT'}
					<Field label="Cap maksimal">
						<input
							type="number"
							min={0}
							value={form.maxDiscount}
							oninput={(e) => (form.maxDiscount = (e.currentTarget as HTMLInputElement).value)}
							class={cn(inputCls, 'tnum')}
							placeholder="rupiah"
						/>
						<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
					</Field>
				{/if}

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Mulai">
						<input
							type="datetime-local"
							value={form.startsAt}
							oninput={(e) => (form.startsAt = (e.currentTarget as HTMLInputElement).value)}
							class={inputCls}
						/>
						{#if errors.startsAt}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.startsAt}</p>{/if}
					</Field>
					<Field label="Berakhir">
						<input
							type="datetime-local"
							value={form.endsAt}
							oninput={(e) => (form.endsAt = (e.currentTarget as HTMLInputElement).value)}
							class={inputCls}
						/>
						{#if errors.endsAt}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.endsAt}</p>{/if}
					</Field>
				</div>

				<Field label="Target diskon">
					<div class="flex gap-2 mb-3">
						{#each ['PHOTO', 'PLAN'] as t}
							<button
								type="button"
								onclick={() => switchTargetType(t as EventRow['targetType'])}
								class={cn(
									'flex-1 px-3 py-2 rounded-[3px] text-xs font-mono uppercase tracking-[0.14em] border hairline border-solid transition-colors',
									form.targetType === t
										? 'bg-ink text-paper border-ink'
										: 'text-ink hover:bg-ink/[0.04]'
								)}
							>
								{t === 'PHOTO' ? 'Foto tertentu' : 'Plan langganan'}
							</button>
						{/each}
					</div>

					{#if form.targetType === 'PHOTO'}
						<div class="mb-2">
							<SearchInput bind:value={photoSearch} placeholder="Cari foto…" />
						</div>
						<div class="max-h-56 overflow-y-auto border hairline border-solid rounded-[3px] divide-y divide-ink/10">
							{#if fetchingTargets}
								<div class="p-4"><Skeleton class="h-8" /></div>
							{:else if photoOptions.length === 0}
								<div class="p-4 font-mono text-[11px] text-ash-2 text-center">Tidak ada foto</div>
							{:else}
								{#each photoOptions as p (p.id)}
									{@const checked = targetIds.includes(p.id)}
									<label
										class={cn(
											'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-ink/[0.03]',
											checked && 'bg-ink/[0.04]'
										)}
									>
										<input
											type="checkbox"
											checked={checked}
											onchange={() => toggleTarget(p.id)}
											class="accent-safelight"
										/>
										{#if p.thumbUrl}<img src={p.thumbUrl} alt={p.title} class="w-10 h-10 rounded-[3px] object-cover" />{/if}
										<span class="text-sm text-ink flex-1 truncate">{p.title}</span>
										<span class="font-mono text-[10px] text-ash-2 tnum">{formatPrice(p.price)}</span>
									</label>
								{/each}
							{/if}
						</div>
					{:else}
						<div class="max-h-56 overflow-y-auto border hairline border-solid rounded-[3px] divide-y divide-ink/10">
							{#if planOptions.length === 0}
								<div class="p-4 font-mono text-[11px] text-ash-2 text-center">Tidak ada plan</div>
							{:else}
								{#each planOptions as p (p.id)}
									{@const checked = targetIds.includes(p.id)}
									<label
										class={cn(
											'flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-ink/[0.03]',
											checked && 'bg-ink/[0.04]'
										)}
									>
										<input
											type="checkbox"
											checked={checked}
											onchange={() => toggleTarget(p.id)}
											class="accent-safelight"
										/>
										<span class="text-sm text-ink flex-1">Quota <span class="tnum">{p.quota}</span></span>
										<span class="font-mono text-[10px] text-ash-2 tnum">{formatPrice(p.priceMonthly)}/bln</span>
										{#if !p.isActive}<span class="font-mono text-[9px] uppercase tracking-wider text-safelight-dim">nonaktif</span>{/if}
									</label>
								{/each}
							{/if}
						</div>
					{/if}

					{#if errors.targets}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.targets}</p>{/if}
					<p class="mt-1.5 font-mono text-[10px] text-ash-2">{targetIds.length} target terpilih</p>
				</Field>

				<Field label="Deskripsi">
					<textarea
						value={form.description}
						oninput={(e) => (form.description = (e.currentTarget as HTMLTextAreaElement).value)}
						rows={2}
						class={cn(inputCls, 'resize-none')}
						placeholder="Catatan internal…"
					></textarea>
					<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
				</Field>

				<label class="flex items-center gap-3 cursor-pointer">
					<input type="checkbox" bind:checked={form.isActive} class="accent-safelight w-4 h-4" />
					<span class="text-sm text-ink">Aktif</span>
				</label>

				<div class="flex gap-3 pt-2">
					<Btn type="submit" variant="dark" disabled={loading} class="flex-1">
						{#if loading}<Spinner />Menyimpan{:else}Simpan{/if}
					</Btn>
					<Btn type="button" variant="ghost" onclick={() => (showForm = false)} class="flex-1">
						Batal
					</Btn>
				</div>
			</form>
		</Panel>
	{:else}
		<div class="mb-6 max-w-sm" oninput={onSearchInput}>
			<SearchInput bind:value={search} placeholder="Cari event…" />
		</div>

		{#if fetching}
			<Panel class="p-7 space-y-3">
				<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
					class="h-12"
				/><Skeleton class="h-12" />
			</Panel>
		{:else if events.length === 0}
			<Panel><EmptyState>Belum ada event</EmptyState></Panel>
		{:else}
			<Panel class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Nama</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Target</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Nilai</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Periode</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Status</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each events as e (e.id)}
							{@const targetCount = e.targetType === 'PHOTO' ? (e._count?.eventPhotos ?? 0) : (e._count?.eventPlans ?? 0)}
							<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
								<td class="px-7 py-4 text-ink">{e.name}</td>
								<td class="px-7 py-4 text-ash">{e.targetType === 'PHOTO' ? 'Foto' : 'Plan'} · {targetCount} item</td>
								<td class="px-7 py-4 text-ink tnum">{formatValue(e)}</td>
								<td class="px-7 py-4 text-ash-2 font-mono text-[11px]">
									{toLocalInput(e.startsAt).slice(0, 10)} → {toLocalInput(e.endsAt).slice(0, 10)}
								</td>
								<td class="px-7 py-4"><Badge status={statusOf(e)} /></td>
								<td class="px-7 py-4 text-right">
									<div class="flex justify-end gap-2">
										<Btn variant="ghost" onclick={() => toggleActive(e)}>
											{e.isActive ? 'Nonaktifkan' : 'Aktifkan'}
										</Btn>
										<Btn variant="ghost" onclick={() => openEdit(e)}>Edit</Btn>
										<Btn variant="danger" onclick={() => handleDelete(e.id)}>Hapus</Btn>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</Panel>
			{#if meta}<Pagination page={page} totalPages={meta.totalPages} onchange={(p) => (page = p)} />{/if}
		{/if}
	{/if}
</div>
