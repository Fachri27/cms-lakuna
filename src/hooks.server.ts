import type { Handle } from '@sveltejs/kit';

// Content-Security-Policy diatur lewat kit.csp di svelte.config.js
// (SvelteKit otomatis menambahkan nonce/hash untuk script inline).
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
	response.headers.set('X-Content-Type-Options', 'nosniff');

	return response;
};
