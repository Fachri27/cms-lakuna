<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope, apiFetch } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Subscription {
		id: string;
		userId: string;
		userName: string;
		userEmail: string;
		planQuota: number;
		billing: string;
		payOption: string;
		price: number;
		status: string;
		used: number;
		quota: number;
		expiresAt: string;
		startedAt: string;
		createdAt: string;
	}

	let subscriptions = $state<Subscription[]>([]);
	let fetching = $state(true);
	let expiring = $state<string | null>(null);

	async function fetchSubscriptions() {
		fetching = true;
		try {
			const res = await apiEnvelope<Subscription[]>('/subscription/admin');
			subscriptions = res.data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	async function handleExpire(userId: string, userName: string) {
		if (!confirm(`Yakin ingin expire subscription user "${userName}"?`)) return;
		expiring = userId;
		try {
			const res = await apiFetch(`/subscription/admin/${userId}/expire`, {
				method: 'PATCH',
				body: JSON.stringify({})
			});
			if (!res.ok) {
				const j = await res.json().catch(() => null);
				throw new Error(j?.error?.message ?? j?.message ?? 'Gagal expire subscription');
			}
			await fetchSubscriptions();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Gagal expire subscription');
		} finally {
			expiring = null;
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(fetchSubscriptions);
</script>

<div class="rise">
	<SectionHeader index="03" kicker="Transaksi" title="Pelanggan Aktif" class="mb-8">
		<Btn onclick={fetchSubscriptions} disabled={fetching} variant="ghost">
			{#if fetching}<Spinner />Memuat{:else}<span aria-hidden="true">↻</span>Perbarui{/if}
		</Btn>
	</SectionHeader>

	{#if fetching}
		<Panel class="p-7">
			<Skeleton class="h-64" />
		</Panel>
	{:else if subscriptions.length === 0}
		<Panel>
			<EmptyState>Belum ada subscription</EmptyState>
		</Panel>
	{:else}
		<Panel class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left border-b hairline border-solid">
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">User</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Email</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Paket</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Harga</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Status</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Pakai</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal">Berakhir</th>
						<th class="px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal text-right">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each subscriptions as sub}
						<tr class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors">
							<td class="px-7 py-4 text-ink">{sub.userName || '—'}</td>
							<td class="px-7 py-4 font-mono text-[11px] text-ash">{sub.userEmail}</td>
							<td class="px-7 py-4">
								<span class="font-display text-base tnum">{sub.planQuota}</span>
								<span class="font-mono text-[10px] text-ash-2 uppercase ml-1">{sub.billing}</span>
							</td>
							<td class="px-7 py-4 font-display text-base tnum">{formatPrice(sub.price)}</td>
							<td class="px-7 py-4"><Badge status={sub.status} /></td>
							<td class="px-7 py-4 font-mono text-[11px] text-ash tnum">{sub.used}/{sub.quota}</td>
							<td class="px-7 py-4 font-mono text-[11px] text-ash">
								{sub.expiresAt ? formatDate(sub.expiresAt) : '—'}
							</td>
							<td class="px-7 py-4 text-right">
								{#if sub.status === 'ACTIVE'}
									<Btn
										variant="danger"
										onclick={() => handleExpire(sub.userId, sub.userName)}
										disabled={expiring === sub.userId}
									>
										{expiring === sub.userId ? '…' : 'Expire'}
									</Btn>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="px-7 py-3 border-t hairline border-solid font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
				Total {subscriptions.length} subscription
			</div>
		</Panel>
	{/if}
</div>
