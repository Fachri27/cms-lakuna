<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import EcoDestinationForm from '$lib/components/EcoDestinationForm.svelte';
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio · Ekowisata" title="Tambah destinasi" class="mb-8">
		<a href="/dashboard/ecotourism"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>
	<!-- Sesudah tersimpan pertama kali → halaman ubah (foto, terbit, dst. bisa dilanjutkan di sana). -->
	<EcoDestinationForm onsaved={(d) => void goto(`/dashboard/ecotourism/${d.id}/edit`, { replaceState: true })} />
</div>
