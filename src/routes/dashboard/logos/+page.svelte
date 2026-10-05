<script lang="ts">
	import { onMount } from 'svelte';
	import { api, apiFetch } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Field from '$lib/components/Field.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Logo {
		id: string;
		name: string;
		imageUrl: string | null;
	}

	let logos = $state<Logo[]>([]);
	let fetching = $state(true);

	let formName = $state('');
	let imageFile = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});
	let msg = $state('');

	let editingId = $state<string | null>(null);
	let editName = $state('');

	async function errorMessage(res: Response): Promise<string> {
		const j = (await res.json().catch(() => null)) as {
			error?: { message?: string };
			message?: string;
		} | null;
		return j?.error?.message ?? j?.message ?? `Request gagal (${res.status})`;
	}

	async function fetchLogos() {
		fetching = true;
		try {
			const data = await api<Logo[]>('/logos');
			logos = data ?? [];
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchLogos();
	});

	function onFile(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		imageFile = f;
		if (preview) URL.revokeObjectURL(preview);
		preview = f ? URL.createObjectURL(f) : null;
	}

	async function handleUpload(e: SubmitEvent) {
		e.preventDefault();
		errors = {};
		if (!formName.trim()) {
			errors = { name: 'Nama logo wajib diisi' };
			return;
		}
		if (!imageFile) {
			errors = { image: 'Pilih berkas logo (JPG/PNG/WebP)' };
			return;
		}
		saving = true;
		try {
			const fd = new FormData();
			fd.append('name', formName.trim());
			fd.append('image', imageFile);
			const res = await apiFetch('/logos', { method: 'POST', body: fd });
			if (!res.ok) {
				errors = { general: await errorMessage(res) };
				return;
			}
			formName = '';
			imageFile = null;
			if (preview) URL.revokeObjectURL(preview);
			preview = null;
			msg = 'Logo ditambahkan';
			setTimeout(() => (msg = ''), 2500);
			await fetchLogos();
		} catch (err) {
			console.error(err);
			errors = { general: 'Terjadi kesalahan' };
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Yakin ingin menghapus logo ini?')) return;
		try {
			const res = await apiFetch(`/logos/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				alert(await errorMessage(res));
				return;
			}
			await fetchLogos();
		} catch (err) {
			console.error(err);
			alert('Gagal menghapus logo');
		}
	}

	function startEdit(l: Logo) {
		editingId = l.id;
		editName = l.name;
	}

	async function saveEdit(id: string) {
		if (!editName.trim()) return;
		try {
			const res = await apiFetch(`/logos/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editName.trim() })
			});
			if (!res.ok) {
				alert(await errorMessage(res));
				return;
			}
			editingId = null;
			await fetchLogos();
		} catch (err) {
			console.error(err);
			alert('Gagal menyimpan nama');
		}
	}

	async function move(id: string, dir: -1 | 1) {
		const ids = logos.map((l) => l.id);
		const i = ids.indexOf(id);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= ids.length) return;
		[ids[i], ids[j]] = [ids[j], ids[i]];
		logos = ids.map((x) => logos.find((l) => l.id === x)!).filter(Boolean);
		try {
			const res = await apiFetch('/logos/order', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids })
			});
			if (!res.ok) await fetchLogos();
		} catch (err) {
			console.error(err);
			await fetchLogos();
		}
	}
</script>

<div class="rise">
	<SectionHeader index="04" kicker="Beranda" title="Logo Pelanggan" class="mb-8">
		<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
			Dinding “Dipercaya tim di”
		</span>
	</SectionHeader>

	<Panel class="mb-6">
		<p class="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">Unggah logo</p>
		<form onsubmit={handleUpload} class="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
			<Field label="Nama">
				<input
					bind:value={formName}
					maxlength={80}
					class={inputCls}
					placeholder="Contoh: KALA"
				/>
				{#if errors.name}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.name}</p>{/if}
			</Field>
			<Field label="Berkas (JPG / PNG / WebP)">
				<input type="file" accept="image/jpeg,image/png,image/webp" onchange={onFile} class={inputCls} />
				{#if errors.image}<p class="mt-1.5 font-mono text-xs text-safelight-dim">{errors.image}</p>{/if}
			</Field>
			<Btn type="submit" variant="primary" disabled={saving}>
				{#if saving}<Spinner />{:else}Unggah{/if}
			</Btn>
		</form>
		{#if preview}
			<div class="mt-4 flex items-center gap-4">
				<img src={preview} alt="Pratinjau logo" class="h-12 w-auto rounded bg-black/80 px-3 py-1" />
				<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">Pratinjau di atas gelap</p>
			</div>
		{/if}
		{#if errors.general}<p class="mt-3 font-mono text-xs text-safelight-dim">{errors.general}</p>{/if}
		{#if msg}<p class="mt-3 font-mono text-xs text-ink">{msg}</p>{/if}
	</Panel>

	{#if fetching}
		<Skeleton />
	{:else if logos.length === 0}
		<EmptyState>Belum ada logo — unggah di atas. Dinding beranda memakai wordmark dummy selama kosong.</EmptyState>
	{:else}
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
			{#each logos as l, i (l.id)}
				<li class="group relative overflow-hidden rounded-[3px] border border-ink/15 bg-card p-4">
					<div class="grid h-20 place-items-center rounded bg-black/85 px-3">
						{#if l.imageUrl}
							<img src={l.imageUrl} alt={l.name} class="max-h-14 w-auto max-w-full object-contain" />
						{:else}
							<span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">tanpa gambar</span>
						{/if}
					</div>
					{#if editingId === l.id}
						<div class="mt-3 flex gap-2">
							<input bind:value={editName} maxlength={80} class={cn(inputCls, 'py-1.5 text-sm')} />
							<Btn variant="primary" onclick={() => void saveEdit(l.id)}>OK</Btn>
							<Btn onclick={() => (editingId = null)}>Batal</Btn>
						</div>
					{:else}
						<p class="mt-3 truncate text-sm font-medium">{l.name}</p>
					{/if}
					<div class="absolute right-1.5 top-1.5 flex gap-1">
						<button
							type="button"
							onclick={() => void move(l.id, -1)}
							disabled={i === 0}
							class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 disabled:opacity-30"
							title="Geser kiri"
						>←</button>
						<button
							type="button"
							onclick={() => void move(l.id, 1)}
							disabled={i === logos.length - 1}
							class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 disabled:opacity-30"
							title="Geser kanan"
						>→</button>
						<button
							type="button"
							onclick={() => startEdit(l)}
							class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 hover:bg-safelight"
							title="Ubah nama"
						>✎</button>
						<button
							type="button"
							onclick={() => void handleDelete(l.id)}
							class="grid h-5 w-5 place-items-center rounded-full bg-black/55 font-mono text-[10px] text-white/90 hover:bg-safelight"
							title="Hapus"
						>✕</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
