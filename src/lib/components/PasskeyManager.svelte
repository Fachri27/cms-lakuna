<script lang="ts">
	import { onMount } from 'svelte';
	import {
		deletePasskey,
		listPasskeys,
		passkeyErrorMessage,
		passkeySupported,
		registerPasskey,
		type PasskeyDevice
	} from '$lib/passkey';
	import { inputCls, labelCls } from '$lib/ui-classes';
	import SectionHeader from './SectionHeader.svelte';
	import Panel from './Panel.svelte';
	import Kicker from './Kicker.svelte';
	import Btn from './Btn.svelte';
	import Skeleton from './Skeleton.svelte';
	import EmptyState from './EmptyState.svelte';

	/** Kelola passkey (login biometrik) akun yang sedang login. Dipakai halaman Admin & Kontributor. */

	let devices = $state<PasskeyDevice[]>([]);
	let loading = $state(true);
	let supported = $state(true);
	let deviceName = $state('');
	let password = $state('');
	let busy = $state(false);
	let message = $state('');
	let error = $state('');
	let removing = $state<string | null>(null);

	const fmt = (d: string | null) =>
		d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

	onMount(() => {
		supported = passkeySupported();
		// Nama bawaan dari perangkat ini supaya daftar mudah dibedakan.
		const ua = navigator.userAgent;
		deviceName = /iPhone|iPad/.test(ua)
			? 'iPhone / iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Mac/.test(ua)
					? 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: '';
		void load();
	});

	async function load() {
		loading = true;
		try {
			devices = await listPasskeys();
		} catch (err) {
			error = passkeyErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function add() {
		if (busy) return;
		if (!password) {
			error = 'Masukkan password akun untuk konfirmasi.';
			return;
		}
		busy = true;
		error = '';
		message = '';
		try {
			const d = await registerPasskey(deviceName, password);
			password = '';
			devices = [d, ...devices];
			message = 'Perangkat terdaftar. Berikutnya kamu bisa masuk dengan biometrik.';
		} catch (err) {
			error = passkeyErrorMessage(err);
		} finally {
			busy = false;
		}
	}

	async function remove(id: string) {
		if (removing) return;
		removing = id;
		error = '';
		message = '';
		try {
			await deletePasskey(id);
			devices = devices.filter((d) => d.id !== id);
			message = 'Perangkat dihapus.';
		} catch (err) {
			error = passkeyErrorMessage(err);
		} finally {
			removing = null;
		}
	}
</script>

<div class="rise py-10">
	<SectionHeader kicker="Keamanan" title="Login biometrik" class="mb-10" />

	<Panel class="p-7 mb-8">
		<Kicker class="mb-3">Daftarkan perangkat ini</Kicker>
		<p class="max-w-prose text-[0.95rem] leading-relaxed text-ash">
			Masuk CMS dengan sidik jari, Face ID, atau Windows Hello tanpa mengetik password. Daftarkan tiap perangkat yang
			kamu pakai. Password tetap berlaku.
		</p>

		{#if !supported}
			<p class="mt-6 font-mono text-[12px] text-safelight-dim">
				Peramban ini tidak mendukung passkey. Coba Chrome, Safari, atau Edge versi terbaru.
			</p>
		{:else}
			<div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
				<div class="sm:w-72">
					<label for="pk-name" class={labelCls}>Nama perangkat</label>
					<input id="pk-name" class={inputCls} maxlength="100" placeholder="mis. MacBook kantor" bind:value={deviceName} />
				</div>
				<div class="sm:w-60">
					<label for="pk-pass" class={labelCls}>Password akun</label>
					<input id="pk-pass" type="password" autocomplete="current-password" class={inputCls} maxlength="72" placeholder="Konfirmasi password" bind:value={password} />
				</div>
				<Btn variant="primary" disabled={busy} onclick={add}>
					{busy ? 'Menunggu biometrik…' : 'Daftarkan biometrik'}
				</Btn>
			</div>
		{/if}

		{#if message}
			<p role="status" class="mt-5 font-mono text-[12px] text-ink">{message}</p>
		{/if}
		{#if error}
			<p role="alert" class="mt-5 font-mono text-[12px] text-safelight-dim">{error}</p>
		{/if}
	</Panel>

	<Panel class="p-7">
		<Kicker class="mb-5">Perangkat terdaftar</Kicker>
		{#if loading}
			<Skeleton class="h-14" />
		{:else if devices.length === 0}
			<EmptyState>Belum ada perangkat</EmptyState>
		{:else}
			<ul class="divide-y hairline">
				{#each devices as d (d.id)}
					<li class="flex items-center justify-between gap-4 py-4">
						<div>
							<p class="text-[0.95rem] text-ink">{d.deviceName || 'Perangkat tanpa nama'}</p>
							<p class="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash-2">
								Didaftarkan {fmt(d.createdAt)} · Terakhir dipakai {fmt(d.lastUsedAt)}
							</p>
						</div>
						<Btn variant="danger" disabled={removing === d.id} onclick={() => remove(d.id)}>
							{removing === d.id ? 'Menghapus…' : 'Hapus'}
						</Btn>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>
