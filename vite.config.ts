import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 3001,
		// Hanya host tunnel (cloudflared) — bukan `true`: itu mematikan proteksi DNS-rebinding Vite.
		// localhost & IP selalu diizinkan.
		allowedHosts: ['.trycloudflare.com'],
		hmr: {
			overlay: false,
			timeout: 60000
		}
	}
});
