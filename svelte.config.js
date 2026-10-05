import adapter from '@sveltejs/adapter-auto';
import { loadEnv } from 'vite';

// Ambil origin dari PUBLIC_API_URL / PUBLIC_MEDIA_URL (mis. http://localhost:3100/api -> http://localhost:3100)
// karena directive CSP hanya butuh origin. Fallback ke localhost bila env kosong.
// .env file dulu, lalu env proses (Vercel dashboard) menimpa — supaya build
// produksi membaca PUBLIC_* yang diset di dashboard, bukan fallback localhost.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'PUBLIC_');
const env = { ...fileEnv };
for (const [k, v] of Object.entries(process.env)) {
	if (k.startsWith('PUBLIC_') && v) env[k] = v;
}

function originOf(raw) {
	try {
		return new URL(raw).origin;
	} catch {
		return raw;
	}
}

const apiOrigin = originOf(env.PUBLIC_API_URL || 'http://localhost:3100');
// Origin storage (MinIO) tempat thumbnail/preview dilayani.
const mediaOrigin = originOf(env.PUBLIC_MEDIA_URL || 'http://localhost:9000');

// HANYA server dev lokal (`vite dev`, bukan build/Vercel): CSP dihitung sekali saat server menyala,
// sedangkan skrip tunnel menukar PUBLIC_API_URL / PUBLIC_MEDIA_URL di .env antara localhost dan
// *.trycloudflare.com. Bila API menandatangani URL dengan host yang berbeda dari yang tertulis di .env
// saat start, browser memblokir gambar/permintaan ("violates the following Content Security Policy").
// Produksi tetap hanya mengizinkan origin dari env.
const isDevServer = process.argv.includes('dev') && !process.env.VERCEL;
const devConnect = isDevServer ? ['http://localhost:3100', 'https://*.trycloudflare.com'] : [];
const devMedia = isDevServer ? ['http://localhost:9000', 'https://*.trycloudflare.com'] : [];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// CSP dikelola SvelteKit agar script inline (hydration) otomatis diberi nonce/hash.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:', mediaOrigin, ...devMedia],
				'media-src': ['self', 'blob:', mediaOrigin, ...devMedia],
				'font-src': ['self', 'data:'],
				'connect-src': ['self', apiOrigin, ...devConnect],
				// Preview PDF template lisensi = blob: di <iframe> (dashboard/license-template).
				// Tanpa ini frame-src jatuh ke default-src 'self' → "This content is blocked".
				'frame-src': ['self', 'blob:']
			}
		}
	}
};

export default config;
