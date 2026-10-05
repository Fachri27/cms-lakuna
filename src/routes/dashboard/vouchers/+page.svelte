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

	interface Voucher {
		id: string;
		code: string;
		description: string | null;
		scope: 'ORDER' | 'SUBSCRIPTION' | 'BOTH';
		valueType: 'PERCENT' | 'NOMINAL';
		value: number;
		maxDiscount: number | null;
		minSpend: number | null;
		startsAt: string;
		endsAt: string;
		isActive: boolean;
		quotaTotal: number | null;
		quotaPerUser: number;
		usedCount: number;
	}

	interface Meta {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	}

	const SCOPE_LABEL: Record<string, string> = {
		ORDER: 'Order foto',
		SUBSCRIPTION: 'Langganan',
		BOTH: 'Semua'
	};

	function toLocalInput(iso?: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function formatValue(v: Voucher): string {
		if (v.valueType === 'PERCENT') {
			const base = `${v.value}%`;
			if (v.maxDiscount) return `${base} · max ${formatPrice(v.maxDiscount)}`;
			return base;
		}
		return formatPrice(v.value);
	}

	function statusOf(v: Voucher): string {
		if (!v.isActive) return 'CANCELLED';
		const now = Date.now();
		if (new Date(v.endsAt).getTime() < now) return 'EXPIRED';
		if (new Date(v.startsAt).getTime() > now) return 'PENDING';
		return 'ACTIVE';
	}

	const emptyForm = {
		code: '',
		description: '',
		scope: 'BOTH' as Voucher['scope'],
		valueType: 'PERCENT' as Voucher['valueType'],
		value: '',
		maxDiscount: '',
		minSpend: '',
		startsAt: '',
		endsAt: '',
		isActive: true,
		quotaTotal: '',
		quotaPerUser: '1'
	};

	let vouchers = $state<Voucher[]>([]);
	let meta = $state<Meta | null>(null);
	let fetching = $state(true);
	let loading = $state(false);
	let showForm = $state(false);
	let editVoucher = $state<Voucher | null>(null);
	let search = $state('');
	let page = $state(1);
	let form = $state({ ...emptyForm });
	let errors = $state<Record<string, string>>({});

	async function fetchVouchers(p: number = page, s: string = search) {
		fetching = true;
		try {
			const q = `/vouchers?page=${p}&limit=10${s ? `&search=${encodeURIComponent(s)}` : ''}`;
			const res = await apiEnvelope<Voucher[]>(q);
			vouchers = res.data ?? [];
			meta = (res.meta as Meta) ?? null;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchVouchers();
	});

	// Refetch on page/search change (skip first run — covered by onMount).
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
		debounce = setTimeout(() => void fetchVouchers(p, s), 300);
		return () => clearTimeout(debounce);
	});

	function onSearchInput() {
		if (page !== 1) page = 1;
	}

	function openCreate() {
		editVoucher = null;
		form = { ...emptyForm };
		errors = {};
		showForm = true;
	}

	function openEdit(v: Voucher) {
		editVoucher = v;
		form = {
			code: v.code,
			description: v.description || '',
			scope: v.scope,
			valueType: v.valueType,
			value: String(v.value),
			maxDiscount: v.maxDiscount != null ? String(v.maxDiscount) : '',
			minSpend: v.minSpend != null ? String(v.minSpend) : '',
			startsAt: toLocalInput(v.startsAt),
			endsAt: toLocalInput(v.endsAt),
			isActive: v.isActive,
			quotaTotal: v.quotaTotal != null ? String(v.quotaTotal) : '',
			quotaPerUser: String(v.quotaPerUser)
		};
		errors = {};
		showForm = true;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const newErrors: Record<string, string> = {};
		if (!form.code.trim()) newErrors.code = 'Kode wajib diisi';
		if (!form.value || Number(form.value) <= 0) newErrors.value = 'Value harus > 0';
		if (form.valueType === 'PERCENT' && Number(form.value) > 100)
			newErrors.value = 'Persen maks 100';
		if (!form.startsAt) newErrors.startsAt = 'Mulai wajib diisi';
		if (!form.endsAt) newErrors.endsAt = 'Berakhir wajib diisi';
		if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt))
			newErrors.endsAt = 'Berakhir harus setelah mulai';
		if (Object.keys(newErrors).length > 0) {
			errors = newErrors;
			return;
		}
		loading = true;
		try {
			const payload = {
				code: form.code.trim().toUpperCase(),
				description: form.description.trim() || undefined,
				scope: form.scope,
				valueType: form.valueType,
				value: Number(form.value),
				maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
				minSpend: form.minSpend ? Number(form.minSpend) : null,
				startsAt: form.startsAt,
				endsAt: form.endsAt,
				isActive: form.isActive,
				quotaTotal: form.quotaTotal ? Number(form.quotaTotal) : null,
				quotaPerUser: Number(form.quotaPerUser) || 1
			};
			if (editVoucher) {
				await api(`/vouchers/${editVoucher.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
			} else {
				await api('/vouchers', { method: 'POST', body: JSON.stringify(payload) });
			}
			showForm = false;
			void fetchVouchers();
		} catch (err) {
			errors = { general: (err as Error)?.message || 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus voucher ini? Riwayat pemakaian ikut terhapus.')) return;
		try {
			await api(`/vouchers/${id}`, { method: 'DELETE' });
			void fetchVouchers();
		} catch (err) {
			alert((err as Error)?.message || 'Gagal menghapus voucher');
		}
	}

	async function toggleActive(v: Voucher) {
		try {
			await api(`/vouchers/${v.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ isActive: !v.isActive })
			});
			void fetchVouchers();
		} catch (err) {
			alert((err as Error)?.message || 'Gagal mengubah status');
		}
	}
</script>

<div class="rise">
	<SectionHeader index="06" kicker="Diskon" title="Voucher" class="mb-8">
		{#if !showForm}<Btn variant="primary" onclick={openCreate}>+ Tambah</Btn>{/if}
	</SectionHeader>

	{#if showForm}
		<Panel class="p-7">
			<div class="flex items-start justify-between gap-4 mb-6">
				<div>
					<Kicker class="mb-2">Diskon</Kicker>
					<h2 class="font-display text-2xl tracking-[-0.01em]">
						{editVoucher ? 'Edit Voucher' : 'Tambah Voucher'}
					</h2>
				</div>
				<Btn variant="ghost" onclick={() => (showForm = false)}>← Kembali</Btn>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>{/if}

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Kode">
						<input
							type="text"
							value={form.code}
							oninput={(e) => (form.code = (e.currentTarget as HTMLInputElement).value.toUpperCase())}
							maxlength={50}
							class={cn(inputCls, 'font-mono tracking-wide')}
							placeholder="cth. LEBARAN50"
						/>
						{#if errors.code}<p class="mt-1.5 text-safelight-dim text-xs font-mono">{errors.code}</p>{/if}
					</Field>

					<Field label="Cakupan">
						<select
							value={form.scope}
							onchange={(e) =>
								(form.scope = (e.currentTarget as HTMLSelectElement).value as Voucher['scope'])}
							class={inputCls}
						>
							<option value="BOTH">Semua</option>
							<option value="ORDER">Order foto</option>
							<option value="SUBSCRIPTION">Langganan</option>
						</select>
					</Field>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Tipe nilai">
						<select
							value={form.valueType}
							onchange={(e) =>
								(form.valueType = (e.currentTarget as HTMLSelectElement)
									.value as Voucher['valueType'])}
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

				<Field label="Min. belanja">
					<input
						type="number"
						min={0}
						value={form.minSpend}
						oninput={(e) => (form.minSpend = (e.currentTarget as HTMLInputElement).value)}
						class={cn(inputCls, 'tnum')}
						placeholder="0"
					/>
					<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional, rupiah)</span>
				</Field>

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Mulai berlaku">
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

				<div class="grid gap-5 sm:grid-cols-2">
					<Field label="Kuota total">
						<input
							type="number"
							min={1}
							value={form.quotaTotal}
							oninput={(e) => (form.quotaTotal = (e.currentTarget as HTMLInputElement).value)}
							class={cn(inputCls, 'tnum')}
							placeholder="∞"
						/>
						<span class="mt-1 block font-mono text-[10px] text-ash-2">(opsional)</span>
					</Field>
					<Field label="Kuota per-user">
						<input
							type="number"
							min={1}
							value={form.quotaPerUser}
							oninput={(e) => (form.quotaPerUser = (e.currentTarget as HTMLInputElement).value)}
							class={cn(inputCls, 'tnum')}
							placeholder="1"
						/>
					</Field>
				</div>

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
					<input
						type="checkbox"
						bind:checked={form.isActive}
						class="accent-safelight w-4 h-4"
					/>
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
			<SearchInput bind:value={search} placeholder="Cari kode voucher…" />
		</div>

		{#if fetching}
			<Panel class="p-7 space-y-3">
				<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
					class="h-12"
				/><Skeleton class="h-12" />
			</Panel>
		{:else if vouchers.length === 0}
			<Panel><EmptyState>Belum ada voucher</EmptyState></Panel>
		{:else}
			<Panel class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Kode</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Cakupan</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Nilai</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Periode</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Kuota</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Status</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each vouchers as v (v.id)}
							<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
								<td class="px-7 py-4"><span class="font-mono text-[12px] tracking-wide text-ink">{v.code}</span></td>
								<td class="px-7 py-4 text-ash">{SCOPE_LABEL[v.scope]}</td>
								<td class="px-7 py-4 text-ink tnum">{formatValue(v)}</td>
								<td class="px-7 py-4 text-ash-2 font-mono text-[11px]">
									{toLocalInput(v.startsAt).slice(0, 10)} → {toLocalInput(v.endsAt).slice(0, 10)}
								</td>
								<td class="px-7 py-4 text-ash tnum">
									{v.quotaTotal == null ? `${v.usedCount} / ∞` : `${v.usedCount} / ${v.quotaTotal}`}
								</td>
								<td class="px-7 py-4"><Badge status={statusOf(v)} /></td>
								<td class="px-7 py-4 text-right">
									<div class="flex justify-end gap-2">
										<Btn variant="ghost" onclick={() => toggleActive(v)}>
											{v.isActive ? 'Nonaktifkan' : 'Aktifkan'}
										</Btn>
										<Btn variant="ghost" onclick={() => openEdit(v)}>Edit</Btn>
										<Btn variant="danger" onclick={() => handleDelete(v.id)}>Hapus</Btn>
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
