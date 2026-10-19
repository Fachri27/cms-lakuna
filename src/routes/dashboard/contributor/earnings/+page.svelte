<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import { PAYOUT_STATUS_LABEL, fmtWib, type MyAutoPayout } from '$lib/auto-payout';

	interface Summary {
		pending: number;
		paidOut: number;
		lifetimeEarned: number;
		thisMonth: number;
	}

	interface Earning {
		id: string;
		source: 'STANDAR' | 'SUBSCRIPTION';
		amount: number;
		period: string | null;
		orderId: string | null;
		photo: { id: string; title: string } | null;
		createdAt: string;
	}

	interface Payout {
		id: string;
		amount: number;
		fee: number;
		method: string;
		reference: string | null;
		status: string;
		auto: boolean;
		failureReason: string | null;
		createdAt: string;
	}

	let summary = $state<Summary | null>(null);
	let auto = $state<MyAutoPayout | null>(null);
	let earnings = $state<Earning[]>([]);
	let payouts = $state<Payout[]>([]);
	let loading = $state(true);

	onMount(() => {
		(async () => {
			try {
				const [s, e, p, a] = await Promise.all([
					api<Summary>('/earnings/mine/summary'),
					api<Earning[]>('/earnings/mine?limit=50'),
					api<Payout[]>('/payouts/mine?limit=50'),
					// Panel pencairan otomatis opsional: API lama tanpa endpoint ini → panel disembunyikan.
					api<MyAutoPayout>('/payouts/mine/auto').catch(() => null)
				]);
				summary = s;
				earnings = e ?? [];
				payouts = p ?? [];
				auto = a;
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		})();
	});

	function sourceLabel(src: string): string {
		return src === 'STANDAR' ? 'Pembelian satuan' : 'Langganan';
	}

</script>

<div>
	<div class="rise py-10">
		<SectionHeader index="01" kicker="Penghasilan" title="Dompet" class="mb-10" />

		<Panel class="p-7 mb-10">
			<Kicker class="mb-7">Saldo</Kicker>
			{#if loading && !summary}
				<div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
					<Skeleton class="h-20" /><Skeleton class="h-20" /><Skeleton class="h-20" /><Skeleton
						class="h-20"
					/>
				</div>
			{:else}
				<div class="grid grid-cols-2 lg:grid-cols-4">
					<Stat
						index="01"
						label="Saldo tertunda"
						value={formatPrice(summary?.pending ?? 0)}
						class="pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r hairline border-solid"
					/>
					<Stat
						index="02"
						label="Total ditarik"
						value={formatPrice(summary?.paidOut ?? 0)}
						class="lg:px-6 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r hairline border-solid"
					/>
					<Stat
						index="03"
						label="Total penghasilan"
						value={formatPrice(summary?.lifetimeEarned ?? 0)}
						class="lg:px-6 pt-6 lg:pt-0 pr-6 border-r hairline border-solid"
					/>
					<Stat
						index="04"
						label="Bulan ini"
						value={formatPrice(summary?.thisMonth ?? 0)}
						class="lg:pl-6 pt-6 lg:pt-0"
					/>
				</div>
			{/if}
		</Panel>

		{#if auto}
			<Panel class="p-7 mb-10">
				<Kicker class="mb-2">Pencairan</Kicker>
				{#if auto.active}
					<h2 class="font-display text-xl tracking-[-0.01em] mb-1">Dikirim otomatis ke rekeningmu</h2>
					<p class="text-sm text-ash mb-6">
						Tiap tanggal {auto.day} pukul 10.00 WIB, saldo siap cair minimal {formatPrice(auto.minAmount)} ditransfer ke
						rekening pencairan di profilmu{auto.fee ? ` (biaya transfer ${formatPrice(auto.fee)} dipotong)` : ''}.
					</p>
				{:else}
					<h2 class="font-display text-xl tracking-[-0.01em] mb-1">Dicairkan oleh admin</h2>
					<p class="text-sm text-ash mb-6">Saldo siap cair ditransfer admin ke rekening pencairan di profilmu.</p>
				{/if}
				<div class="grid grid-cols-2 lg:grid-cols-3 gap-6">
					<div>
						<p class="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash mb-2">Siap cair</p>
						<p class="font-display text-2xl tnum">{formatPrice(auto.payable)}</p>
					</div>
					<div>
						<p class="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash mb-2">Masa tahan</p>
						<p class="font-display text-2xl tnum">{formatPrice(auto.held)}</p>
						<p class="font-mono text-[10px] text-ash-2 mt-1">penjualan {auto.holdDays} hari terakhir</p>
					</div>
					{#if auto.active}
						<div class="col-span-2 lg:col-span-1">
							<p class="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash mb-2">Jadwal berikutnya</p>
							<p class="font-display text-lg">{fmtWib(auto.nextRunAt)}</p>
						</div>
					{/if}
				</div>
				<!-- Masalah rekening tetap ditampilkan walau jadwal otomatis mati: admin pun butuh rekening yang benar. -->
				{#if auto.active || auto.reason === 'NO_ACCOUNT' || auto.reason === 'ACCOUNT_REJECTED'}
					<p
						class="mt-6 text-xs font-mono border-l-2 pl-3 py-1 {auto.eligible
							? 'border-safelight text-safelight'
							: 'border-ash-2 text-ash'}"
					>
						{#if auto.eligible}
							{formatPrice(auto.payable - auto.fee)} akan dikirim pada jadwal berikutnya
						{:else}
							{auto.reasonLabel}{auto.reason === 'NO_ACCOUNT' ? ' — isi di halaman profil situs Lakuna' : ''}
						{/if}
					</p>
				{/if}
			</Panel>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<Panel>
				<div class="px-7 py-5 border-b hairline border-solid">
					<Kicker class="mb-1.5">02 — Riwayat</Kicker>
					<p class="font-display text-lg">Penghasilan</p>
				</div>
				{#if loading}
					<div class="p-7 space-y-4">
						<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
							class="h-12"
						/>
					</div>
				{:else if earnings.length === 0}
					<EmptyState>Belum ada penghasilan</EmptyState>
				{:else}
					<ul class="divide-y divide-ink/10">
						{#each earnings as e (e.id)}
							<li class="flex items-center justify-between gap-4 px-7 py-4">
								<div class="min-w-0">
									<p class="text-ink truncate">
										{sourceLabel(e.source)}
										{#if e.photo}
											<span class="text-ash"> · {e.photo.title}</span>
										{:else if e.period}
											<span class="text-ash"> · {e.period}</span>
										{/if}
									</p>
									<p class="font-mono text-[11px] text-ash-2">
										{new Date(e.createdAt).toLocaleString('id-ID')}
									</p>
								</div>
								<span class="font-display text-base text-safelight tnum shrink-0">
									+{formatPrice(e.amount)}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Panel>

			<Panel>
				<div class="px-7 py-5 border-b hairline border-solid">
					<Kicker class="mb-1.5">03 — Pencairan</Kicker>
					<p class="font-display text-lg">Riwayat tarik</p>
				</div>
				{#if loading}
					<div class="p-7 space-y-4">
						<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" />
					</div>
				{:else if payouts.length === 0}
					<EmptyState>Belum ada pencairan</EmptyState>
				{:else}
					<ul class="divide-y divide-ink/10">
						{#each payouts as p (p.id)}
							<li class="flex items-center justify-between gap-4 px-7 py-4">
								<div class="min-w-0">
									<p class="text-ink">
										{p.auto ? 'Otomatis' : p.method}
										{#if p.reference}<span class="text-ash"> · ref {p.reference}</span>{/if}
									</p>
									<p class="font-mono text-[11px] text-ash-2">
										{new Date(p.createdAt).toLocaleString('id-ID')}{p.fee ? ` · biaya ${formatPrice(p.fee)}` : ''}
									</p>
									{#if p.status === 'FAILED' && p.failureReason}
										<p class="font-mono text-[11px] text-safelight-dim">{p.failureReason} · saldo dikembalikan</p>
									{/if}
								</div>
								<div class="flex flex-col items-end gap-1 shrink-0">
									<span class="font-display text-base tnum {p.status === 'FAILED' ? 'line-through text-ash-2' : ''}"
										>−{formatPrice(p.amount)}</span
									>
									{#if p.status !== 'COMPLETED'}
										<Badge status={p.status}>{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</Badge>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</Panel>
		</div>
	</div>
</div>
