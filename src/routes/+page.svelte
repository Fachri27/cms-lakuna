<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { restoreSession } from '$lib/api';
	import { decodeJwt } from '$lib/auth';

	onMount(async () => {
		// Token akses kedaluwarsa tapi sesi masih hidup → diperpanjang dulu, bukan dilempar ke /login.
		const token = await restoreSession();
		const role = token ? decodeJwt(token)?.role : null;
		if (role === 'ADMIN') goto('/dashboard');
		else if (role === 'CONTRIBUTOR') goto('/dashboard/contributor');
		else goto('/login');
	});
</script>

<div class="min-h-screen flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-ash-2">
	Memuat…
</div>
