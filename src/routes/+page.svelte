<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getAccessToken, getRole, isExpired } from '$lib/auth';

	onMount(() => {
		const token = getAccessToken();
		if (!token || isExpired(token)) {
			goto('/login');
			return;
		}
		if (getRole() === 'ADMIN') goto('/dashboard');
		else if (getRole() === 'CONTRIBUTOR') goto('/dashboard/contributor');
		else goto('/login');
	});
</script>

<div class="min-h-screen flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-ash-2">
	Memuat…
</div>
