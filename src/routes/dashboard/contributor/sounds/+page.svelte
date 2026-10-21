<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope } from '$lib/api';
	import { fetchMyQuota, type UploadQuota } from '$lib/upload-quota';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import UploadQuotaPanel from '$lib/components/UploadQuotaPanel.svelte';
	import SoundUploader from '$lib/components/SoundUploader.svelte';
	import SoundListRow, { type SoundRowData } from '$lib/components/SoundListRow.svelte';

	/**
	 * Kontributor › Sounds — unggah musik & efek suara (terpisah dari Upload foto/video) dan pantau statusnya.
	 * Audio baru berstatus "Menunggu kurasi" sampai disetujui admin.
	 */
	const LIMIT = 10;
	let quota = $state<UploadQuota | null>(null);
	let mine = $state<SoundRowData[]>([]);
	let meta = $state({ page: 1, totalPages: 1, total: 0 });
	let notice = $state('');

	let audio: HTMLAudioElement | undefined = $state();
	let current = $state<string | null>(null);
	let playing = $state(false);
	let progress = $state(0);

	function loadQuota() {
		fetchMyQuota()
			.then((q) => (quota = q))
			.catch(() => {});
	}
	async function loadMine(p = 1) {
		try {
			const res = await apiEnvelope<SoundRowData[]>(`/photos/my?type=AUDIO&page=${p}&limit=${LIMIT}`);
			mine = res.data ?? [];
			meta = { page: res.meta?.page ?? p, totalPages: res.meta?.totalPages ?? 1, total: res.meta?.total ?? mine.length };
		} catch {
			mine = [];
		}
	}

	onMount(() => {
		loadQuota();
		void loadMine();
		return () => audio?.pause();
	});

	function toggle(s: SoundRowData) {
		if (!audio || !s.watermarkUrl) return;
		if (current === s.id) {
			if (audio.paused) void audio.play();
			else audio.pause();
			return;
		}
		current = s.id;
		progress = 0;
		audio.src = s.watermarkUrl;
		void audio.play().catch(() => {});
	}
</script>

<audio
	bind:this={audio}
	preload="none"
	class="hidden"
	onplay={() => (playing = true)}
	onpause={() => (playing = false)}
	onended={() => ((playing = false), (progress = 0))}
	ontimeupdate={(e) => {
		const a = e.currentTarget;
		progress = a.duration > 0 ? a.currentTime / a.duration : 0;
	}}
></audio>

<div class="rise py-10">
	<SectionHeader index="01" kicker="Kontribusi" title="Upload Sounds" class="mb-3" />
	<p class="mb-8 max-w-2xl text-sm text-ash">
		Musik dan efek suara untuk halaman Sounds di situs. Pratinjau MP3 bertanda suara dibuat otomatis; berkas asli hanya
		bisa diunduh pembeli. Audio tampil setelah disetujui admin.
	</p>

	{#if quota && !quota.unlimited}
		<UploadQuotaPanel {quota} class="mb-5" />
	{/if}

	<Panel class="p-7">
		<SoundUploader
			artistMode="text"
			{quota}
			onFinished={(n) => {
				notice = `${n} audio terkirim dan menunggu persetujuan admin`;
				loadQuota();
				void loadMine(1);
			}}
		/>
		{#if notice}<p class="mt-4 font-mono text-xs text-ink">✓ {notice}</p>{/if}
	</Panel>

	<h2 class="mb-4 mt-12 font-display text-2xl tracking-[-0.01em]">Sounds saya <span class="font-mono text-xs text-ash tnum">({meta.total})</span></h2>
	{#if mine.length === 0}
		<Panel><EmptyState class="py-16">Belum ada audio yang kamu unggah</EmptyState></Panel>
	{:else}
		<div class="space-y-2">
			{#each mine as s (s.id)}
				<SoundListRow sound={s} showStatus playing={current === s.id && playing} progress={current === s.id ? progress : 0} onToggle={() => toggle(s)} />
			{/each}
		</div>
		<Pagination page={meta.page} totalPages={meta.totalPages} onchange={(p) => void loadMine(p)} />
	{/if}
</div>
