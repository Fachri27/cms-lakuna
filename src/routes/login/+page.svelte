<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, setTokens } from '$lib/api';
	import { decodeJwt, getAccessToken, validateEmail } from '$lib/auth';
	import { inputCls, labelCls } from '$lib/ui-classes';
	import { loginWithPasskey, passkeyErrorMessage, passkeySupported } from '$lib/passkey';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);
	let biometricBusy = $state(false);
	let biometric = $state(false);
	const FIRST_TIME_HINT =
		'Belum ada biometrik terdaftar di perangkat ini. Masuk dengan password dulu, lalu daftarkan di menu Keamanan.';

	onMount(() => {
		biometric = passkeySupported();
		const token = getAccessToken();
		if (!token) return;
		try {
			const payload = decodeJwt(token);
			if (payload?.role === 'ADMIN') goto('/dashboard');
			else if (payload?.role === 'CONTRIBUTOR') goto('/dashboard/contributor');
		} catch {
			/* abaikan */
		}
	});

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!validateEmail(email)) {
			error = 'Email tidak valid';
			return;
		}
		if (password.length < 6) {
			error = 'Password minimal 6 karakter';
			return;
		}
		submitting = true;
		try {
			const res = await apiFetch('/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? 'Login gagal');
			const accessToken = json.data?.accessToken;
			if (!accessToken) throw new Error('Token tidak ditemukan di respons');
			enter(accessToken, json.data?.refreshToken ?? null);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login gagal';
		} finally {
			submitting = false;
		}
	}

	/** Simpan sesi lalu buka area sesuai peran (password & biometrik). */
	function enter(accessToken: string, refreshToken: string | null) {
		setTokens(accessToken, refreshToken);
		const role = decodeJwt(accessToken)?.role;
		if (role === 'ADMIN') goto('/dashboard');
		else if (role === 'CONTRIBUTOR') goto('/dashboard/contributor');
		else error = 'Akun ini tidak punya akses CMS';
	}

	async function onBiometric() {
		if (biometricBusy) return;
		error = '';
		biometricBusy = true;
		try {
			const { accessToken, refreshToken } = await loginWithPasskey();
			enter(accessToken, refreshToken);
		} catch (err) {
			// Dialog ditutup tanpa passkey = paling sering karena perangkat ini belum didaftarkan (macOS hanya
			// menawarkan Touch ID bila passkey untuk situs ini sudah ada di perangkat).
			const cancelled = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError');
			error = cancelled ? FIRST_TIME_HINT : passkeyErrorMessage(err);
		} finally {
			biometricBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Masuk — Lakuna CMS</title>
</svelte:head>

<div class="min-h-screen bg-paper md:grid md:grid-cols-[1.05fr_1fr]">
	<!-- ── Pintu: panel kamar gelap ─────────────────────────── -->
	<section aria-hidden="true" class="darkroom relative overflow-hidden bg-ink text-paper">
		<!-- Lampu safelight: cahaya yang menandakan film sedang ditangani -->
		<div class="lamp" aria-hidden="true"></div>
		<div class="relative flex min-h-64 flex-col justify-between gap-10 p-8 sm:p-12 md:min-h-screen">
			<!-- Logo sama dengan navbar situs (static/logo1-sm.png), diputihkan di atas latar gelap. -->
			<div class="rise">
				<img src="/logo1-sm.png" alt="Lakuna" width="200" height="36" class="block h-7 w-auto [filter:brightness(0)_invert(1)]" />
				<p class="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper/60">
					<span class="text-safelight">▍</span> Studio / CMS
				</p>
			</div>
			<div>
				<h1 class="rise font-display text-[clamp(2.6rem,5.2vw,4.6rem)] font-normal leading-[1.02] tracking-[-0.015em]" style="animation-delay:80ms">
					CMS<br /><em class="text-safelight not-italic underline decoration-safelight/60 decoration-2 underline-offset-8">Admin</em>.
				</h1>
				<p class="rise mt-6 max-w-xs text-[0.95rem] leading-relaxed text-paper/60" style="animation-delay:160ms">
					Pintu staf Lakuna. Satu kunci untuk Admin &amp; Kontributor — peran dibaca dari akun.
				</p>
			</div>
			<p class="rise flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper/60" style="animation-delay:240ms">
				<span class="lamp-dot" aria-hidden="true"></span> Lampu aman menyala
			</p>
		</div>
	</section>

	<!-- ── Form: meja terang ────────────────────────────────── -->
	<main class="flex items-center justify-center px-5 py-14 sm:px-10">
		<form onsubmit={onSubmit} class="fade w-full max-w-sm" style="animation-delay:120ms">
			<p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ash">Kredensial staf</p>
			<h2 class="mt-3 font-display text-3xl tracking-[-0.01em] text-ink">Buka kunci</h2>

			{#if error}
				<p role="alert" class="mt-5 border border-safelight-dim/50 bg-safelight-soft px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-safelight-dim">
					{error}
				</p>
			{/if}

			<div class="mt-7 space-y-5">
				<div>
					<label for="cms-email" class={labelCls}>Email</label>
					<input id="cms-email" type="email" placeholder="nama@lakuna.foto" bind:value={email} class={inputCls} autocomplete="email" required />
				</div>
				<div>
					<label for="cms-password" class={labelCls}>Password</label>
					<input id="cms-password" type="password" placeholder="••••••••" bind:value={password} class={inputCls} autocomplete="current-password" required />
				</div>
			</div>

			<button
				disabled={submitting}
				class="mt-7 w-full rounded-[3px] bg-safelight py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-safelight-dim disabled:opacity-40"
			>
				{submitting ? 'Membuka…' : 'Masuk →'}
			</button>

			{#if biometric}
				<div class="mt-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-2" aria-hidden="true">
					<span class="h-px flex-1 bg-ink/10"></span>atau<span class="h-px flex-1 bg-ink/10"></span>
				</div>
				<button
					type="button"
					onclick={onBiometric}
					disabled={biometricBusy}
					class="mt-5 flex w-full items-center justify-center gap-2.5 rounded-[3px] border border-ink/15 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink transition-colors hover:border-safelight hover:text-safelight-dim disabled:opacity-40"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
					</svg>
					{biometricBusy ? 'Menunggu biometrik…' : 'Masuk dengan biometrik'}
				</button>
				<p class="mt-3 text-center text-[12px] leading-relaxed text-ash">
					Pertama kali? Masuk dengan password, lalu daftarkan sidik jari / Face ID di menu Keamanan.
				</p>
			{/if}

			<p class="mt-6 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash-2">
				Admin · Kontributor
			</p>
		</form>
	</main>
</div>

<style>
	/* Cahaya lampu safelight di langit-langit kamar gelap. */
	.darkroom .lamp {
		position: absolute;
		inset: -20% -10% auto;
		height: 70%;
		background: radial-gradient(
			ellipse 65% 55% at 50% 0%,
			color-mix(in oklab, var(--color-safelight) 44%, transparent),
			transparent 70%
		);
		pointer-events: none;
	}
	/* Bohlam kecil + denyut pelan; diam bila reduced-motion. */
	.lamp-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--color-safelight);
		box-shadow: 0 0 12px 2px color-mix(in oklab, var(--color-safelight) 70%, transparent);
		animation: lampBreathe 3.2s ease-in-out infinite;
	}
	@keyframes lampBreathe {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
	}
	@media (prefers-reduced-motion: reduce) {
		.lamp-dot { animation: none; }
	}
</style>
