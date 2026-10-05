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
		} catch {
			presets = [50000, 100000, 150000, 200000, 250000, 350000, 500000];
			sharePct = '70';
		} finally {
			loading = false;
		}
	}

	async function savePresets(values: number[]) {
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
		<p class="text-sm text-ash mb-5">Pilihan harga cepat yang muncul saat upload / edit foto.</p>

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
	</div>
</div>
