<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope, apiFetch } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls, labelCls } from '$lib/ui-classes';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Contributor {
		id: string;
		email: string;
		realName: string | null;
		pending: number;
		paidOut: number;
		lifetimeEarned: number;
	}

	interface Payout {
		id: string;
		amount: number;
		method: string;
		reference: string | null;
		status: string;
		createdAt: string;
		contributor: { email: string; realName: string | null } | null;
	}

	interface Settlement {
		id: string;
		period: string;
		totalPool: number;
		totalDistributed: number;
		ranAt: string;
	}

	type PayMethod = 'BANK_TRANSFER' | 'EWALLET' | 'CASH';

	let contributors = $state<Contributor[]>([]);
	let payouts = $state<Payout[]>([]);
	let settlements = $state<Settlement[]>([]);
	let loading = $state(true);

	let selected = $state<Contributor | null>(null);
	let amount = $state('');
	let method = $state<PayMethod>('BANK_TRANSFER');
	let reference = $state('');
	let saving = $state(false);
	let message = $state('');

	let settlePeriod = $state('');
	let settleMsg = $state('');
	let settling = $state(false);

	async function fetchAll() {
		loading = true;
		try {
			const [c, p, s] = await Promise.all([
				apiEnvelope<Contributor[]>('/payouts/contributors'),
				apiEnvelope<Payout[]>('/payouts?limit=20'),
				apiEnvelope<Settlement[]>('/payouts/settlements')
			]);
			contributors = c.data ?? [];
			payouts = p.data ?? [];
			settlements = s.data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function submitPayout(e: SubmitEvent) {
		e.preventDefault();
		if (!selected) return;
		const pending = selected.pending;
		const parsed = Number(amount);
		if (!amount.trim() || Number.isNaN(parsed)) {
			message = 'Nominal tidak valid';
			return;
		}
		if (parsed <= 0) {
			message = 'Nominal harus lebih dari 0';
			return;
		}
		if (parsed > pending) {
			message = `Nominal melebihi saldo tertunda (${formatPrice(pending)})`;
			return;
		}
		const recipient = selected.realName || selected.email;
		if (
			!confirm(`Bayar ${formatPrice(parsed)} kepada ${recipient} via ${method}?`)
		)
			return;
		saving = true;
		message = '';
		try {
			const res = await apiFetch('/payouts', {
				method: 'POST',
				body: JSON.stringify({
					contributorId: selected.id,
					amount: Number(amount),
					method,
					reference: reference || undefined
				})
			});
			if (!res.ok) {
				const j = await res.json().catch(() => null);
				throw new Error(j?.message ?? j?.error?.message ?? 'Gagal mencatat payout');
			}
			selected = null;
			amount = '';
			reference = '';
			await fetchAll();
		} catch (err) {
			message = err instanceof Error ? err.message : 'Gagal mencatat payout';
		} finally {
			saving = false;
		}
	}

	async function runSettlement(e: SubmitEvent) {
		e.preventDefault();
		const period = settlePeriod.trim();
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
			settleMsg = 'Format periode tidak valid (gunakan YYYY-MM, mis. 2026-06)';
			return;
		}
		if (
			!confirm(
				`Jalankan settlement periode ${period}? Aksi ini tidak dapat dibatalkan (irreversible) — saldo kontributor akan dihitung ulang untuk periode tersebut.`
			)
		)
			return;
		settleMsg = '';
		settling = true;
		try {
			const res = await apiFetch('/payouts/settle', {
				method: 'POST',
				body: JSON.stringify({ period })
			});
			const j = await res.json().catch(() => null);
			if (!res.ok) throw new Error(j?.message ?? j?.error?.message ?? 'Gagal run settlement');
			const d = j?.data ?? {};
			settleMsg = `Selesai · pool ${formatPrice(d.totalPool ?? 0)} · dibagi ${formatPrice(d.totalDistributed ?? 0)}`;
			await fetchAll();
		} catch (err) {
			settleMsg = err instanceof Error ? err.message : 'Gagal run settlement';
		} finally {
			settling = false;
		}
	}

	function openPay(c: Contributor) {
		selected = c;
		amount = String(c.pending);
		message = '';
	}

	onMount(fetchAll);
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Pencairan" title="Bagi Hasil" class="mb-10" />

	<Panel class="mb-8">
		<div class="px-7 py-5 border-b hairline border-solid">
			<Kicker class="mb-1.5">02 — Settlement</Kicker>
			<p class="font-display text-lg">Settlement langganan</p>
		</div>
		<div class="px-7 py-6">
			<form onsubmit={runSettlement} class="flex flex-wrap items-center gap-3 mb-5">
				<input
					type="text"
					bind:value={settlePeriod}
					placeholder="YYYY-MM (mis. 2026-06)"
					class="{inputCls} w-52 font-mono"
				/>
				<Btn type="submit" variant="dark" disabled={!settlePeriod || settling}>
					{#if settling}<Spinner />Memproses{:else}Run Settlement{/if}
				</Btn>
				{#if settleMsg}
					<span class="font-mono text-[11px] text-ash">{settleMsg}</span>
				{/if}
			</form>

			{#if loading}
				<Skeleton class="h-16" />
			{:else if settlements.length === 0}
				<EmptyState>Belum ada settlement</EmptyState>
			{:else}
				<ul class="divide-y divide-ink/10 border-t">
					{#each settlements as s}
						<li class="flex items-center justify-between py-3.5">
							<span class="font-mono text-sm tnum">{s.period}</span>
							<span class="font-mono text-[11px] text-ash">
								pool {formatPrice(s.totalPool)} · dibagi
								<span class="text-safelight">{formatPrice(s.totalDistributed)}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Panel>

	<Panel class="mb-8">
		<div class="px-7 py-5 border-b hairline border-solid">
			<Kicker class="mb-1.5">03 — Saldo</Kicker>
			<p class="font-display text-lg">Kontributor</p>
		</div>
		{#if loading}
			<div class="p-7 space-y-4">
				<Skeleton class="h-14" /><Skeleton class="h-14" /><Skeleton class="h-14" />
			</div>
		{:else if contributors.length === 0}
			<EmptyState>Belum ada kontributor</EmptyState>
		{:else}
			<ul class="divide-y divide-ink/10">
				{#each contributors as c}
					<li class="flex items-center justify-between gap-4 px-7 py-4">
						<div class="min-w-0">
							<p class="text-ink truncate">{c.realName || c.email}</p>
							<p class="font-mono text-[11px] text-ash-2 truncate">{c.email}</p>
						</div>
						<div class="flex items-center gap-6 shrink-0">
							<div class="text-right">
								<p class="font-display text-lg tnum">{formatPrice(c.pending)}</p>
								<p class="font-mono text-[10px] uppercase tracking-wider text-ash-2">tertunda</p>
							</div>
							<Btn variant="primary" onclick={() => openPay(c)} disabled={c.pending <= 0}>Bayar</Btn>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	<Panel>
		<div class="px-7 py-5 border-b hairline border-solid">
			<Kicker class="mb-1.5">04 — Riwayat</Kicker>
			<p class="font-display text-lg">Pencairan terbaru</p>
		</div>
		{#if loading}
			<div class="p-7 space-y-4">
				<Skeleton class="h-14" /><Skeleton class="h-14" /><Skeleton class="h-14" />
			</div>
		{:else if payouts.length === 0}
			<EmptyState>Belum ada pencairan</EmptyState>
		{:else}
			<ul class="divide-y divide-ink/10">
				{#each payouts as p}
					<li class="flex items-center justify-between gap-4 px-7 py-4">
						<div class="min-w-0">
							<p class="text-ink truncate">{p.contributor?.realName || p.contributor?.email || '—'}</p>
							<p class="font-mono text-[11px] text-ash-2">
								{p.method} · {new Date(p.createdAt).toLocaleString('id-ID')}{p.reference ? ` · ref ${p.reference}` : ''}
							</p>
						</div>
						<div class="flex items-center gap-4 shrink-0">
							<Badge status={p.status} />
							<span class="font-display text-base tnum">{formatPrice(p.amount)}</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	{#if selected}
		<Modal kicker="Bayar Kontributor" title={selected.realName || selected.email} onclose={() => (selected = null)}>
			<p class="font-mono text-[11px] text-ash mb-6">Saldo tertunda {selected ? formatPrice(selected.pending) : ''}</p>

			<form onsubmit={submitPayout} class="space-y-4">
				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<label class={labelCls} for="pay-amount">Nominal</label>
						<input
							id="pay-amount"
							type="number"
							min={1}
							max={selected.pending}
							bind:value={amount}
							class="{inputCls} font-display tnum"
							placeholder="0"
						/>
					</div>
					<div>
						<label class={labelCls} for="pay-method">Metode</label>
						<select id="pay-method" bind:value={method} class={inputCls}>
							<option value="BANK_TRANSFER">Bank Transfer</option>
							<option value="EWALLET">E-Wallet</option>
							<option value="CASH">Cash</option>
						</select>
					</div>
				</div>
					<div>
						<label class={labelCls} for="pay-ref">Referensi (opsional)</label>
						<input
							id="pay-ref"
							type="text"
							bind:value={reference}
							class={inputCls}
							placeholder="No. bukti / referensi"
						/>
					</div>

					{#if message}
						<p class="text-safelight-dim text-xs font-mono border-l-2 border-safelight pl-3 py-1">{message}</p>
					{/if}

					<div class="flex gap-2 pt-2">
						<Btn variant="ghost" onclick={() => (selected = null)} class="flex-1">Batal</Btn>
						<Btn type="submit" variant="primary" disabled={saving} class="flex-1">
							{#if saving}<Spinner />Memproses{:else}Bayar{/if}
						</Btn>
					</div>
				</form>
		</Modal>
	{/if}
</div>
