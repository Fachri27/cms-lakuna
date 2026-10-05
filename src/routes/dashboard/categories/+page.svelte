<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiEnvelope, apiFetch } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Field from '$lib/components/Field.svelte';

	interface Category {
		id: string;
		name: string;
		description: string | null;
		imageUrl: string | null;
		imageKey: string | null;
	}

	const TH = 'px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal';

	let categories = $state<Category[]>([]);
	let totalPages = $state(0);
	let fetching = $state(true);
	let search = $state('');
	let page = $state(1);

	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let formLoading = $state(false);
	let saving = $state(false);
	let formName = $state('');
	let formDesc = $state('');
	let imageFile = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let errors = $state<Record<string, string>>({});

	async function fetchCategories() {
		fetching = true;
		try {
			const q = new URLSearchParams({ page: String(page), limit: '10' });
			if (search.trim()) q.set('search', search.trim());
			const res = await apiEnvelope<Category[]>(`/categories?${q.toString()}`);
			categories = res.data ?? [];
			totalPages = res.meta?.totalPages ?? 0;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchCategories();
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
			const t = setTimeout(() => void fetchCategories(), 350);
			return () => clearTimeout(t);
		}
		if (p !== prevPage) {
			prevPage = p;
			void fetchCategories();
		}
	});

	function resetForm() {
		formName = '';
		formDesc = '';
		imageFile = null;
		if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
		preview = null;
		errors = {};
	}

	function openCreate() {
		editingId = null;
		resetForm();
		showForm = true;
	}

	async function openEdit(id: string) {
		editingId = id;
		resetForm();
		showForm = true;
		formLoading = true;
		try {
			const cat = await api<Category>(`/categories/${id}`);
			formName = cat.name;
			formDesc = cat.description ?? '';
			preview = cat.imageUrl;
		} catch (err) {
			console.error(err);
			showForm = false;
			editingId = null;
			alert('Gagal memuat kategori');
		} finally {
			formLoading = false;
		}
	}

	function closeForm() {
		showForm = false;
		editingId = null;
		errors = {};
	}

	function handleImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
		imageFile = file;
		preview = URL.createObjectURL(file);
	}

	async function errorMessage(res: Response): Promise<string> {
		const j = (await res.json().catch(() => null)) as {
			error?: { message?: string };
			message?: string;
		} | null;
		return j?.error?.message ?? j?.message ?? `Request gagal (${res.status})`;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!formName.trim()) {
			errors = { name: 'Nama category wajib diisi' };
			return;
		}
		saving = true;
		try {
			const fd = new FormData();
			fd.append('name', formName.trim());
			if (formDesc.trim()) fd.append('description', formDesc.trim());
			if (imageFile) fd.append('image', imageFile);
			const res = await apiFetch(editingId ? `/categories/${editingId}` : '/categories', {
				method: editingId ? 'PATCH' : 'POST',
				body: fd
			});
			if (!res.ok) {
				errors = { general: await errorMessage(res) };
				return;
			}
			closeForm();
			await fetchCategories();
		} catch (err) {
			console.error(err);
			errors = { general: 'Terjadi kesalahan' };
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus category ini?')) return;
		try {
			const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				alert(await errorMessage(res));
				return;
			}
			await fetchCategories();
		} catch (err) {
			console.error(err);
			alert('Gagal menghapus category');
		}
	}
</script>

<div class="rise">
	<SectionHeader index="05" kicker="Taksonomi" title="Kategori" class="mb-8">
		<Btn variant="primary" onclick={openCreate}>+ Tambah</Btn>
	</SectionHeader>

	<div class="mb-6 max-w-sm">
		<SearchInput bind:value={search} placeholder="Cari kategori…" />
	</div>

	{#if showForm}
		<Panel class="p-7 mb-6">
			{#if formLoading}
				<div class="space-y-3">
					<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
						class="h-12"
					/>
				</div>
			{:else}
				<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-5">
					{editingId ? 'Edit Kategori' : 'Tambah Kategori'}
				</p>
				<form onsubmit={handleSubmit} class="space-y-5">
					{#if errors.general}
						<p class="text-safelight-dim text-xs font-mono">{errors.general}</p>
					{/if}
					<Field label="Nama">
						<input
							type="text"
							bind:value={formName}
							class={inputCls}
							placeholder="Nama kategori"
							autofocus
						/>
						{#if errors.name}
							<p class="mt-1.5 font-mono text-[11px] text-safelight-dim">{errors.name}</p>
						{/if}
					</Field>
					<Field label="Deskripsi (opsional)">
						<textarea
							bind:value={formDesc}
							rows={3}
							class={cn(inputCls, 'resize-none')}
							placeholder="Deskripsi kategori…"
						></textarea>
					</Field>
					<Field label="Gambar (opsional)">
						<button
							type="button"
							onclick={() => document.getElementById('cat-image-input')?.click()}
							class="w-full border border-dashed border-ink/20 rounded-[3px] p-5 text-center cursor-pointer hover:border-ink/40 transition-colors"
						>
							{#if preview}
								<img
									src={preview}
									alt="preview"
									class="mx-auto max-h-40 rounded-[3px] object-cover"
								/>
							{:else}
								<span class="font-mono text-[11px] uppercase tracking-[0.16em] text-ash"
									>Klik untuk upload gambar</span
								>
							{/if}
						</button>
						<input
							id="cat-image-input"
							type="file"
							accept="image/*"
							class="hidden"
							onchange={handleImage}
						/>
					</Field>
					<div class="flex gap-3 pt-2">
						<Btn type="submit" variant="dark" disabled={saving} class="flex-1">
							{#if saving}<Spinner />Menyimpan{:else}Simpan{/if}
						</Btn>
						<Btn type="button" variant="ghost" onclick={closeForm} class="flex-1">Batal</Btn>
					</div>
				</form>
			{/if}
		</Panel>
	{/if}

	{#if fetching}
		<Panel class="p-7 space-y-3">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
				class="h-12"
			/><Skeleton class="h-12" />
		</Panel>
	{:else if categories.length === 0}
		<Panel>
			<EmptyState>Belum ada kategori</EmptyState>
		</Panel>
	{:else}
		<Panel>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class={TH}>Gambar</th>
							<th class={TH}>Nama</th>
							<th class={TH}>Deskripsi</th>
							<th class="{TH} text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each categories as cat (cat.id)}
							<tr
								class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors"
							>
								<td class="px-7 py-4">
									{#if cat.imageUrl}
										<img
											src={cat.imageUrl}
											alt={cat.name}
											class="h-10 w-14 rounded-[3px] object-cover"
										/>
									{:else}
										<span class="text-xs text-ash">—</span>
									{/if}
								</td>
								<td class="px-7 py-4 text-ink">{cat.name}</td>
								<td class="px-7 py-4 text-ash">{cat.description || '—'}</td>
								<td class="px-7 py-4">
									<div class="flex justify-end gap-2">
										<Btn variant="ghost" onclick={() => void openEdit(cat.id)}>Edit</Btn>
										<Btn variant="danger" onclick={() => void handleDelete(cat.id)}>Hapus</Btn>
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
</div>
