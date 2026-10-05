<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import Kicker from '$lib/components/Kicker.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface Stats {
		totalPhotos: number;
		totalUsers: number;
		totalViews: number;
		totalRevenue: string;
	}
	interface Order {
		id: string;
		userName: string;
		userEmail: string;
		total: number;
		status: string;
		createdAt: string;
	}

	let stats = $state<Stats | null>(null);
	let recentOrders = $state<Order[]>([]);
	let loading = $state(true);

	async function fetchData() {
		loading = true;
		try {
			const [s, o] = await Promise.all([
				apiEnvelope<Stats>('/admin/stats'),
				apiEnvelope<Order[]>('/order/admin?limit=6')
			]);
			stats = s.data;
			recentOrders = o.data ?? [];
		} catch (err) {
			console.error('Failed to fetch dashboard data:', err);
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Ringkasan" title="Studio" class="mb-10">
		<Btn onclick={fetchData} disabled={loading} variant="ghost">
			{#if loading}<Spinner />Memuat{:else}<span aria-hidden>↻</span>Perbarui{/if}
		</Btn>
	</SectionHeader>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
		<Panel class="lg:col-span-2 p-7">
			<Kicker class="mb-7">Indeks</Kicker>
			{#if loading && !stats}
				<div class="grid grid-cols-3 gap-6">
					<Skeleton class="h-20" /><Skeleton class="h-20" /><Skeleton class="h-20" />
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-3">
					<Stat index="01" label="Foto" value={(stats?.totalPhotos ?? 0).toLocaleString('id-ID')} class="sm:pr-6 pb-6 sm:pb-0 border-b sm:border-b-0 sm:border-r hairline border-solid" />
					<Stat index="02" label="Pengguna" value={(stats?.totalUsers ?? 0).toLocaleString('id-ID')} class="sm:px-6 py-6 sm:py-0 border-b sm:border-b-0 sm:border-r hairline border-solid" />
					<Stat index="03" label="Tayangan" value={(stats?.totalViews ?? 0).toLocaleString('id-ID')} class="sm:pl-6 pt-6 sm:pt-0" />
				</div>
			{/if}
		</Panel>

		<div class="relative bg-ink text-paper rounded-[3px] p-7 overflow-hidden">
			<div aria-hidden class="absolute top-0 left-0 h-px w-16 bg-safelight"></div>
			<div aria-hidden class="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-safelight/10 blur-2xl"></div>
			<Kicker tone="paper" class="mb-7">Pendapatan</Kicker>
			{#if loading && !stats}
				<Skeleton class="h-16 w-2/3 bg-paper/10" />
			{:else}
				<p class="font-display text-[2.7rem] leading-[0.9] tracking-[-0.02em] text-safelight tnum">
					{stats?.totalRevenue ?? 'Rp 0'}
				</p>
				<p class="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/40">Tercatat · semua transaksi</p>
			{/if}
		</div>
	</div>

	<Panel>
		<div class="flex items-center justify-between px-7 py-5 border-b hairline border-solid">
			<div>
				<Kicker class="mb-1.5">02 — Pesanan Terbaru</Kicker>
				<p class="font-display text-lg">Transaksi terakhir</p>
			</div>
			<a href="/dashboard/orders" class="group inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ash hover:text-ink transition-colors">
				Lihat semua <span aria-hidden>↗</span>
			</a>
		</div>

		{#if loading}
			<div class="p-7 space-y-4">
				<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" />
			</div>
		{:else if recentOrders.length === 0}
			<EmptyState>Belum ada pesanan</EmptyState>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Pelanggan</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Nominal</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Status</th>
							<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Tanggal</th>
						</tr>
					</thead>
					<tbody>
						{#each recentOrders as order}
							<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
								<td class="px-7 py-4">
									<div class="text-ink">{order.userName}</div>
									<div class="font-mono text-[11px] text-ash-2">{order.userEmail}</div>
								</td>
								<td class="px-7 py-4 font-display text-base tnum">{formatPrice(order.total)}</td>
								<td class="px-7 py-4"><Badge status={order.status} /></td>
								<td class="px-7 py-4 font-mono text-[11px] text-ash">{fmtDate(order.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Panel>

	<p class="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-2">
		Lakuna Studio · {new Date().getFullYear()} · v2-svelte
	</p>
</div>
