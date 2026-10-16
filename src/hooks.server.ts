import type { Handle } from '@sveltejs/kit';

// Content-Security-Policy diatur lewat kit.csp di svelte.config.js
// (SvelteKit otomatis menambahkan nonce/hash untuk script inline).
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	// URL dashboard tidak dikirim utuh ke origin lain.
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), payment=()');
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	}

	return response;
};
