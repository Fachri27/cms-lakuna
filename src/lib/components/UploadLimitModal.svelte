<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { inputCls, labelCls, cn } from '$lib/ui-classes';
	import type { UploadQuota } from '$lib/upload-quota';
	import Modal from './Modal.svelte';
	import Field from './Field.svelte';
	import Btn from './Btn.svelte';
	import Spinner from './Spinner.svelte';
	import Skeleton from './Skeleton.svelte';
	import UploadQuotaPanel from './UploadQuotaPanel.svelte';

	/**
	 * Batas unggah KHUSUS satu kontributor (API: /upload-limits/users/:id). Kolom kosong = ikut batas global,
	 * 0 = tanpa batas. "Cabut hak unggah" menolak semua unggahannya, dengan alasan yang ditampilkan kepadanya.
	 */
	type Override = {
		dailyLimit: number | null;
		monthlyLimit: number | null;
		pendingLimit: number | null;
		blocked: boolean;
		reason: string | null;
		updatedAt: string;
	};
	type Global = { dailyLimit: number; monthlyLimit: number; pendingLimit: number };
	type Detail = { override: Override | null; quota: UploadQuota; global: Global };

	let {
		user,
		onclose,
		onsaved
	}: {
		user: { id: string; username: string; email: string };
		onclose: () => void;
		/** Dipanggil dengan pengaturan terbaru (null = kembali ke global). */
		onsaved: (override: Override | null) => void;
	} = $props();

	let detail = $state<Detail | null>(null);
	let loadError = $state('');
	let saving = $state(false);
	let message = $state('');
	let form = $state({ daily: '', monthly: '', pending: '', blocked: false, reason: '' });

	const toField = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
	const ph = (n: number | undefined) => (n === undefined ? '' : n === 0 ? 'global: tanpa batas' : `global: ${n}`);

	onMount(() => {
		void load();
	});

	async function load() {
		try {
			const d = await api<Detail>(`/upload-limits/users/${user.id}`);
			detail = d;
			form = {
				daily: toField(d.override?.dailyLimit),
				monthly: toField(d.override?.monthlyLimit),
				pending: toField(d.override?.pendingLimit),
				blocked: d.override?.blocked ?? false,
				reason: d.override?.reason ?? ''
			};
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Gagal memuat';
		}
	}

	function parseLimit(v: string | number | null, label: string): number | null {
		const s = String(v ?? '').trim();
		if (s === '') return null;
		if (!/^\d+$/.test(s) || Number(s) > 100000) throw new Error(`${label}: kosongkan, atau angka 0–100.000`);
		return Number(s);
	}

	async function save() {
		message = '';
		let body;
		try {
			body = {
				dailyLimit: parseLimit(form.daily, 'Per hari'),
				monthlyLimit: parseLimit(form.monthly, 'Per bulan'),
				pendingLimit: parseLimit(form.pending, 'Menunggu kurasi'),
				blocked: form.blocked,
				reason: form.reason.trim() || null
			};
		} catch (err) {
			message = (err as Error).message;
			return;
		}
		saving = true;
		try {
			const d = await api<Detail>(`/upload-limits/users/${user.id}`, { method: 'PUT', body: JSON.stringify(body) });
			detail = d;
			onsaved(d.override);
			message = 'Tersimpan';
		} catch (err) {
			message = `Gagal menyimpan${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
		} finally {
			saving = false;
		}
	}

	async function reset() {
		if (!confirm(`Kembalikan ${user.username} ke batas global${form.blocked ? ' dan pulihkan hak unggahnya' : ''}?`)) return;
		saving = true;
		message = '';
		try {
			const d = await api<Detail>(`/upload-limits/users/${user.id}`, { method: 'DELETE' });
			detail = d;
			form = { daily: '', monthly: '', pending: '', blocked: false, reason: '' };
			onsaved(null);
			message = 'Kembali ke batas global';
		} catch (err) {
			message = `Gagal${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
		} finally {
			saving = false;
		}
	}
</script>

<Modal kicker="Batas unggah" title={user.username} {onclose}>
	<p class="mb-5 font-mono text-[11px] text-ash">{user.email}</p>

	{#if loadError}
		<p class="text-sm text-safelight-dim">{loadError}</p>
	{:else if !detail}
		<Skeleton class="h-24" />
	{:else}
		<UploadQuotaPanel quota={detail.quota} viewer="admin" class="mb-6" />

		<div class="grid gap-4 sm:grid-cols-3">
			<Field label="Per hari">
				<input type="number" min={0} bind:value={form.daily} placeholder={ph(detail.global.dailyLimit)} class={cn(inputCls, 'tnum')} />
			</Field>
			<Field label="Per bulan">
				<input type="number" min={0} bind:value={form.monthly} placeholder={ph(detail.global.monthlyLimit)} class={cn(inputCls, 'tnum')} />
			</Field>
			<Field label="Menunggu kurasi">
				<input type="number" min={0} bind:value={form.pending} placeholder={ph(detail.global.pendingLimit)} class={cn(inputCls, 'tnum')} />
			</Field>
		</div>
		<p class="mt-2 font-mono text-[10px] text-ash-2">Kosong = ikut batas global · 0 = tanpa batas</p>

		<label class="mt-6 flex items-center gap-2.5 text-sm text-ink cursor-pointer">
			<input type="checkbox" bind:checked={form.blocked} class="accent-[var(--color-safelight)]" />
			Cabut hak unggah
		</label>
		<div class="mt-3">
			<label class={labelCls} for="upl-reason">Alasan (ditampilkan ke kontributor)</label>
			<textarea
				id="upl-reason"
				bind:value={form.reason}
				maxlength={300}
				rows={2}
				placeholder={form.blocked ? 'mis. Unggahan berulang melanggar ketentuan lisensi' : 'Opsional'}
				class={cn(inputCls, 'resize-y')}
			></textarea>
		</div>

		<div class="mt-6 flex flex-wrap items-center gap-3">
			<Btn variant="primary" onclick={save} disabled={saving}>
				{#if saving}<Spinner />{/if}Simpan
			</Btn>
			{#if detail.override}
				<Btn variant="ghost" onclick={reset} disabled={saving}>Kembalikan ke global</Btn>
			{/if}
			{#if message}
				<span
					class={cn(
						'font-mono text-[11px]',
						/Gagal|kosongkan/.test(message) ? 'text-safelight-dim' : 'text-safelight'
					)}>{message}</span
				>
			{/if}
		</div>
	{/if}
</Modal>
