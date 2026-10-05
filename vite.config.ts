import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 3001,
		// Izinkan host tunnel (cloudflared) untuk akses CMS publik.
		allowedHosts: true,
		hmr: {
			overlay: false,
			timeout: 60000
		}
	}
});
