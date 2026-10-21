<script lang="ts">
	import { goto } from '$app/navigation';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Btn from '$lib/components/Btn.svelte';
	import SoundUploader from '$lib/components/SoundUploader.svelte';
</script>

<div class="rise">
	<SectionHeader index="01" kicker="Studio · Sounds" title="Upload Audio" class="mb-8">
		<a href="/dashboard/sounds"><Btn variant="ghost">← Kembali</Btn></a>
	</SectionHeader>

	<Panel class="p-7">
		<SoundUploader artistMode="select" onFinished={() => void goto('/dashboard/sounds')} />
	</Panel>
</div>
