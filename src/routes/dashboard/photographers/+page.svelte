<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, apiFetch } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Field from '$lib/components/Field.svelte';

	interface Photographer {
		id: string;
		name: string;
		bio: string | null;
	}

	const TH = 'px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal';

	let photographers = $state<Photographer[]>([]);
	let fetching = $state(true);
	let saving = $state(false);
	let showForm = $state(false);
	let editItem = $state<Photographer | null>(null);
	let search = $state('');
	let formName = $state('');
	let formBio = $state('');
	let errors = $state<Record<string, string>>({});

	async function fetchPhotographers() {
		fetching = true;
		try {
			const q = new URLSearchParams({ limit: '100' });
			if (search.trim()) q.set('search', search.trim());
			const res = await apiEnvelope<Photographer[]>(`/photographers?${q.toString()}`);
			photographers = res.data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchPhotographers();
	});

	let firstRun = true;
	let prevSearch = '';
	$effect(() => {
		const s = search;
		if (firstRun) {
			firstRun = false;
			prevSearch = s;
			return;
		}
		if (s !== prevSearch) {
			prevSearch = s;
			const t = setTimeout(() => void fetchPhotographers(), 350);
			return () => clearTimeout(t);
		}
	});

	function openCreate() {
		editItem = null;
		formName = '';
		formBio = '';
		errors = {};
		showForm = true;
	}

	function openEdit(item: Photographer) {
		editItem = item;
		formName = item.name;
		formBio = item.bio ?? '';
		errors = {};
		showForm = true;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!formName.trim()) {
			errors = { name: 'Nama fotografer wajib diisi' };
			return;
		}
		saving = true;
		try {
			const payload = { name: formName.trim(), bio: formBio.trim() || undefined };
			if (editItem) {
				await api(`/photographers/${editItem.id}`, {
					method: 'PATCH',
					body: JSON.stringify(payload)
				});
			} else {
				await api('/photographers', { method: 'POST', body: JSON.stringify(payload) });
			}
			showForm = false;
			await fetchPhotographers();
		} catch (err) {
			errors = { general: err instanceof Error ? err.message : 'Terjadi kesalahan' };
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus fotografer ini?')) return;
		try {
			const res = await apiFetch(`/photographers/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as {
					error?: { message?: string };
					message?: string;
				} | null;
				alert(j?.error?.message ?? j?.message ?? 'Gagal menghapus fotografer');
				return;
			}
			await fetchPhotographers();
		} catch (err) {
			console.error(err);
			alert('Gagal menghapus fotografer');
		}
	}
</script>

<div class="rise">
	<SectionHeader index="07" kicker="Studio" title="Fotografer" class="mb-8">
		<Btn variant="primary" onclick={openCreate}>+ Tambah</Btn>
	</SectionHeader>

	<div class="mb-6 max-w-sm">
		<SearchInput bind:value={search} placeholder="Cari fotografer…" />
	</div>

	{#if fetching}
		<Panel class="p-7 space-y-3">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
				class="h-12"
			/><Skeleton class="h-12" />
		</Panel>
	{:else if photographers.length === 0}
		<Panel>
			<EmptyState>Belum ada fotografer</EmptyState>
		</Panel>
	{:else}
		<Panel>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class={TH}>Nama</th>
							<th class={TH}>Bio</th>
							<th class="{TH} text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each photographers as item (item.id)}
							<tr
								class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors"
							>
								<td class="px-7 py-4 text-ink">{item.name}</td>
								<td class="px-7 py-4 text-ash">{item.bio || '—'}</td>
								<td class="px-7 py-4">
									<div class="flex justify-end gap-2">
										<Btn variant="ghost" onclick={() => openEdit(item)}>Edit</Btn>
										<Btn variant="danger" onclick={() => void handleDelete(item.id)}>Hapus</Btn>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>
	{/if}

	{#if showForm}
		<Modal
			kicker="Studio"
			title={editItem ? 'Edit Fotografer' : 'Tambah Fotografer'}
			onclose={() => (showForm = false)}
		>
			<form onsubmit={handleSubmit} class="space-y-5">
				{#if errors.general}
					<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>
				{/if}
				<Field label="Nama">
					<input
						type="text"
						bind:value={formName}
						class={inputCls}
						placeholder="Nama fotografer"
						autofocus
					/>
					{#if errors.name}
						<p class="mt-1.5 font-mono text-[11px] text-safelight-dim">{errors.name}</p>
					{/if}
				</Field>
				<Field label="Bio (opsional)">
					<textarea
						bind:value={formBio}
						rows={3}
						class={cn(inputCls, 'resize-none')}
						placeholder="Bio fotografer…"
					></textarea>
				</Field>
				<div class="flex gap-3 pt-2">
					<Btn type="submit" variant="dark" disabled={saving} class="flex-1">
						{#if saving}<Spinner />Menyimpan{:else}Simpan{/if}
					</Btn>
					<Btn type="button" variant="ghost" onclick={() => (showForm = false)} class="flex-1">
						Batal
					</Btn>
				</div>
			</form>
		</Modal>
	{/if}
</div>
