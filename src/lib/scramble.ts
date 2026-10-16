/**
 * Penyusun gambar TERACAK untuk Studio — pasangan apps/api/src/utils/scrambledImage.ts.
 *
 * API mengirim semua foto tampilan sebagai mozaik ubin teracak (kunci di fragment URL `#lk=…`), supaya
 * di situs publik foto tak bisa diambil dari DevTools. Studio dipakai admin/kontributor yang memang berhak
 * melihat fotonya, jadi di sini cukup satu penyusun global: tiap <img> ber-`#lk=` disusun ulang lalu
 * diganti blob URL hasilnya — markup halaman tak perlu diubah. PRNG & permutasi HARUS identik dengan API.
 */

const VERSION = 1;
const MASK = [0x5a, 0xc3, 0x17, 0x8e, 0x29, 0xf4, 0x63, 0xb1, 0x0d, 0x9e];
const FRAG = /[#&]lk=([A-Za-z0-9_-]{14})(?:&|$)/;
const CREDITED = /\/(?:thumb|watermark)\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#]|$)/i;

type Key = { w: number; h: number; b: number; seed: number };

function scrambleKey(url: string): Key | null {
	const m = FRAG.exec(url);
	if (!m) return null;
	let bin: string;
	try {
		bin = atob(m[1]!.replace(/-/g, '+').replace(/_/g, '/'));
	} catch {
		return null;
	}
	if (bin.length !== 10) return null;
	const b = new Uint8Array(10);
	for (let i = 0; i < 10; i++) b[i] = bin.charCodeAt(i) ^ MASK[i]!;
	if (b[0] !== VERSION) return null;
	const dv = new DataView(b.buffer);
	const key = { b: b[1]! * 16, w: dv.getUint16(2, true), h: dv.getUint16(4, true), seed: dv.getUint32(6, true) };
	return key.b > 0 && key.w > 0 && key.h > 0 ? key : null;
}

function permutation(n: number, seed: number): Uint32Array {
	const p = new Uint32Array(n);
	for (let i = 0; i < n; i++) p[i] = i;
	let a = seed;
	const rnd = () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		const t = p[i]!;
		p[i] = p[j]!;
		p[j] = t;
	}
	return p;
}

/** Pita kredit "lakunastock · ID" di dasar thumbnail/pratinjau (rumus sama dengan API) — dibuang dari tampilan. */
function creditHidden(url: string, w: number, h: number): number {
	if (!CREDITED.test(url)) return 0;
	const bar = Math.max(18, Math.round(w * 0.05));
	if (bar >= h * 0.5) return 0;
	return bar + Math.max(2, Math.ceil((h - bar) * 0.004));
}

const done = new Map<string, Promise<string>>();

/** Berkas teracak → blob URL foto utuh (cache per berkas; tanda tangan presigned boleh berganti). */
function unscramble(url: string, key: Key): Promise<string> {
	const id = url.split(/[?#]/)[0]!;
	let p = done.get(id);
	if (!p) {
		p = (async () => {
			// <img crossOrigin> (bukan fetch): cukup img-src di CSP, dan kanvasnya tak "tainted" sehingga bisa toBlob.
			const bmp = await new Promise<HTMLImageElement>((resolve, reject) => {
				const im = new Image();
				im.crossOrigin = 'anonymous';
				im.onload = () => resolve(im);
				im.onerror = () => reject(new Error('gagal memuat'));
				im.src = url;
			});
			const h = key.h - creditHidden(url, key.w, key.h);
			const c = document.createElement('canvas');
			c.width = key.w;
			c.height = h;
			const ctx = c.getContext('2d')!;
			ctx.imageSmoothingEnabled = false;
			const cols = Math.ceil(key.w / key.b);
			const rows = Math.ceil(key.h / key.b);
			const perm = permutation(cols * rows, key.seed);
			for (let i = 0; i < perm.length; i++) {
				const j = perm[i]!;
				ctx.drawImage(bmp, (j % cols) * key.b, Math.floor(j / cols) * key.b, key.b, key.b, (i % cols) * key.b, Math.floor(i / cols) * key.b, key.b, key.b);
			}
			const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
			if (!blob) throw new Error('toBlob gagal');
			return URL.createObjectURL(blob);
		})();
		p.catch(() => done.delete(id));
		done.set(id, p);
	}
	return p;
}

function fix(img: HTMLImageElement) {
	const src = img.getAttribute('src') ?? '';
	const key = scrambleKey(src);
	if (!key) return;
	// Sembunyikan mozaiknya selama disusun.
	img.style.visibility = 'hidden';
	unscramble(src, key).then(
		(blobUrl) => {
			if (img.getAttribute('src') !== src) return; // src sudah diganti komponennya
			img.src = blobUrl;
			img.style.visibility = '';
		},
		() => {
			img.style.visibility = '';
		},
	);
}

/** Pasang sekali di layout root. */
export function installUnscramble(root: Document = document): () => void {
	root.querySelectorAll('img').forEach(fix);
	const mo = new MutationObserver((records) => {
		for (const r of records) {
			if (r.type === 'attributes' && r.target instanceof HTMLImageElement) {
				fix(r.target);
				continue;
			}
			r.addedNodes.forEach((n) => {
				if (n instanceof HTMLImageElement) fix(n);
				else if (n instanceof Element) n.querySelectorAll('img').forEach(fix);
			});
		}
	});
	mo.observe(root.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
	return () => mo.disconnect();
}
