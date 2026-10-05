<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, clearTokens } from '$lib/api';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Kicker from '$lib/components/Kicker.svelte';

	interface Photo {
		id: string;
		title: string;
		type: string;
		status: string;
	}

	const NAV = [
		{ label: 'Dashboard', href: '/dashboard/contributor' },
		{ label: 'Upload', href: '/dashboard/contributor/upload' },
		{ label: 'Penghasilan', href: '/dashboard/contributor/earnings' }
	];

	const pathname = $derived($page.url.pathname);

	let photos = $state<Photo[]>([]);
	let loading = $state(true);

	let pending = $derived(photos.filter((p) => p.status === 'PENDING'));
	let approved = $derived(photos.filter((p) => p.status === 'APPROVED'));
	let rejected = $derived(photos.filter((p) => p.status === 'REJECTED'));

	onMount(() => {
		void fetchMyPhotos();
	});

	async function fetchMyPhotos() {
		try {
			const data = await api<Photo[]>('/photos/my');
			photos = data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function statusLabel(s: string): string {
		if (s === 'APPROVED') return 'Disetujui';
		if (s === 'REJECTED') return 'Ditolak';
		return 'Menunggu';
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
		<SectionHeader index="01" kicker="Ringkasan" title="Studio Kontributor" class="mb-10" />

		<Panel class="p-7 mb-10">
			<Kicker class="mb-7">Status Foto</Kicker>
			{#if loading}
				<div class="grid grid-cols-3 gap-6">
					<Skeleton class="h-20" /><Skeleton class="h-20" /><Skeleton class="h-20" />
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-3">
					<Stat
						index="01"
						label="Menunggu"
						value={String(pending.length)}
						class="sm:pr-6 pb-6 sm:pb-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
					/>
					<Stat
						index="02"
						label="Disetujui"
						value={String(approved.length)}
						class="sm:px-6 py-6 sm:py-0 border-b sm:border-b-0 sm:border-r hairline border-solid"
					/>
					<Stat
						index="03"
						label="Ditolak"
						value={String(rejected.length)}
						class="sm:pl-6 pt-6 sm:pt-0"
					/>
				</div>
			{/if}
		</Panel>

		<Panel>
			<div class="px-7 py-5 border-b hairline border-solid">
				<Kicker class="mb-1.5">02 — Katalog</Kicker>
				<p class="font-display text-lg">Foto saya</p>
			</div>

			{#if loading}
				<div class="p-7 space-y-4">
					<Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton
						class="h-16"
					/>
				</div>
			{:else if photos.length === 0}
				<EmptyState>Belum ada foto diunggah</EmptyState>
			{:else}
				<ul class="divide-y divide-ink/10">
					{#each photos as photo (photo.id)}
						<li class="flex items-center gap-4 px-7 py-4 hover:bg-ink/[0.02] transition-colors">
							<div class="w-12 h-12 shrink-0 bg-ink text-paper rounded-[3px] flex items-center justify-center font-display text-lg">
								{(photo.title || '·').trim().charAt(0).toUpperCase()}
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-ink truncate">{photo.title}</p>
								<p class="font-mono text-[11px] text-ash-2 uppercase tracking-wider">{photo.type}</p>
							</div>
							<Badge status={photo.status}>{statusLabel(photo.status)}</Badge>
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>
	</div>
</div>
