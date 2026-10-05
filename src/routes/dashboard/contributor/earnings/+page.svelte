<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, clearTokens } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Kicker from '$lib/components/Kicker.svelte';

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
		method: string;
		reference: string | null;
		status: string;
		createdAt: string;
	}

	const NAV = [
		{ label: 'Dashboard', href: '/dashboard/contributor' },
		{ label: 'Upload', href: '/dashboard/contributor/upload' },
		{ label: 'Penghasilan', href: '/dashboard/contributor/earnings' }
	];

	const pathname = $derived($page.url.pathname);

	let summary = $state<Summary | null>(null);
	let earnings = $state<Earning[]>([]);
	let payouts = $state<Payout[]>([]);
	let loading = $state(true);

	onMount(() => {
		(async () => {
			try {
				const [s, e, p] = await Promise.all([
					api<Summary>('/earnings/mine/summary'),
					api<Earning[]>('/earnings/mine?limit=50'),
					api<Payout[]>('/payouts/mine?limit=50')
				]);
				summary = s;
				earnings = e ?? [];
				payouts = p ?? [];
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

	function logout() {
		clearTokens();
		goto('/login');
	}
</script>

<div class="min-h-screen">
	<header class="bg-ink text-paper rounded-[3px]">
		<div class="px-6 pt-6 pb-4 flex items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2.5">
					<span aria-hidden="true" class="text-safelight text-lg leading-none">▣</span>
					<span class="font-display text-[1.4rem] leading-none tracking-[-0.01em]">Lakuna</span>
				</div>
				<p class="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40 pl-7">
					Kontributor
				</p>
			</div>
			<button
				onclick={logout}
				class="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/55 hover:text-safelight transition-colors"
			>
				Keluar
			</button>
		</div>
		<nav class="px-6 pb-5 flex gap-2">
			{#each NAV as item}
				{@const active = pathname === item.href}
				<a
					href={item.href}
					class={cn(
						'px-3.5 py-2 rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors',
						active ? 'bg-paper/[0.08] text-paper' : 'text-paper/55 hover:text-paper/90 hover:bg-paper/[0.04]'
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

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
										{p.method}
										{#if p.reference}<span class="text-ash"> · ref {p.reference}</span>{/if}
									</p>
									<p class="font-mono text-[11px] text-ash-2">
										{new Date(p.createdAt).toLocaleString('id-ID')}
									</p>
								</div>
								<span class="font-display text-base tnum shrink-0">−{formatPrice(p.amount)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Panel>
		</div>
	</div>
</div>
