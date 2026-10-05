<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { apiEnvelope, apiFetch, ApiError } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface Photo {
		id: string;
		title: string;
		thumbUrl: string;
		photographer: string;
		price: number;
		type?: string;
	}

	interface Meta {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	}

	let photos = $state<Photo[]>([]);
	let meta = $state<Meta>({ page: 1, limit: 12, total: 0, totalPages: 1 });
	let loading = $state(true);
	let deleting = $state<string | null>(null);

	let pages = $derived(
		Array.from({ length: meta.totalPages }, (_, i) => i + 1).filter(
			(p) => Math.abs(p - meta.page) <= 2 || p === 1 || p === meta.totalPages
		)
	);

	async function errorMessage(res: Response): Promise<string> {
		const j = (await res.json().catch(() => null)) as {
			error?: { message?: string };
			message?: string;
		} | null;
		return j?.error?.message ?? j?.message ?? `Request gagal (${res.status})`;
	}

	async function fetchPhotos(p: number) {
		loading = true;
		try {
			const res = await apiEnvelope<Photo[]>(`/photos?page=${p}&limit=12`);
			photos = res.data ?? [];
			meta = {
				page: res.meta?.page ?? p,
				limit: 12,
				total: res.meta?.total ?? photos.length,
				totalPages: res.meta?.totalPages ?? 1
			};
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const p = Number(page.url.searchParams.get('page') ?? '1') || 1;
		void fetchPhotos(p);
	});

	function goToPage(p: number) {
		if (p < 1 || p > meta.totalPages || p === meta.page) return;
		const url = new URL(page.url);
		url.searchParams.set('page', String(p));
		void goto(`${url.pathname}${url.search}`, { keepFocus: true });
		void fetchPhotos(p);
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus foto ini?')) return;
		deleting = id;
		try {
			const res = await apiFetch(`/photos/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				alert(await errorMessage(res));
				return;
			}
			photos = photos.filter((p) => p.id !== id);
		} catch (err) {
			console.error(err);
			alert(err instanceof ApiError ? err.message : 'Gagal menghapus foto');
		} finally {
			deleting = null;
		}
	}
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio" title="Foto / Video" class="mb-8">
		<a href="/dashboard/photos/create"><Btn variant="primary">+ Upload</Btn></a>
	</SectionHeader>

	{#if loading}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each Array.from({ length: 6 }) as _, i (i)}
				<Skeleton class="h-80" />
			{/each}
		</div>
	{:else if photos.length === 0}
		<Panel><EmptyState class="py-24">Belum ada foto</EmptyState></Panel>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each photos as photo (photo.id)}
				<figure
					class="group bg-card border hairline rounded-[3px] overflow-hidden shadow-[0_1px_0_rgba(16,15,13,0.04)]"
				>
					<div class="relative aspect-[4/3] overflow-hidden bg-ink/5">
						<img
							src={photo.thumbUrl}
							alt={photo.title}
							class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
						/>
					</div>
					<figcaption class="p-5">
						<div class="flex items-center justify-between gap-2">
							<h2
								class="font-display text-xl leading-tight tracking-[-0.01em] line-clamp-1"
							>
								{photo.title}
							</h2>
							{#if photo.type}<Badge status={photo.type} />{/if}
						</div>
						<p class="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
							{photo.photographer || '—'}
						</p>
						<p class="mt-3 font-display text-2xl tnum">{formatPrice(photo.price)}</p>
						<div class="flex gap-2 mt-4">
							<a href={`/dashboard/photos/${photo.id}/edit`} class="flex-1">
								<Btn variant="ghost" class="w-full">Edit</Btn>
							</a>
							<Btn
								variant="danger"
								onclick={() => void handleDelete(photo.id)}
								disabled={deleting === photo.id}
								class="flex-1"
							>
								{deleting === photo.id ? '…' : 'Hapus'}
							</Btn>
						</div>
					</figcaption>
				</figure>
			{/each}
		</div>
	{/if}

	{#if meta.totalPages > 1}
		<div class="flex justify-center items-center gap-1.5 mt-10 font-mono text-[11px] tnum">
			{#each pages as p, idx (p)}
				{@const prev = idx > 0 ? pages[idx - 1] : null}
				<span class="flex items-center gap-1.5">
					{#if prev !== null && p - prev > 1}<span class="text-ash-2">···</span>{/if}
					<button
						onclick={() => goToPage(p)}
						class={cn(
							'w-9 h-9 rounded-[3px] flex items-center justify-center transition-colors',
							meta.page === p
								? 'bg-ink text-paper'
								: 'border hairline border-solid text-ink hover:bg-ink/[0.04]'
						)}
					>
						{p}
					</button>
				</span>
			{/each}
		</div>
		<Pagination page={meta.page} totalPages={meta.totalPages} onchange={goToPage} />
	{/if}
</div>
