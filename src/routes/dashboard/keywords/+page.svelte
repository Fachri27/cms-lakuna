<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, apiFetch } from '$lib/api';
	import { inputCls } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Field from '$lib/components/Field.svelte';

	interface Keyword {
		id: string;
		name: string;
	}

	const TH = 'px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal';

	let keywords = $state<Keyword[]>([]);
	let totalPages = $state(0);
	let fetching = $state(true);
	let saving = $state(false);
	let showForm = $state(false);
	let editKeyword = $state<Keyword | null>(null);
	let search = $state('');
	let page = $state(1);
	let formName = $state('');
	let errors = $state<Record<string, string>>({});

	async function fetchKeywords() {
		fetching = true;
		try {
			const q = new URLSearchParams({ page: String(page), limit: '10' });
			if (search.trim()) q.set('search', search.trim());
			const res = await apiEnvelope<Keyword[]>(`/keywords?${q.toString()}`);
			keywords = res.data ?? [];
			totalPages = res.meta?.totalPages ?? 0;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchKeywords();
	});

	let firstRun = true;
	let prevSearch = '';
	let prevPage = 1;
	$effect(() => {
		const s = search;
		const p = page;
		if (firstRun) {
			firstRun = false;
			prevSearch = s;
			prevPage = p;
			return;
		}
		if (s !== prevSearch) {
			prevSearch = s;
			if (p !== 1) {
				page = 1;
				return;
			}
			const t = setTimeout(() => void fetchKeywords(), 350);
			return () => clearTimeout(t);
		}
		if (p !== prevPage) {
			prevPage = p;
			void fetchKeywords();
		}
	});

	function openCreate() {
		editKeyword = null;
		formName = '';
		errors = {};
		showForm = true;
	}

	function openEdit(kw: Keyword) {
		editKeyword = kw;
		formName = kw.name;
		errors = {};
		showForm = true;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!formName.trim()) {
			errors = { name: 'Nama keyword wajib diisi' };
			return;
		}
		saving = true;
		try {
			const payload = { name: formName.trim() };
			if (editKeyword) {
				await api(`/keywords/${editKeyword.id}`, {
					method: 'PATCH',
					body: JSON.stringify(payload)
				});
			} else {
				await api('/keywords', { method: 'POST', body: JSON.stringify(payload) });
			}
			showForm = false;
			await fetchKeywords();
		} catch (err) {
			errors = { general: err instanceof Error ? err.message : 'Terjadi kesalahan' };
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus keyword ini?')) return;
		try {
			const res = await apiFetch(`/keywords/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as {
					error?: { message?: string };
					message?: string;
				} | null;
				alert(j?.error?.message ?? j?.message ?? 'Gagal menghapus keyword');
				return;
			}
			await fetchKeywords();
		} catch (err) {
			console.error(err);
			alert('Gagal menghapus keyword');
		}
	}
</script>

<div class="rise">
	<SectionHeader index="06" kicker="Taksonomi" title="Keyword" class="mb-8">
		<Btn variant="primary" onclick={openCreate}>+ Tambah</Btn>
	</SectionHeader>

	<div class="mb-6 max-w-sm">
		<SearchInput bind:value={search} placeholder="Cari keyword…" />
	</div>

	{#if fetching}
		<Panel class="p-7 space-y-3">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
				class="h-12"
			/><Skeleton class="h-12" />
		</Panel>
	{:else if keywords.length === 0}
		<Panel>
			<EmptyState>Belum ada keyword</EmptyState>
		</Panel>
	{:else}
		<Panel>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class={TH}>Nama</th>
							<th class="{TH} text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each keywords as kw (kw.id)}
							<tr
								class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors"
							>
								<td class="px-7 py-4 text-ink">{kw.name}</td>
								<td class="px-7 py-4">
									<div class="flex justify-end gap-2">
										<Btn variant="ghost" onclick={() => openEdit(kw)}>Edit</Btn>
										<Btn variant="danger" onclick={() => void handleDelete(kw.id)}>Hapus</Btn>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>
		<Pagination page={page} {totalPages} onchange={(p) => (page = p)} />
	{/if}

	{#if showForm}
		<Modal
			kicker="Taksonomi"
			title={editKeyword ? 'Edit Keyword' : 'Tambah Keyword'}
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
						placeholder="Nama keyword"
						autofocus
					/>
					{#if errors.name}
						<p class="mt-1.5 font-mono text-[11px] text-safelight-dim">{errors.name}</p>
					{/if}
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
