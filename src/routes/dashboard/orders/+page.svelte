<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface Order {
		id: string;
		userId: string;
		userName: string;
		userEmail: string;
		total: number;
		status: string;
		license?: string;
		createdAt: string;
	}

	let orders = $state<Order[]>([]);
	let page = $state(1);
	let limit = $state(20);
	let total = $state(0);
	let totalPages = $state(0);
	let fetching = $state(true);

	async function fetchOrders() {
		fetching = true;
		try {
			const res = await apiEnvelope<Order[]>(`/order/admin?page=${page}&limit=${limit}`);
			orders = res.data ?? [];
			total = res.meta?.total ?? 0;
			totalPages = res.meta?.totalPages ?? 0;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		fetchOrders();
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	onMount(fetchOrders);
</script>

<div class="rise">
	<SectionHeader index="03" kicker="Transaksi" title="Pesanan" class="mb-8" />

	{#if fetching}
		<Panel class="p-7 space-y-4">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" />
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" />
		</Panel>
	{:else if orders.length === 0}
		<Panel>
			<EmptyState>Belum ada order</EmptyState>
		</Panel>
	{:else}
		<Panel class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left border-b hairline border-solid">
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Order</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Pelanggan</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Nominal</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Status</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Lisensi</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Tanggal</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as order}
						<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
							<td class="px-7 py-4">
								<span class="font-mono text-xs text-ash tnum">{order.id.slice(0, 8)}</span>
							</td>
							<td class="px-7 py-4">
								<div class="text-ink">{order.userName}</div>
								<div class="font-mono text-[11px] text-ash-2">{order.userEmail}</div>
							</td>
							<td class="px-7 py-4 font-display text-base tnum">{formatPrice(order.total)}</td>
							<td class="px-7 py-4"><Badge status={order.status} /></td>
							<td class="px-7 py-4 font-mono text-[11px] text-ash">{order.license || '—'}</td>
							<td class="px-7 py-4 font-mono text-[11px] text-ash">{fmtDate(order.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Panel>
	{/if}

	<Pagination page={page} totalPages={totalPages} onchange={handlePageChange} />
</div>
