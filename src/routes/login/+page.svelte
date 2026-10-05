<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, setTokens } from '$lib/api';
	import { decodeJwt, getAccessToken, validateEmail } from '$lib/auth';
	import { inputCls, labelCls } from '$lib/ui-classes';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	onMount(() => {
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
			const refreshToken = json.data?.refreshToken ?? null;
			if (!accessToken) throw new Error('Token tidak ditemukan di respons');
			setTokens(accessToken, refreshToken);
			const role = decodeJwt(accessToken)?.role;
			if (role === 'ADMIN') goto('/dashboard');
			else if (role === 'CONTRIBUTOR') goto('/dashboard/contributor');
			else error = 'Akun ini tidak punya akses CMS';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login gagal';
		} finally {
			submitting = false;
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
			<p class="rise font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper/60">
				<span class="text-safelight">▍</span> Lakuna Studio / CMS
			</p>
			<div>
				<h1 class="rise font-display text-[clamp(2.6rem,5.2vw,4.6rem)] font-normal leading-[1.02] tracking-[-0.015em]" style="animation-delay:80ms">
					Masuk<br />ruang <em class="text-safelight not-italic underline decoration-safelight/60 decoration-2 underline-offset-8">gelap</em>.
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
