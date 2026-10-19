<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import { inputCls, cn } from '$lib/ui-classes';
	import {
		SKIP_SHORT,
		fmtWib,
		idemHeaders,
		type AutoPayoutOverview,
		type PayoutRun,
		type ProcessingPayout,
		type PreviewRow
	} from '$lib/auto-payout';
	import Panel from './Panel.svelte';
	import Kicker from './Kicker.svelte';
	import Btn from './Btn.svelte';
	import Field from './Field.svelte';
	import Modal from './Modal.svelte';
	import Spinner from './Spinner.svelte';
	import Skeleton from './Skeleton.svelte';
	import EmptyState from './EmptyState.svelte';

	/**
	 * Pencairan OTOMATIS bagi hasil (API /payouts/auto). Pengaturan jadwal disimpan di Setting (payout_auto_*);
	 * gateway (DOKU / simulasi) dipasang lewat env server — panel ini hanya menampilkan statusnya.
	 */
	let { index = '02', onchange }: { index?: string; onchange?: () => void } = $props();

	let data = $state<AutoPayoutOverview | null>(null);
	let loadError = $state('');
	let form = $state({ enabled: false, day: '5', minAmount: '100000', holdDays: '14', fee: '0' });
	let saving = $state(false);
	let saveMsg = $state('');
	let running = $state<string | null>(null); // 'all' | contributorId
	let runMsg = $state('');
	let openRun = $state<string | null>(null);

	/** Aksi yang butuh catatan: tahan kontributor, atau tuntaskan payout menggantung. */
	type Action =
		| { kind: 'pause'; row: PreviewRow }
		| { kind: 'resolve'; payout: ProcessingPayout; outcome: 'COMPLETED' | 'FAILED' };
	let action = $state<Action | null>(null);
	let actionNote = $state('');
	let actionBusy = $state(false);
	let actionMsg = $state('');

	const FIELDS = [
		{ key: 'payout_auto_day', field: 'day', label: 'Tanggal tiap bulan', min: 1, max: 28 },
		{ key: 'payout_min_amount', field: 'minAmount', label: 'Minimum cair (Rp)', min: 10000, max: 100000000 },
		{ key: 'payout_hold_days', field: 'holdDays', label: 'Masa tahan (hari)', min: 0, max: 90 },
		{ key: 'payout_fee_contributor', field: 'fee', label: 'Biaya ke kontributor (Rp)', min: 0, max: 50000 }
	] as const;

	onMount(() => {
		void load();
	});

	async function load() {
		try {
			const d = await api<AutoPayoutOverview>('/payouts/auto');
			data = d;
			loadError = '';
			form = {
				enabled: d.config.enabled,
				day: String(d.config.day),
				minAmount: String(d.config.minAmount),
				holdDays: String(d.config.holdDays),
				fee: String(d.config.feeContributor)
			};
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Gagal memuat';
		}
	}

	async function save() {
		if (!data) return;
		saveMsg = '';
		for (const f of FIELDS) {
			const v = String(form[f.field] ?? '').trim();
			if (!/^\d+$/.test(v) || Number(v) < f.min || Number(v) > f.max) {
				saveMsg = `${f.label}: angka ${f.min.toLocaleString('id-ID')}–${f.max.toLocaleString('id-ID')}`;
				return;
			}
		}
		if (form.enabled && !data.gateway?.configured) {
			saveMsg = 'Gateway belum dipasang — jadwal tidak bisa dinyalakan';
			return;
		}
		saving = true;
		try {
			for (const f of FIELDS) {
				await api(`/settings/${f.key}`, { method: 'PATCH', body: JSON.stringify({ value: String(Number(form[f.field])) }) });
			}
			await api('/settings/payout_auto_enabled', { method: 'PATCH', body: JSON.stringify({ value: form.enabled ? '1' : '0' }) });
			saveMsg = 'Tersimpan';
			await load();
		} catch (err) {
			saveMsg = `Gagal menyimpan${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
		} finally {
			saving = false;
		}
	}

	async function run(row?: PreviewRow) {
		if (!data) return;
		const text = row
			? `Cairkan ${formatPrice(row.payable)} ke ${row.name} (${row.destination}) sekarang?`
			: `Cairkan ke ${data.totals.eligible} kontributor, total ${formatPrice(data.totals.amount)}, sekarang?`;
		const sim = data.gateway?.name === 'SIMULASI' ? '\n\nMode SIMULASI: tidak ada uang yang benar-benar dikirim.' : '';
		if (!confirm(text + sim)) return;
		running = row ? row.contributorId : 'all';
		runMsg = '';
		try {
			const r = await api<PayoutRun>('/payouts/auto/run', {
				method: 'POST',
				headers: idemHeaders(),
				body: JSON.stringify(row ? { contributorIds: [row.contributorId] } : {})
			});
			const pending = r.sent - r.succeeded - r.failed;
			runMsg = `Dikirim ${r.sent} · berhasil ${r.succeeded}${r.failed ? ` · gagal ${r.failed}` : ''}${pending ? ` · diproses ${pending}` : ''}`;
			await load();
			onchange?.();
		} catch (err) {
			runMsg = err instanceof Error ? err.message : 'Gagal menjalankan';
		} finally {
			running = null;
		}
	}

	async function resume(row: PreviewRow) {
		try {
			await api(`/payouts/auto/pause/${row.contributorId}`, { method: 'PUT', body: JSON.stringify({ paused: false }) });
			await load();
		} catch (err) {
			runMsg = err instanceof Error ? err.message : 'Gagal';
		}
	}

	function openAction(a: Action) {
		action = a;
		actionNote = '';
		actionMsg = '';
	}

	async function submitAction() {
		if (!action) return;
		actionBusy = true;
		actionMsg = '';
		try {
			if (action.kind === 'pause') {
				await api(`/payouts/auto/pause/${action.row.contributorId}`, {
					method: 'PUT',
					body: JSON.stringify({ paused: true, reason: actionNote.trim() || undefined })
				});
			} else {
				await api(`/payouts/${action.payout.id}/resolve`, {
					method: 'POST',
					headers: idemHeaders(),
					body: JSON.stringify({ outcome: action.outcome, note: actionNote.trim() || undefined })
				});
				onchange?.();
			}
			action = null;
			await load();
		} catch (err) {
			actionMsg = err instanceof Error ? err.message : 'Gagal';
		} finally {
			actionBusy = false;
		}
	}

	const age = (iso: string) => {
		const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
		return min < 60 ? `${min} menit` : min < 1440 ? `${Math.round(min / 60)} jam` : `${Math.round(min / 1440)} hari`;
	};
	const runTotal = (r: PayoutRun) => (r.summary ?? []).length;
</script>

<Panel class="mb-8">
	<div class="px-7 py-5 border-b hairline border-solid flex flex-wrap items-start justify-between gap-3">
		<div>
			<Kicker class="mb-1.5">{index} — Otomatis</Kicker>
			<p class="font-display text-lg">Pencairan otomatis</p>
		</div>
		{#if data}
			<span
				class={cn(
					'font-mono text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-[3px] border hairline',
					data.gateway?.configured ? 'text-ink' : 'text-safelight-dim border-safelight/30'
				)}
			>
				{#if !data.gateway}Gateway belum dipasang{:else}{data.gateway.name}{data.gateway.mode !== data.gateway.name.toLowerCase()
						? ` · ${data.gateway.mode}`
						: ''}{data.gateway.configured ? '' : ' · kunci belum lengkap'}{/if}
			</span>
		{/if}
	</div>

	{#if loadError}
		<p class="px-7 py-6 text-sm text-safelight-dim">{loadError}</p>
	{:else if !data}
		<div class="p-7"><Skeleton class="h-28" /></div>
	{:else}
		<div class="px-7 py-6 space-y-6">
			{#if !data.gateway?.configured}
				<p class="text-xs font-mono text-safelight-dim border-l-2 border-safelight pl-3 py-1">
					Server API belum punya gateway pencairan (PAYOUT_GATEWAY=doku + kunci SNAP + DOKU_PAYOUT_FROM_ACCOUNT).
					Sampai dipasang, cairkan manual lewat tombol Bayar di bawah.
				</p>
			{:else if data.gateway.name === 'SIMULASI'}
				<p class="text-xs font-mono text-ash border-l-2 border-ash-2 pl-3 py-1">
					Mode SIMULASI (lokal) — alur lengkap berjalan, tetapi tidak ada uang yang benar-benar dikirim.
				</p>
			{/if}

			<!-- Pengaturan -->
			<div>
				<label class="flex items-center gap-2.5 text-sm text-ink cursor-pointer mb-4">
					<input type="checkbox" bind:checked={form.enabled} class="accent-[var(--color-safelight)]" />
					Cairkan otomatis tiap bulan pukul 10.00 WIB
				</label>
				<div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
					{#each FIELDS as f (f.key)}
						<Field label={f.label}>
							<input type="number" min={f.min} max={f.max} bind:value={form[f.field]} class={cn(inputCls, 'tnum')} />
						</Field>
					{/each}
				</div>
				<p class="mt-2 font-mono text-[10px] text-ash-2">
					Masa tahan hanya untuk penjualan satuan (jaga-jaga refund) · biaya 0 = ditanggung Lakuna · rekening yang baru
					diganti menunggu 72 jam · nama pemilik dicocokkan dengan data bank sebelum transfer
				</p>
				<div class="mt-4 flex flex-wrap items-center gap-3">
					<Btn variant="dark" onclick={save} disabled={saving}>
						{#if saving}<Spinner />{/if}Simpan pengaturan
					</Btn>
					{#if saveMsg}
						<span class={cn('font-mono text-[11px]', /Gagal|angka|belum/.test(saveMsg) ? 'text-safelight-dim' : 'text-safelight')}>
							{saveMsg}
						</span>
					{/if}
				</div>
			</div>

			<!-- Jadwal & jalankan -->
			<div class="border-t hairline border-solid pt-5 flex flex-wrap items-center justify-between gap-4">
				<div class="min-w-0">
					<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-1">
						{data.config.enabled ? 'Jadwal berikutnya' : 'Jadwal mati'}
					</p>
					<p class="text-ink">
						{#if data.config.enabled}{fmtWib(data.nextRunAt)}{:else}Hanya lewat “Jalankan sekarang”{/if}
					</p>
					<p class="font-mono text-[11px] text-ash mt-0.5">
						{data.totals.eligible} kontributor siap dicairkan · {formatPrice(data.totals.amount)}
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					{#if runMsg}<span class="font-mono text-[11px] text-ash">{runMsg}</span>{/if}
					<Btn
						variant="primary"
						onclick={() => run()}
						disabled={!data.gateway?.configured || data.totals.eligible === 0 || running !== null}
					>
						{#if running === 'all'}<Spinner />Mengirim{:else}Jalankan sekarang{/if}
					</Btn>
				</div>
			</div>

			<!-- Pratinjau penerima -->
			{#if data.preview.length === 0}
				<EmptyState>Belum ada kontributor bersaldo</EmptyState>
			{:else}
				<ul class="divide-y divide-ink/10 border-t hairline border-solid">
					{#each data.preview as row (row.contributorId)}
						<li class="flex flex-wrap items-center justify-between gap-3 py-3.5">
							<div class="min-w-0 flex-1">
								<p class="text-ink truncate">{row.name}</p>
								<p class="font-mono text-[11px] text-ash-2 truncate">
									{row.destination ?? 'Belum ada rekening'}
									{#if row.held > 0} · ditahan {formatPrice(row.held)}{/if}
								</p>
								{#if row.paused && row.pausedReason}
									<p class="font-mono text-[11px] text-safelight-dim truncate">Ditahan: {row.pausedReason}</p>
								{/if}
							</div>
							<div class="flex items-center gap-3 shrink-0">
								<div class="text-right">
									<p class="font-display text-base tnum">{formatPrice(row.payable)}</p>
									<p
										class={cn(
											'font-mono text-[10px] uppercase tracking-wider',
											row.eligible ? 'text-safelight' : 'text-ash-2'
										)}
										title={row.reasonLabel ?? ''}
									>
										{row.eligible ? 'Siap cair' : SKIP_SHORT[row.reason!]}
									</p>
								</div>
								{#if row.eligible}
									<Btn onclick={() => run(row)} disabled={running !== null || !data.gateway?.configured}>
										{#if running === row.contributorId}<Spinner />{/if}Cairkan
									</Btn>
								{/if}
								{#if row.paused}
									<Btn onclick={() => resume(row)}>Lanjutkan</Btn>
								{:else}
									<Btn variant="danger" onclick={() => openAction({ kind: 'pause', row })}>Tahan</Btn>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			<!-- Transfer yang masih diproses gateway -->
			{#if data.processing.length > 0}
				<div class="border-t hairline border-solid pt-5">
					<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-3">Masih diproses gateway</p>
					<ul class="space-y-3">
						{#each data.processing as p (p.id)}
							{@const attention = p.failureReason?.startsWith('Perlu dicek manual')}
							<li class={cn('border hairline border-solid px-4 py-3', attention && 'border-safelight/40')}>
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div class="min-w-0">
										<p class="text-ink truncate">
											{p.contributor?.realName || p.contributor?.email} · <span class="tnum">{formatPrice(p.amount)}</span>
										</p>
										<p class="font-mono text-[11px] text-ash-2 truncate">
											{p.partnerRef} · {p.gateway} · {p.submittedAt ? `dikirim ${age(p.submittedAt)} lalu` : 'belum dikirim'}
										</p>
									</div>
									{#if attention}
										<div class="flex gap-2">
											<Btn onclick={() => openAction({ kind: 'resolve', payout: p, outcome: 'COMPLETED' })}>Tandai terkirim</Btn>
											<Btn variant="danger" onclick={() => openAction({ kind: 'resolve', payout: p, outcome: 'FAILED' })}>Tandai gagal</Btn>
										</div>
									{/if}
								</div>
								{#if attention}
									<p class="mt-2 text-xs font-mono text-safelight-dim">{p.failureReason}</p>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Riwayat run -->
			{#if data.runs.length > 0}
				<div class="border-t hairline border-solid pt-5">
					<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-3">Riwayat run</p>
					<ul class="divide-y divide-ink/10">
						{#each data.runs as r (r.id)}
							<li class="py-3">
								<button
									type="button"
									class="w-full flex flex-wrap items-center justify-between gap-2 text-left"
									onclick={() => (openRun = openRun === r.id ? null : r.id)}
									disabled={runTotal(r) === 0}
								>
									<span class="font-mono text-[11px] text-ink">
										{fmtWib(r.startedAt)} · {r.trigger === 'SCHEDULE' ? `terjadwal ${r.period}` : 'manual admin'}
									</span>
									<span class="font-mono text-[11px] text-ash tnum">
										{r.succeeded}/{r.sent} berhasil{r.failed ? ` · ${r.failed} gagal` : ''}{r.skipped
											? ` · ${r.skipped} dilewati ${openRun === r.id ? '▴' : '▾'}`
											: ''} · {formatPrice(r.totalAmount)}
									</span>
								</button>
								{#if openRun === r.id && r.summary}
									<ul class="mt-2 space-y-1 pl-3 border-l-2 border-ink/10">
										{#each r.summary as s (s.contributorId)}
											<li class="font-mono text-[11px] text-ash">
												{s.name} · {formatPrice(s.payable)} · {SKIP_SHORT[s.reason]}
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</Panel>

{#if action}
	<Modal
		kicker={action.kind === 'pause' ? 'Tahan pencairan otomatis' : action.outcome === 'COMPLETED' ? 'Tandai terkirim' : 'Tandai gagal'}
		title={action.kind === 'pause' ? action.row.name : `${formatPrice(action.payout.amount)} · ${action.payout.contributor?.realName || action.payout.contributor?.email}`}
		onclose={() => (action = null)}
	>
		{#if action.kind === 'pause'}
			<p class="text-sm text-ash mb-4">
				Saldo tetap milik kontributor dan tidak dikirim otomatis sampai dilanjutkan. Pencairan manual tetap bisa.
			</p>
		{:else if action.outcome === 'COMPLETED'}
			<p class="text-sm text-ash mb-4">
				Pastikan transfer {action.payout.partnerRef} memang SUKSES di dashboard {action.payout.gateway}. Saldo kontributor
				tidak berubah (sudah didebit).
			</p>
		{:else}
			<p class="text-sm text-ash mb-4">
				Pastikan transfer {action.payout.partnerRef} TIDAK ada / gagal di dashboard {action.payout.gateway}. Saldo
				{formatPrice(action.payout.amount)} dikembalikan ke kontributor dan dikirim lagi pada jadwal berikutnya.
			</p>
		{/if}
		<Field
			label={action.kind === 'pause'
				? 'Alasan (hanya terlihat admin)'
				: action.outcome === 'COMPLETED'
					? 'No. referensi bank (opsional)'
					: 'Alasan (ditampilkan ke kontributor)'}
		>
			<input type="text" bind:value={actionNote} maxlength={action.kind === 'pause' ? 300 : 100} class={inputCls} />
		</Field>
		{#if actionMsg}<p class="mt-3 font-mono text-[11px] text-safelight-dim">{actionMsg}</p>{/if}
		<div class="mt-6 flex gap-2">
			<Btn onclick={() => (action = null)} class="flex-1">Batal</Btn>
			<Btn variant="primary" onclick={submitAction} disabled={actionBusy} class="flex-1">
				{#if actionBusy}<Spinner />{/if}Konfirmasi
			</Btn>
		</div>
	</Modal>
{/if}
