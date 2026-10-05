export interface KwStat {
	id: string;
	name: string;
	count: number;
	lastUsed: number;
}

const KEY = 'lakuna-cms-kw-stats-v1';
export type KwLang = 'id' | 'en';
/** ID tetap memakai kunci lama (statistik yang sudah ada tidak hilang); EN punya sendiri. */
const keyFor = (lang: KwLang) => (lang === 'en' ? `${KEY}-en` : KEY);
const MAX_ENTRIES = 100;

function readRaw(lang: KwLang = 'id'): Record<string, KwStat> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(keyFor(lang));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, KwStat>;
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed;
	} catch {
		return {};
	}
}

function persist(stats: Record<string, KwStat>, lang: KwLang = 'id'): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(keyFor(lang), JSON.stringify(stats));
	} catch {
		/* abaikan: kuota penuh / mode privat */
	}
}

export function loadStats(lang: KwLang = 'id'): Record<string, KwStat> {
	try {
		return readRaw(lang);
	} catch {
		return {};
	}
}

export function recordUsage(id: string, name: string, lang: KwLang = 'id'): void {
	try {
		const stats = readRaw(lang);
		const prev = stats[name];
		stats[name] = { id, name, count: (prev?.count ?? 0) + 1, lastUsed: Date.now() };
		const entries = Object.values(stats)
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, MAX_ENTRIES);
		const pruned: Record<string, KwStat> = {};
		for (const e of entries) pruned[e.name] = e;
		persist(pruned, lang);
	} catch {
		/* abaikan */
	}
}

export function topFrequent(limit = 8, lang: KwLang = 'id'): KwStat[] {
	try {
		return Object.values(readRaw(lang))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	} catch {
		return [];
	}
}

export function recentUsed(limit = 8, lang: KwLang = 'id'): KwStat[] {
	try {
		return Object.values(readRaw(lang))
			.sort((a, b) => b.lastUsed - a.lastUsed)
			.slice(0, limit);
	} catch {
		return [];
	}
}

/** Samakan id stats dengan id server berdasarkan nama (cocok case-insensitive). */
export function syncStatIds(idByName: Record<string, string>, lang: KwLang = 'id'): void {
	try {
		const stats = readRaw(lang);
		let changed = false;
		for (const key of Object.keys(stats)) {
			const hit = idByName[key] ?? idByName[key.toLowerCase()];
			if (hit && stats[key].id !== hit) {
				stats[key] = { ...stats[key], id: hit };
				changed = true;
			}
		}
		if (changed) persist(stats, lang);
	} catch {
		/* abaikan */
	}
}
