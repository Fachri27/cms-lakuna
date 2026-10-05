export interface KwStat {
	id: string;
	name: string;
	count: number;
	lastUsed: number;
}

const KEY = 'lakuna-cms-kw-stats-v1';
const MAX_ENTRIES = 100;

function readRaw(): Record<string, KwStat> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, KwStat>;
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed;
	} catch {
		return {};
	}
}

function persist(stats: Record<string, KwStat>): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(stats));
	} catch {
		/* abaikan: kuota penuh / mode privat */
	}
}

export function loadStats(): Record<string, KwStat> {
	try {
		return readRaw();
	} catch {
		return {};
	}
}

export function recordUsage(id: string, name: string): void {
	try {
		const stats = readRaw();
		const prev = stats[name];
		stats[name] = { id, name, count: (prev?.count ?? 0) + 1, lastUsed: Date.now() };
		const entries = Object.values(stats)
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, MAX_ENTRIES);
		const pruned: Record<string, KwStat> = {};
		for (const e of entries) pruned[e.name] = e;
		persist(pruned);
	} catch {
		/* abaikan */
	}
}

export function topFrequent(limit = 8): KwStat[] {
	try {
		return Object.values(readRaw())
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	} catch {
		return [];
	}
}

export function recentUsed(limit = 8): KwStat[] {
	try {
		return Object.values(readRaw())
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, limit);
	} catch {
		return [];
	}
}

/** Samakan id stats dengan id server berdasarkan nama (cocok case-insensitive). */
export function syncStatIds(idByName: Record<string, string>): void {
	try {
		const stats = readRaw();
		let changed = false;
		for (const key of Object.keys(stats)) {
			const hit = idByName[key] ?? idByName[key.toLowerCase()];
			if (hit && stats[key].id !== hit) {
				stats[key] = { ...stats[key], id: hit };
				changed = true;
			}
		}
		if (changed) persist(stats);
	} catch {
		/* abaikan */
	}
}
