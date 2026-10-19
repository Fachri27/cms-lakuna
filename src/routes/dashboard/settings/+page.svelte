<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls } from '$lib/ui-classes';
	import { cn } from '$lib/cn';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Kicker from '$lib/components/Kicker.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import Field from '$lib/components/Field.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let presets = $state<number[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let newPrice = $state('');
	let message = $state('');
	let sharePct = $state('70');
	let shareSaving = $state(false);
	let shareMsg = $state('');
	/** Setting gagal dimuat → simpan dinonaktifkan supaya nilai asli tidak tertimpa. */
	let loadFailed = $state(false);

	/** Batas unggah kontributor (API: modules/uploadLimit). 0 = tanpa batas; admin tak pernah dibatasi. */
	const LIMIT_FIELDS = [
		{ key: 'contributor_upload_daily_limit', label: 'Per hari', max: 10000 },
		{ key: 'contributor_upload_monthly_limit', label: 'Per bulan', max: 100000 },
		{ key: 'contributor_pending_limit', label: 'Antrean kurasi', max: 100000 },
		{ key: 'contributor_photo_max_mb', label: 'Maks foto (MB)', max: 2048 },
		{ key: 'contributor_video_max_mb', label: 'Maks video (MB)', max: 10240 }
	] as const;
	let limits = $state<Record<string, string>>({});
	let limitsSaving = $state(false);
	let limitsMsg = $state('');

	onMount(() => {
		void fetchSettings();
	});

	async function fetchSettings() {
		try {
			const [presetVal, shareVal] = await Promise.all([
				api<{ value?: string }>('/settings/photo_price_presets'),
				api<{ value?: string }>('/settings/contributor_share_percentage')
			]);
			presets = JSON.parse(presetVal?.value || '[]');
			sharePct = shareVal?.value || '70';
			const vals = await Promise.all(LIMIT_FIELDS.map((f) => api<{ value?: string }>(`/settings/${f.key}`)));
			limits = Object.fromEntries(LIMIT_FIELDS.map((f, i) => [f.key, vals[i]?.value ?? '']));
		} catch {
			// Nilai bawaan hanya ada di API (SETTING_DEFAULTS). Jangan isi angka tebakan di sini: menyimpan dari
			// keadaan itu akan menimpa preset & persentase yang sebenarnya.
			loadFailed = true;
			message = 'Gagal memuat setting. Muat ulang halaman sebelum mengubah.';
		} finally {
			loading = false;
		}
	}

	async function savePresets(values: number[]) {
		if (loadFailed) return;
		saving = true;
		message = '';
		try {
			await api('/settings/photo_price_presets', {
				method: 'PATCH',
				body: JSON.stringify({ value: JSON.stringify(values) })
			});
			presets = values;
			message = 'Berhasil disimpan';
		} catch {
			message = 'Gagal menyimpan';
		} finally {
			saving = false;
		}
	}

	function addPreset() {
		const price = Number(newPrice);
		if (!price || price <= 0) return;
		if (presets.includes(price)) {
			message = 'Harga sudah ada';
			return;
		}
		const updated = [...presets, price].sort((a, b) => a - b);
		void savePresets(updated);
		newPrice = '';
	}

	function removePreset(price: number) {
		void savePresets(presets.filter((p) => p !== price));
	}

	async function saveSharePct() {
		if (loadFailed) return;
		const n = Number(sharePct);
		if (!Number.isFinite(n) || n < 0 || n > 100) {
			shareMsg = 'Harus angka 0–100';
			return;
		}
		shareSaving = true;
		shareMsg = '';
		try {
			await api('/settings/contributor_share_percentage', {
				method: 'PATCH',
				body: JSON.stringify({ value: String(Math.floor(n)) })
			});
			shareMsg = 'Berhasil disimpan';
		} catch {
			shareMsg = 'Gagal menyimpan';
		} finally {
			shareSaving = false;
		}
	}

	async function saveLimits() {
		if (loadFailed) return;
		for (const f of LIMIT_FIELDS) {
			const v = String(limits[f.key] ?? '').trim();
			if (!/^\d+$/.test(v) || Number(v) > f.max) {
				limitsMsg = `Harus angka 0–${f.max.toLocaleString('id-ID')}: ${f.label}`;
				return;
			}
		}
		limitsSaving = true;
		limitsMsg = '';
		try {
			for (const f of LIMIT_FIELDS) {
				await api(`/settings/${f.key}`, { method: 'PATCH', body: JSON.stringify({ value: String(Number(limits[f.key])) }) });
			}
			limitsMsg = 'Berhasil disimpan';
		} catch (err) {
			limitsMsg = `Gagal menyimpan${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
		} finally {
			limitsSaving = false;
		}
	}

	function isError(m: string): boolean {
		return m.includes('Gagal') || m.includes('Harus') || m.includes('sudah');
	}
</script>

<div class="rise">
	<SectionHeader index="08" kicker="Sistem" title="Pengaturan" class="mb-8" />

	<div class="grid gap-5 sm:grid-cols-2 items-start">
	<Panel class="p-7">
		<Kicker class="mb-2">Preset</Kicker>
		<h2 class="font-display text-2xl tracking-[-0.01em] mb-2">Harga Foto</h2>
		<p class="text-sm text-ash mb-5">Pilihan harga cepat yang muncul saat upload / edit foto</p>

		{#if loading}
			<Skeleton class="h-12" />
		{:else}
			<div class="flex flex-wrap gap-2 mb-5">
				{#each presets as price (price)}
					<span class="inline-flex items-center gap-2 bg-ink/[0.06] px-2.5 py-1.5 rounded-[3px] text-xs tnum">
						{formatPrice(price)}
						<button
							type="button"
							onclick={() => removePreset(price)}
							class="text-ash-2 hover:text-safelight-dim"
							aria-label="Hapus"
						>
							✕
						</button>
					</span>
				{:else}
					<span class="font-mono text-[11px] text-ash-2 uppercase tracking-[0.14em]">
						Belum ada preset
					</span>
				{/each}
			</div>

			<div class="flex gap-2">
				<input
					type="number"
					min={0}
					bind:value={newPrice}
					onkeydown={(e) => {
						if ((e as KeyboardEvent).key === 'Enter') addPreset();
					}}
					placeholder="Tambah harga…"
					class={cn(inputCls, 'max-w-xs')}
				/>
				<Btn variant="dark" onclick={addPreset} disabled={saving || !newPrice}>
					{#if saving}<Spinner />{/if}
					Tambah
				</Btn>
			</div>

			{#if message}
				<p class={cn('mt-3 font-mono text-[11px]', isError(message) ? 'text-safelight-dim' : 'text-safelight')}>
					{message}
				</p>
			{/if}
		{/if}
	</Panel>

	<Panel class="p-7">
		<Kicker class="mb-2">Bagi Hasil</Kicker>
		<h2 class="font-display text-2xl tracking-[-0.01em] mb-2">Persentase Kontributor</h2>
		<p class="text-sm text-ash mb-5">
			Persentase penghasilan untuk kontributor dari setiap penjualan / langganan. Sisanya untuk
			platform.
		</p>
		<div class="flex gap-3 items-end">
			<Field label="Persentase" class="w-36">
				<input
					type="number"
					min={0}
					max={100}
					bind:value={sharePct}
					class={cn(inputCls, 'tnum')}
				/>
			</Field>
			<span class="font-display text-3xl text-ash pb-2.5">%</span>
			<Btn variant="dark" onclick={saveSharePct} disabled={shareSaving}>
				{#if shareSaving}<Spinner />Menyimpan{:else}Simpan{/if}
			</Btn>
		</div>
		{#if shareMsg}
			<p class={cn('mt-3 font-mono text-[11px]', isError(shareMsg) ? 'text-safelight-dim' : 'text-safelight')}>
				{shareMsg}
			</p>
		{/if}
	</Panel>

	<Panel class="p-7 sm:col-span-2">
		<Kicker class="mb-2">Kontributor</Kicker>
		<h2 class="font-display text-2xl tracking-[-0.01em] mb-2">Batas Unggah</h2>
		<p class="text-sm text-ash mb-5">
			Jumlah berkas yang boleh diunggah tiap kontributor per hari & per bulan (kalender WIB; dihapus atau ditolak
			tetap terhitung), jumlah karya yang boleh menunggu kurasi sekaligus, dan ukuran berkas maksimum (tak bisa
			melebihi batas server, bawaan 2 GB). Admin tidak dibatasi. Isi <span class="font-mono">0</span> untuk tanpa batas. Batas khusus atau pencabutan hak unggah per
			kontributor diatur di halaman Pengguna.
		</p>
		{#if loading}
			<Skeleton class="h-16" />
		{:else}
			<div class="grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{#each LIMIT_FIELDS as f (f.key)}
					<Field label={f.label}>
						<input type="number" min={0} max={f.max} bind:value={limits[f.key]} class={cn(inputCls, 'tnum')} />
					</Field>
				{/each}
			</div>
			<div class="mt-5 flex items-center gap-4">
				<Btn variant="dark" onclick={saveLimits} disabled={limitsSaving || loadFailed}>
					{#if limitsSaving}<Spinner />Menyimpan{:else}Simpan batas{/if}
				</Btn>
				{#if limitsMsg}
					<p class={cn('font-mono text-[11px]', isError(limitsMsg) ? 'text-safelight-dim' : 'text-safelight')}>{limitsMsg}</p>
				{/if}
			</div>
		{/if}
	</Panel>
	</div>
</div>
