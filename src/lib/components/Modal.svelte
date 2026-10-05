<script lang="ts">
	import Kicker from './Kicker.svelte';
	import { cn } from '$lib/cn';
	let {
		kicker,
		title,
		class: cls = '',
		onclose,
		children
	}: {
		kicker?: string;
		title: string;
		class?: string;
		onclose: () => void;
		children: import('svelte').Snippet;
	} = $props();

	let card = $state<HTMLDivElement | null>(null);

	// Escape menutup + kunci scroll body + fokus ke field pertama.
	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onclose();
		}
		document.addEventListener('keydown', onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		try {
			card?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Tutup"])')?.focus({ preventScroll: true });
		} catch {
			/* abaikan */
		}
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prev;
		};
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop fade fixed inset-0 z-50 flex justify-center overflow-y-auto px-4 py-12" onclick={onclose}>
	<div
		bind:this={card}
		class={cn('modal-card relative my-auto w-full max-w-md rounded-[3px] border border-solid bg-paper p-7 hairline', cls)}
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
	>
		<button
			type="button"
			onclick={onclose}
			aria-label="Tutup"
			class="absolute top-3 right-3 flex size-8 items-center justify-center rounded-[3px] text-ash transition-colors hover:bg-ink/[0.05] hover:text-ink"
		>✕</button>
		{#if kicker}<Kicker class="mb-3">{kicker}</Kicker>{/if}
		<h2 class="font-display mb-4 pr-8 text-2xl tracking-[-0.01em]">{title}</h2>
		<div aria-hidden="true" class="mb-5 h-px bg-ink/10"></div>
		{@render children()}
	</div>
</div>

<style>
	/* Latar kamar gelap: tinta pekat + blur kuat + sisa cahaya safelight dari atas. */
	.modal-backdrop {
		background: color-mix(in oklab, var(--color-ink) 82%, transparent);
		backdrop-filter: blur(10px) saturate(0.85);
		-webkit-backdrop-filter: blur(10px) saturate(0.85);
	}
	.modal-backdrop::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			ellipse 60% 35% at 50% 0%,
			color-mix(in oklab, var(--color-safelight) 22%, transparent),
			transparent 70%
		);
	}
	/* Slip kerja di atas meja: bayangan dalam + offset safelight. */
	.modal-card {
		box-shadow:
			0 30px 80px -20px rgb(0 0 0 / 0.5),
			8px 8px 0 0 var(--color-safelight);
		animation: modalIn 0.38s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes modalIn {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.modal-card {
			animation: none;
		}
	}
</style>
