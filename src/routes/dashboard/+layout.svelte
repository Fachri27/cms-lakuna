<script lang="ts" module>
	import {
		LayoutDashboard,
		LayoutTemplate,
		Image,
		ClipboardCheck,
		Tag,
		Hash,
		User,
		ShoppingCart,
		CreditCard,
		Users,
		Wallet,
		Ticket,
		CalendarClock,
		Settings,
		FileText,
		MapPin,
		LogOut
	} from '@lucide/svelte';

	export const GROUPS = [
		{
			title: 'Studio',
			items: [
				{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
				{ label: 'Beranda', href: '/dashboard/homepage', icon: LayoutTemplate },
				{ label: 'Foto', href: '/dashboard/photos', icon: Image },
				{ label: 'Persetujuan', href: '/dashboard/approval', icon: ClipboardCheck }
			]
		},
		{
			title: 'Katalog',
			items: [
				{ label: 'Kategori', href: '/dashboard/categories', icon: Tag },
				{ label: 'Kata Kunci', href: '/dashboard/keywords', icon: Hash },
				{ label: 'Fotografer', href: '/dashboard/photographers', icon: User },
				{ label: 'Peta', href: '/dashboard/map', icon: MapPin }
			]
		},
		{
			title: 'Transaksi',
			items: [
				{ label: 'Pesanan', href: '/dashboard/orders', icon: ShoppingCart },
				{ label: 'Paket Langganan', href: '/dashboard/subscriptions', icon: CreditCard },
				{ label: 'Pelanggan Aktif', href: '/dashboard/subscriptions/manage', icon: Users },
				{ label: 'Pencairan', href: '/dashboard/payouts', icon: Wallet }
			]
		},
		{
			title: 'Diskon',
			items: [
				{ label: 'Voucher', href: '/dashboard/vouchers', icon: Ticket },
				{ label: 'Event Diskon', href: '/dashboard/events', icon: CalendarClock }
			]
		},
		{
			title: 'Sistem',
			items: [
				{ label: 'Pengguna', href: '/dashboard/users', icon: Users },
				{ label: 'Pengaturan', href: '/dashboard/settings', icon: Settings },
				{ label: 'Template Lisensi', href: '/dashboard/license-template', icon: FileText }
			]
		}
	];

	export const CONTRIBUTOR_NAV = [
		{ label: 'Dashboard', href: '/dashboard/contributor', icon: LayoutDashboard },
		{ label: 'Upload', href: '/dashboard/contributor/upload', icon: Image },
		{ label: 'Penghasilan', href: '/dashboard/contributor/earnings', icon: Wallet }
	];
</script>

<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { clearTokens, ensureSession } from '$lib/api';
	import { decodeJwt, getAccessToken, isExpired } from '$lib/auth';
	import { cn } from '$lib/cn';

	let { children }: { children: import('svelte').Snippet } = $props();
	let ready = $state(false);
	let role = $state<string | null>(null);

	const pathname = $derived($page.url.pathname);
	const isContributorRoute = $derived(pathname.startsWith('/dashboard/contributor'));

	onMount(() => {
		const token = getAccessToken();
		if (!token || isExpired(token)) {
			clearTokens();
			goto('/login');
			return;
		}
		const payload = decodeJwt(token);
		role = (payload?.role as string) ?? null;
		ensureSession(); // refresh proaktif sebelum akses kedaluwarsa
		if (isContributorRoute) {
			if (role !== 'CONTRIBUTOR' && role !== 'ADMIN') goto('/login');
			else ready = true;
			return;
		}
		if (role !== 'ADMIN') {
			if (role === 'CONTRIBUTOR') goto('/dashboard/contributor');
			else goto('/login');
			return;
		}
		ready = true;
	});

	function logout() {
		clearTokens();
		goto('/login');
	}
</script>

{#if !ready}
	<div class="min-h-screen flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-ash-2">
		Memuat…
	</div>
{:else if isContributorRoute}
	{@render children()}
{:else}
	<div class="flex min-h-screen">
		<aside class="w-64 shrink-0 h-screen sticky top-0 bg-ink text-paper flex flex-col border-r border-ink-3">
			<div class="px-6 pt-7 pb-6">
				<div class="flex items-center gap-2.5">
					<span aria-hidden class="text-safelight text-lg leading-none">▣</span>
					<span class="font-display text-[1.55rem] leading-none tracking-[-0.01em]">Lakuna</span>
				</div>
				<p class="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40 pl-7">Studio / CMS</p>
			</div>
			<div class="mx-6 h-px bg-paper/10"></div>
			<nav class="flex-1 overflow-y-auto px-3 py-5">
				{#each GROUPS as group}
					<div class="mb-5">
						<p class="px-3 mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/30">{group.title}</p>
						<ul class="space-y-px">
							{#each group.items as item}
								{@const Icon = item.icon}
								{@const active = pathname === item.href}
								<li>
									<a
										href={item.href}
										class={cn(
											'group relative flex items-center gap-3 px-3 py-2.5 rounded-[3px] transition-colors',
											active ? 'bg-paper/[0.06] text-paper' : 'text-paper/55 hover:text-paper/90 hover:bg-paper/[0.03]'
										)}
									>
										{#if active}<span aria-hidden class="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-safelight"></span>{/if}
										<Icon size={15} class={cn('shrink-0', active ? 'text-safelight' : 'text-paper/45')} />
										<span class="text-[13px] tracking-tight">{item.label}</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
			<div class="px-3 pb-5">
				<div class="mx-3 mb-3 h-px bg-paper/10"></div>
				<button
					onclick={logout}
					class="w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-paper/55 hover:text-safelight hover:bg-paper/[0.03] transition-colors"
				>
					<LogOut size={15} class="shrink-0" />
					<span class="text-[13px] tracking-tight">Keluar</span>
				</button>
			</div>
		</aside>
		<main class="flex-1 min-w-0">
			<div class="px-8 py-10 lg:px-12 max-w-[1440px]">{@render children()}</div>
		</main>
	</div>
{/if}
