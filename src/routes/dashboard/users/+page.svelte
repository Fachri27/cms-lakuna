<script lang="ts">
	import { onMount } from 'svelte';
	import { apiEnvelope, apiFetch } from '$lib/api';
	import { inputCls, cn } from '$lib/ui-classes';
	import Panel from '$lib/components/Panel.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface User {
		id: string;
		username: string;
		email: string;
		realName?: string;
		newsletter: boolean;
		role: string;
		createdAt: string;
	}

	const TH = 'px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal';
	const ROLES = ['USER', 'ADMIN', 'CONTRIBUTOR'];

	let users = $state<User[]>([]);
	let page = $state(1);
	let totalPages = $state(0);
	let fetching = $state(true);
	let editingRole = $state<string | null>(null);
	let roleSavingId = $state<string | null>(null);

	async function fetchUsers() {
		fetching = true;
		try {
			const res = await apiEnvelope<User[]>(`/users/admin?page=${page}&limit=20`);
			users = res.data ?? [];
			totalPages = res.meta?.totalPages ?? 0;
		} catch (err) {
			console.error(err);
		} finally {
			fetching = false;
		}
	}

	onMount(() => {
		void fetchUsers();
	});

	async function updateRole(user: User, newRole: string, el: HTMLSelectElement) {
		const oldRole = user.role;
		if (newRole === oldRole) {
			editingRole = null;
			return;
		}
		if (
			!confirm(`Ubah role ${user.username} (${user.email}) dari ${oldRole} ke ${newRole}?`)
		) {
			el.value = oldRole;
			return;
		}
		roleSavingId = user.id;
		try {
			const res = await apiFetch(`/users/${user.id}/role`, {
				method: 'PATCH',
				body: JSON.stringify({ role: newRole })
			});
			if (!res.ok) {
				el.value = oldRole;
				alert('Gagal mengubah role');
				return;
			}
			users = users.map((u) => (u.id === user.id ? { ...u, role: newRole } : u));
			editingRole = null;
		} catch (err) {
			el.value = oldRole;
			console.error(err);
			alert('Gagal mengubah role');
		} finally {
			roleSavingId = null;
		}
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function dotCls(role: string) {
		return cn(
			'inline-block w-1.5 h-1.5 rounded-full',
			role === 'ADMIN' ? 'bg-safelight' : role === 'CONTRIBUTOR' ? 'bg-ink' : 'bg-ash-2'
		);
	}
</script>

<div class="rise">
	<SectionHeader index="04" kicker="Sistem" title="Pengguna" class="mb-8" />

	{#if fetching}
		<Panel class="p-7 space-y-4">
			<Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton class="h-12" /><Skeleton
				class="h-12"
			/><Skeleton class="h-12" /><Skeleton class="h-12" />
		</Panel>
	{:else if users.length === 0}
		<Panel>
			<EmptyState>Belum ada pengguna</EmptyState>
		</Panel>
	{:else}
		<Panel>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left border-b hairline border-solid">
							<th class={TH}>Username</th>
							<th class={TH}>Email</th>
							<th class={TH}>Role</th>
							<th class={TH}>Newsletter</th>
							<th class={TH}>Bergabung</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user (user.id)}
							<tr
								class="border-b hairline border-solid last:border-b-0 hover:bg-ink/[0.02] transition-colors"
							>
								<td class="px-7 py-4">
									<div class="text-ink">{user.username}</div>
									{#if user.realName}
										<div class="font-mono text-[11px] text-ash-2">{user.realName}</div>
									{/if}
								</td>
								<td class="px-7 py-4 font-mono text-[11px] text-ash">{user.email}</td>
								<td class="px-7 py-4">
									{#if editingRole === user.id}
									<select
										value={user.role}
										onchange={(e) => void updateRole(user, e.currentTarget.value, e.currentTarget)}
										onblur={() => (editingRole = null)}
										disabled={roleSavingId === user.id}
											class={cn(inputCls, 'w-auto py-1.5')}
											autofocus
										>
											{#each ROLES as r}
												<option value={r}>{r}</option>
											{/each}
										</select>
									{:else}
										<button
											onclick={() => (editingRole = user.id)}
											title="Klik untuk ubah"
											class="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70 hover:text-safelight cursor-pointer"
										>
											<span class={dotCls(user.role)}></span>
											{user.role}
										</button>
									{/if}
								</td>
								<td class="px-7 py-4 font-mono text-[11px] text-ash">
									{user.newsletter ? 'Ya' : 'Tidak'}
								</td>
								<td class="px-7 py-4 font-mono text-[11px] text-ash">{fmtDate(user.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>
		<Pagination
			page={page}
			{totalPages}
			onchange={(p) => {
				page = p;
				void fetchUsers();
			}}
		/>
	{/if}
</div>
