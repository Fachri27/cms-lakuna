import { env } from '$env/dynamic/public';

/**
 * Destinasi ekowisata (Studio › Ekowisata) — pasangan API /ecotourism dan halaman situs /ecotourism/<slug>.
 * Zona = lima pita halaman Ekowisata di situs, urut dari puncak ke karang.
 */
export type EcoZone = 'MOUNTAIN' | 'FOREST' | 'WATER' | 'COAST' | 'REEF';

export const ECO_ZONES: { value: EcoZone; label: string; hint: string }[] = [
	{ value: 'MOUNTAIN', label: 'Pegunungan', hint: 'Kawah, savana tinggi, jalur pendakian (± 1.500–3.200 m dpl)' },
	{ value: 'FOREST', label: 'Hutan hujan', hint: 'Hutan tropis, satwa liar, jalur setapak (± 200–1.500 m dpl)' },
	{ value: 'WATER', label: 'Danau dan sungai', hint: 'Danau, sungai, kampung di atas air (± 0–200 m dpl)' },
	{ value: 'COAST', label: 'Pantai dan mangrove', hint: 'Pantai, bakau, kampung nelayan (± 0 m)' },
	{ value: 'REEF', label: 'Terumbu karang', hint: 'Penyelaman & snorkeling di zona lindung (di bawah laut)' }
];
export const zoneLabel = (z: string) => ECO_ZONES.find((x) => x.value === z)?.label ?? z;

export interface EcoPhoto {
	id: string;
	title: string;
	titleEn?: string | null;
	thumbUrl?: string | null;
	type?: string;
	location?: string | null;
	photographer?: string | null;
}

export interface EcoDestination {
	id: string;
	slug: string;
	name: string;
	nameEn: string | null;
	zone: EcoZone;
	region: string;
	area: string | null;
	elevation: number | null;
	latitude: number | null;
	longitude: number | null;
	summary: string;
	summaryEn: string | null;
	story: string;
	storyEn: string | null;
	bestTime: string | null;
	bestTimeEn: string | null;
	access: string | null;
	accessEn: string | null;
	activities: string[];
	activitiesEn: string[];
	rules: string[];
	rulesEn: string[];
	manager: string | null;
	website: string | null;
	coverPhotoId: string | null;
	photoIds: string[];
	photos: EcoPhoto[];
	cover: EcoPhoto | null;
	published: boolean;
	sortOrder: number;
	updatedAt: string;
}

/** Baris daftar admin. */
export interface EcoRow {
	id: string;
	slug: string;
	name: string;
	zone: EcoZone;
	region: string;
	area: string | null;
	cover: EcoPhoto | null;
	photoCount: number;
	published: boolean;
	sortOrder: number;
	updatedAt: string;
}

/** Isian form (semua teks; daftar = satu butir per baris). */
export interface EcoForm {
	name: string;
	nameEn: string;
	slug: string;
	zone: EcoZone;
	region: string;
	area: string;
	elevation: string;
	latitude: string;
	longitude: string;
	summary: string;
	summaryEn: string;
	story: string;
	storyEn: string;
	bestTime: string;
	bestTimeEn: string;
	access: string;
	accessEn: string;
	activities: string;
	activitiesEn: string;
	rules: string;
	rulesEn: string;
	manager: string;
	website: string;
	published: boolean;
	sortOrder: string;
}

export const emptyEcoForm = (): EcoForm => ({
	name: '',
	nameEn: '',
	slug: '',
	zone: 'MOUNTAIN',
	region: '',
	area: '',
	elevation: '',
	latitude: '',
	longitude: '',
	summary: '',
	summaryEn: '',
	story: '',
	storyEn: '',
	bestTime: '',
	bestTimeEn: '',
	access: '',
	accessEn: '',
	activities: '',
	activitiesEn: '',
	rules: '',
	rulesEn: '',
	manager: '',
	website: '',
	published: false,
	sortOrder: '0'
});

const s = (v: string | null | undefined) => v ?? '';
const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
export const linesOf = (v: string) =>
	v
		.split('\n')
		.map((x) => x.trim())
		.filter(Boolean);

export function formFrom(d: EcoDestination): EcoForm {
	return {
		name: d.name,
		nameEn: s(d.nameEn),
		slug: d.slug,
		zone: d.zone,
		region: d.region,
		area: s(d.area),
		elevation: n(d.elevation),
		latitude: n(d.latitude),
		longitude: n(d.longitude),
		summary: d.summary,
		summaryEn: s(d.summaryEn),
		story: d.story,
		storyEn: s(d.storyEn),
		bestTime: s(d.bestTime),
		bestTimeEn: s(d.bestTimeEn),
		access: s(d.access),
		accessEn: s(d.accessEn),
		activities: (d.activities ?? []).join('\n'),
		activitiesEn: (d.activitiesEn ?? []).join('\n'),
		rules: (d.rules ?? []).join('\n'),
		rulesEn: (d.rulesEn ?? []).join('\n'),
		manager: s(d.manager),
		website: s(d.website),
		published: d.published,
		sortOrder: String(d.sortOrder ?? 0)
	};
}

/** Isian → body API (kosong = null; daftar = larik per baris; angka "" = null). */
export function payloadOf(f: EcoForm, photoIds: string[], coverPhotoId: string | null) {
	const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
	return {
		name: f.name.trim(),
		nameEn: f.nameEn.trim() || null,
		slug: f.slug.trim() || null,
		zone: f.zone,
		region: f.region.trim(),
		area: f.area.trim() || null,
		elevation: num(f.elevation),
		latitude: num(f.latitude),
		longitude: num(f.longitude),
		summary: f.summary.trim(),
		summaryEn: f.summaryEn.trim() || null,
		story: f.story.trim(),
		storyEn: f.storyEn.trim() || null,
		bestTime: f.bestTime.trim() || null,
		bestTimeEn: f.bestTimeEn.trim() || null,
		access: f.access.trim() || null,
		accessEn: f.accessEn.trim() || null,
		activities: linesOf(f.activities),
		activitiesEn: linesOf(f.activitiesEn),
		rules: linesOf(f.rules),
		rulesEn: linesOf(f.rulesEn),
		manager: f.manager.trim() || null,
		website: f.website.trim() || null,
		published: f.published,
		sortOrder: Number(f.sortOrder) || 0,
		photoIds,
		coverPhotoId
	};
}

/** Alamat situs publik untuk tautan "Lihat di situs". Kosong = tautan tak ditampilkan. */
export function siteUrl(): string {
	const fromEnv = (env.PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
	if (fromEnv) return fromEnv;
	if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
		return 'http://localhost:3002';
	}
	return '';
}
