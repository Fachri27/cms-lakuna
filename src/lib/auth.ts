export type Role = 'ADMIN' | 'CONTRIBUTOR' | 'USER';

export interface JwtPayload {
	role?: Role;
	exp?: number;
	[key: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
	try {
		const part = token.split('.')[1];
		if (!part) return null;
		return JSON.parse(atob(part)) as JwtPayload;
	} catch {
		return null;
	}
}

export function getAccessToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('accessToken');
}

export function getRole(): Role | null {
	const token = getAccessToken();
	if (!token) return null;
	return decodeJwt(token)?.role ?? null;
}

export function isExpired(token: string): boolean {
	const payload = decodeJwt(token);
	if (!payload?.exp) return false;
	return payload.exp * 1000 < Date.now();
}

export function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
