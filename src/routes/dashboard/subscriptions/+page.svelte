<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, apiFetch } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls } from '$lib/ui-classes';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Field from '$lib/components/Field.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Plan {
		id: string;
		name: string;
		badge: string | null;
		description: string | null;
		quota: number;
		priceMonthly: number;
		priceAnnual: number;
		highlight: boolean;
		isActive: boolean;
	}

	let plans = $state<Plan[]>([]);
	let fetching = $state(true);
	let loading = $state(false);
	let showForm = $state(false);
	let editPlan = $state<Plan | null>(null);
	let form = $state({
		name: '',
		badge: '',
		description: '',
		quota: '',
		priceMonthly: '',
		priceAnnual: '',
		highlight: false,
		isActive: true
	});
	let errors = $state<Record<string, string>>({});

	let standarPrice = $state('');
	let savingPrice = $state(false);
	let priceMessage = $state<{ success: boolean; text: string } | null>(null);

	async function fetchPlans() {
		try {
			const res = await apiEnvelope<Plan[]>('/plans');
			plans = res.data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	async function fetchStandarPrice() {
		try {
			const d = await api<{ value: string }>('/settings/standar_plan_price');
			if (d?.value !== undefined) standarPrice = d.value;
		} catch (err) {
			console.error('Gagal mengambil harga paket standar', err);
		}
	}

	async function handleSaveStandarPrice() {
		if (!standarPrice) {
			priceMessage = { success: false, text: 'Harga tidak boleh kosong' };
			return;
		}
		savingPrice = true;
		priceMessage = null;
		try {
			const res = await apiFetch('/settings/standar_plan_price', {
				method: 'PATCH',
				body: JSON.stringify({ value: standarPrice })
			});
			const json = await res.json().catch(() => null);
			if (res.ok && json?.success !== false) {
				priceMessage = { success: true, text: 'Harga paket standar berhasil disimpan' };
			} else {
				priceMessage = { success: false, text: 'Gagal menyimpan harga' };
			}
		} catch (err) {
			priceMessage = {
				success: false,
				text: err instanceof Error ? err.message : 'Gagal menyimpan harga'
			};
		} finally {
			savingPrice = false;
		}
	}

	function openCreate() {
		editPlan = null;
		form = {
			name: '',
			badge: '',
			description: '',
			quota: '',
			priceMonthly: '',
			priceAnnual: '',
			highlight: false,
			isActive: true
		};
		errors = {};
		showForm = true;
	}

	function openEdit(plan: Plan) {
		editPlan = plan;
		form = {
			name: plan.name || '',
			badge: plan.badge || '',
			description: plan.description || '',
			quota: String(plan.quota),
			priceMonthly: String(plan.priceMonthly),
			priceAnnual: String(plan.priceAnnual),
			highlight: plan.highlight ?? false,
			isActive: plan.isActive ?? true
		};
		errors = {};
		showForm = true;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const newErrors: Record<string, string> = {};
		if (!form.name) newErrors.name = 'Nama wajib diisi';
		if (!form.quota) newErrors.quota = 'Quota wajib diisi';
		if (!form.priceMonthly) newErrors.priceMonthly = 'Harga monthly wajib diisi';
		if (!form.priceAnnual) newErrors.priceAnnual = 'Harga annual wajib diisi';
		if (Object.keys(newErrors).length > 0) {
			errors = newErrors;
			return;
		}
		loading = true;
		try {
			const payload = {
				name: form.name,
				badge: form.badge || null,
				description: form.description || null,
				quota: Number(form.quota),
				priceMonthly: Number(form.priceMonthly),
				priceAnnual: Number(form.priceAnnual),
				highlight: form.highlight,
				isActive: form.isActive
			};
			if (editPlan) {
				await apiFetch(`/plans/${editPlan.id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(
					async (r) => {
						if (!r.ok) {
							const j = await r.json().catch(() => null);
							throw new Error(j?.error?.message ?? j?.message ?? 'Terjadi kesalahan');
						}
					}
				);
			} else {
				await apiFetch('/plans', { method: 'POST', body: JSON.stringify(payload) }).then(
					async (r) => {
						if (!r.ok) {
							const j = await r.json().catch(() => null);
							throw new Error(j?.error?.message ?? j?.message ?? 'Terjadi kesalahan');
						}
					}
				);
			}
			showForm = false;
			fetching = true;
			await fetchPlans();
		} catch (err) {
			errors = { general: err instanceof Error ? err.message : 'Terjadi kesalahan' };
		} finally {
			loading = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus plan ini?')) return;
		try {
			const res = await apiFetch(`/plans/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const j = await res.json().catch(() => null);
				throw new Error(j?.error?.message ?? j?.message ?? 'Gagal menghapus plan');
			}
			plans = plans.filter((p) => p.id !== id);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Gagal menghapus plan');
		}
	}

	onMount(() => {
		fetchPlans();
		fetchStandarPrice();
	});
</script>

<div class="rise">
	<SectionHeader index="03" kicker="Langganan" title="Paket & Harga" class="mb-8">
		<Btn variant="primary" onclick={openCreate}>+ Tambah Paket</Btn>
	</SectionHeader>

	<Panel class="p-7 mb-10">
		<div class="flex items-start justify-between gap-6 mb-5">
			<div>
				<Kicker class="mb-2">Sekali Beli</Kicker>
				<h2 class="font-display text-2xl tracking-[-0.01em]">Paket Standar</h2>
				<p class="mt-1.5 text-sm text-ash">Harga per item yang tampil di halaman pricing.</p>
			</div>
			<div class="text-right shrink-0">
				<div class="font-display text-[2.2rem] leading-[0.9] tnum">
					{formatPrice(Number(standarPrice || 0))}
				</div>
				<div class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 mt-1">/item</div>
			</div>
		</div>
		<div class="flex gap-3 items-end">
			<Field label="Harga (Rp)" class="flex-1">
				<input
					type="number"
					bind:value={standarPrice}
					class={inputCls}
					placeholder="500000"
				/>
			</Field>
			<Btn variant="dark" onclick={handleSaveStandarPrice} disabled={savingPrice} class="h-[42px]">
				{#if savingPrice}<Spinner />Menyimpan{:else}Simpan{/if}
			</Btn>
		</div>
		{#if priceMessage}
			<p class="mt-3 font-mono text-[11px] {priceMessage.success ? 'text-safelight' : 'text-safelight-dim'}">
				{priceMessage.text}
			</p>
		{/if}
	</Panel>

	<Kicker class="mb-4">Paket Langganan</Kicker>

	{#if fetching}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<Skeleton class="h-56" /><Skeleton class="h-56" /><Skeleton class="h-56" />
		</div>
	{:else if plans.length === 0}
		<Panel>
			<EmptyState>Belum ada paket langganan</EmptyState>
		</Panel>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			{#each plans as plan}
				<Panel class="p-6 flex flex-col {plan.highlight ? 'border-safelight' : ''}">
					{#if plan.badge}
						<span class="kicker text-safelight mb-2">{plan.badge}</span>
					{/if}
					<h3 class="font-display text-xl mb-3">{plan.name}</h3>
					<div class="flex items-baseline gap-1.5 mb-1">
						<span class="font-display text-[3rem] leading-[0.85] tnum">{plan.quota}</span>
						<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">foto</span>
					</div>
					<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 mb-5">kuota / bulan</p>

					<div class="border-t hairline border-solid pt-4 space-y-2.5 mb-6">
						<div class="flex justify-between items-baseline">
							<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Monthly</span>
							<span class="font-display text-lg tnum">
								{formatPrice(plan.priceMonthly)}<span class="font-mono text-[10px] text-ash-2 ml-1">/bln</span>
							</span>
						</div>
						<div class="flex justify-between items-baseline">
							<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Annual</span>
							<span class="font-display text-lg tnum">
								{formatPrice(plan.priceAnnual)}<span class="font-mono text-[10px] text-ash-2 ml-1">/thn</span>
							</span>
						</div>
					</div>

					<div class="flex gap-2 mt-auto">
						<Btn variant="ghost" onclick={() => openEdit(plan)} class="flex-1">Edit</Btn>
						<Btn variant="danger" onclick={() => handleDelete(plan.id)} class="flex-1">Hapus</Btn>
					</div>
				</Panel>
			{/each}
		</div>
	{/if}

	{#if showForm}
		<Modal kicker="Langganan" title={editPlan ? 'Edit Paket' : 'Tambah Paket'} onclose={() => (showForm = false)}>
			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}
					<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>
				{/if}

			<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Nama Paket">
					<input
						type="text"
						bind:value={form.name}
						class={inputCls}
						placeholder="contoh: Populer"
					/>
					{#if errors.name}<p class="mt-1 font-mono text-[11px] text-safelight-dim">{errors.name}</p>{/if}
				</Field>

				<Field label="Badge (opsional)">
					<input
						type="text"
						bind:value={form.badge}
						class={inputCls}
						placeholder="contoh: Paling Populer"
					/>
				</Field>
			</div>

			<Field label="Deskripsi (opsional)">
				<input
					type="text"
					bind:value={form.description}
					class={inputCls}
					placeholder="contoh: Cocok untuk pemula"
				/>
			</Field>

			<Field label="Kuota Download">
				<input
					type="number"
					bind:value={form.quota}
					class={inputCls}
					placeholder="contoh: 10"
				/>
				{#if errors.quota}<p class="mt-1 font-mono text-[11px] text-safelight-dim">{errors.quota}</p>{/if}
			</Field>

			<div class="grid gap-5 sm:grid-cols-2">
				<Field label="Harga Monthly (Rp)">
					<input
						type="number"
						bind:value={form.priceMonthly}
						class={inputCls}
						placeholder="contoh: 2500000"
					/>
					{#if errors.priceMonthly}<p class="mt-1 font-mono text-[11px] text-safelight-dim">{errors.priceMonthly}</p>{/if}
				</Field>

				<Field label="Harga Annual (Rp)">
					<input
						type="number"
						bind:value={form.priceAnnual}
						class={inputCls}
						placeholder="contoh: 22000000"
					/>
					{#if errors.priceAnnual}<p class="mt-1 font-mono text-[11px] text-safelight-dim">{errors.priceAnnual}</p>{/if}
				</Field>
			</div>

				<div class="flex gap-6">
					<label class="inline-flex items-center gap-2 text-sm text-ink">
						<input type="checkbox" bind:checked={form.highlight} class="accent-current" />
						<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Highlight</span>
					</label>
					<label class="inline-flex items-center gap-2 text-sm text-ink">
						<input type="checkbox" bind:checked={form.isActive} class="accent-current" />
						<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Aktif</span>
					</label>
				</div>

				<div class="flex gap-3 pt-2">
					<Btn type="submit" variant="dark" disabled={loading} class="flex-1">
						{#if loading}<Spinner />Menyimpan{:else}Simpan{/if}
					</Btn>
					<Btn type="button" variant="ghost" onclick={() => (showForm = false)} class="flex-1">Batal</Btn>
				</div>
			</form>
		</Modal>
	{/if}
</div>
