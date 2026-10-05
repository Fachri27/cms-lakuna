import { PUBLIC_API_URL } from '$env/static/public';

export const API_BASE = PUBLIC_API_URL || 'http://localhost:3000/api';

function getTokens() {
	if (typeof localStorage === 'undefined') return { access: null, refresh: null };
	return {
		access: localStorage.getItem('accessToken'),
		refresh: localStorage.getItem('refreshToken')
	};
}

export function setTokens(access: string | null, refresh?: string | null) {
	if (typeof localStorage === 'undefined') return;
	if (access) {
		localStorage.setItem('accessToken', access);
		document.cookie = `accessToken=${access}; path=/; max-age=900`;
	} else {
		localStorage.removeItem('accessToken');
		document.cookie = 'accessToken=; path=/; max-age=0';
	}
	if (refresh !== undefined) {
		if (refresh) {
			localStorage.setItem('refreshToken', refresh);
			document.cookie = `refreshToken=${refresh}; path=/; max-age=${60 * 60 * 24 * 7}`;
		} else {
			localStorage.removeItem('refreshToken');
			document.cookie = 'refreshToken=; path=/; max-age=0';
		}
	}
	// Jaga sesi: refresh proaktif sebelum akses kedaluwarsa.
	if (access) scheduleProactive();
	else if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

export function clearTokens() {
	setTokens(null, null);
}

const REFRESH_SKEW_MS = 60 * 1000; // refresh 1 menit sebelum akses kedaluwarsa
const RETRY_MS = 30 * 1000; // jeda coba lagi bila refresh gagal karena jaringan

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<string | null> | null = null;

function accessExpMs(token: string | null): number | null {
	try {
		if (!token) return null;
		const part = token.split('.')[1];
		if (!part) return null;
		const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
		return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
	} catch {
		return null;
	}
}

function handleLogout() {
	clearTokens();
	if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
		window.location.href = '/login';
	}
}

function scheduleProactive(delay?: number) {
	if (typeof window === 'undefined') return;
	if (refreshTimer) clearTimeout(refreshTimer);
	refreshTimer = null;
	let wait = delay;
	if (wait === undefined) {
		const exp = accessExpMs(getTokens().access);
		if (!exp) return;
		wait = exp - Date.now() - REFRESH_SKEW_MS;
	}
	if (wait <= 0) {
		void refreshSingleflight();
		return;
	}
	refreshTimer = setTimeout(() => void refreshSingleflight(), wait);
}

/** Refresh dengan single-flight: 401 paralel berbagi satu request. */
async function doRefresh(): Promise<string> {
	const { refresh } = getTokens();
	if (!refresh) {
		const err = new Error('no-refresh-token') as Error & { fatal?: boolean };
		err.fatal = true;
		throw err;
	}
	let res: Response;
	try {
		res = await fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken: refresh })
		});
	} catch (err) {
		// Jaringan gagal: JANGAN logout, jadwalkan coba lagi.
		throw err;
	}
	if (!res.ok) {
		// Server menolak refresh (kedaluwarsa/di-revoke): sesi benar-benar mati.
		const err = new Error('refresh-rejected') as Error & { fatal?: boolean };
		err.fatal = true;
		throw err;
	}
	const data = await res.json().catch(() => null);
	const token = data?.data?.newToken ?? data?.data?.accessToken ?? null;
	if (!token) {
		const err = new Error('refresh-bad-response') as Error & { fatal?: boolean };
		err.fatal = true;
		throw err;
	}
	return token as string;
}

function refreshSingleflight(): Promise<string | null> {
	if (!inflight) {
		inflight = doRefresh().then(
			(token) => {
				inflight = null;
				setTokens(token);
				return token;
			},
			(err) => {
				inflight = null;
				if ((err as { fatal?: boolean })?.fatal) handleLogout();
				else scheduleProactive(RETRY_MS);
				return null;
			}
		);
	}
	return inflight;
}

/** Dipanggil setelah setTokens & saat dashboard mount: jaga sesi tetap hidup. */
export function ensureSession() {
	scheduleProactive();
}

async function tryRefresh(): Promise<string | null> {
	return refreshSingleflight();
}

export class ApiError extends Error {
	status: number;
	payload: unknown;
	constructor(status: number, message: string, payload?: unknown) {
		super(message);
		this.status = status;
		this.payload = payload;
	}
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
	const { access } = getTokens();
	const headers = new Headers(options.headers);
	const isForm = options.body instanceof FormData;
	if (!headers.has('Content-Type') && !isForm) headers.set('Content-Type', 'application/json');
	if (access) headers.set('Authorization', `Bearer ${access}`);

	let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

	if (res.status === 401) {
		const token = await tryRefresh();
		if (token) {
			const retry = new Headers(options.headers);
			if (!retry.has('Content-Type') && !isForm) retry.set('Content-Type', 'application/json');
			retry.set('Authorization', `Bearer ${token}`);
			res = await fetch(`${API_BASE}${path}`, { ...options, headers: retry });
		}
		// Bila refresh gagal fatal, handleLogout di dalam sudah mengarahkan ke /login.
		// Bila gagal jaringan, sesi dipertahankan — kembalikan respons 401 apa adanya.
	}
	return res;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await apiFetch(path, options);
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const msg =
			(data as { error?: { message?: string }; message?: string } | null)?.error?.message ??
			(data as { message?: string } | null)?.message ??
			`Request gagal (${res.status})`;
		throw new ApiError(res.status, msg, data);
	}
	return (data as { data?: T })?.data !== undefined ? (data as { data: T }).data : (data as T);
}

export async function apiEnvelope<T = unknown>(
	path: string,
	options: RequestInit = {}
): Promise<{ data: T; meta?: { page?: number; totalPages?: number; total?: number } }> {
	const res = await apiFetch(path, options);
	const json = await res.json().catch(() => null);
	if (!res.ok) {
		const msg =
			(json as { error?: { message?: string }; message?: string } | null)?.error?.message ??
			(json as { message?: string } | null)?.message ??
			`Request gagal (${res.status})`;
		throw new ApiError(res.status, msg, json);
	}
	return { data: (json?.data ?? json) as T, meta: json?.meta };
}
