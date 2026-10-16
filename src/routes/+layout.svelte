<script lang="ts">
	import '../app.css';
	import { installUnscramble } from '$lib/scramble';
	let { children }: { children: import('svelte').Snippet } = $props();
	// Foto dari API datang teracak (anti-DevTools di situs publik); di Studio disusun ulang otomatis.
	$effect(() => installUnscramble());
</script>

{@render children()}
