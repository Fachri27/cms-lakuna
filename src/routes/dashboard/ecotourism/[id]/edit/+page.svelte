<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, ApiError } from '$lib/api';
	import type { EcoDestination } from '$lib/eco';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EcoDestinationForm from '$lib/components/EcoDestinationForm.svelte';

	// Di-encode: id dari URL tidak boleh membawa "../" ke path API (request bertoken admin).
	const id = encodeURIComponent(page.params.id ?? '');
	let detail = $state<EcoDestination | null>(null);
	let fetching = $state(true);
	let error = $state('');
	let deleting = $state(false);

	onMount(async () => {
		try {
			detail = await api<EcoDestination>(`/ecotourism/admin/${id}`);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal memuat destinasi';
		} finally {
			fetching = false;
		}
	});

	async function remove() {
		if (!detail || !confirm(`Hapus destinasi "${detail.name}"? Foto arsipnya tidak ikut terhapus.`)) return;
		deleting = true;
		try {
			await api(`/ecotourism/${id}`, { method: 'DELETE' });
			await goto('/dashboard/ecotourism');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Gagal menghapus';
			deleting = false;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio · Ekowisata" title={detail ? detail.name : 'Ubah destinasi'} class="mb-8">
		<div class="flex items-center gap-2">
			{#if detail}<Btn variant="danger" disabled={deleting} onclick={() => void remove()}>Hapus</Btn>{/if}
			<a href="/dashboard/ecotourism"><Btn variant="ghost">← Kembali</Btn></a>
		</div>
	</SectionHeader>

	{#if fetching}
		<div class="space-y-4"><Skeleton class="h-64" /><Skeleton class="h-48" /></div>
	{:else if error && !detail}
		<p class="text-sm text-safelight-dim" role="alert">{error}</p>
	{:else if detail}
		{#if error}<p class="mb-4 text-sm text-safelight-dim" role="alert">{error}</p>{/if}
		{#key detail.id}
			<EcoDestinationForm initial={detail} onsaved={(d) => (detail = d)} />
		{/key}
	{/if}
</div>
