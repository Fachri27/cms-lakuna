<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { logoutSession } from '$lib/api';
	import { cn } from '$lib/cn';

	let { children }: { children: import('svelte').Snippet } = $props();

	// Kepala + navigasi area kontributor — dulu disalin utuh di tiap halaman (Dashboard, Upload, Penghasilan).
	const NAV = [
		{ label: 'Dashboard', href: '/dashboard/contributor' },
		{ label: 'Upload', href: '/dashboard/contributor/upload' },
		{ label: 'Penghasilan', href: '/dashboard/contributor/earnings' },
		{ label: 'Keamanan', href: '/dashboard/contributor/security' }
	];

	const pathname = $derived($page.url.pathname);

	async function logout() {
		await logoutSession();
		goto('/login');
	}
</script>

<div class="min-h-screen">
	<header class="bg-ink text-paper rounded-[3px]">
		<div class="px-6 pt-6 pb-4 flex items-center justify-between gap-4">
			<div>
				<!-- Logo sama dengan navbar situs (static/logo1-sm.png), diputihkan di atas latar gelap. -->
				<img src="/logo1-sm.png" alt="Lakuna" width="200" height="36" class="block h-7 w-auto [filter:brightness(0)_invert(1)]" />
				<p class="mt-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40">
					Kontributor
				</p>
			</div>
			<button
				onclick={logout}
				class="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/55 hover:text-safelight transition-colors"
			>
				Keluar
			</button>
		</div>
		<nav class="px-6 pb-5 flex gap-2">
			{#each NAV as item}
				{@const active = pathname === item.href}
				<a
					href={item.href}
					class={cn(
						'px-3.5 py-2 rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors',
						active ? 'bg-paper/[0.08] text-paper' : 'text-paper/55 hover:text-paper/90 hover:bg-paper/[0.04]'
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	{@render children()}
</div>
