import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
	WebAuthnError,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
import { api, apiFetch } from './api';

/**
 * Login biometrik CMS (passkey / WebAuthn): sidik jari, Face ID, Windows Hello. Sisi server:
 * api/src/modules/webauthn. Hanya berfungsi di konteks aman (https atau localhost) dan di domain tempat passkey
 * didaftarkan.
 */

export const passkeySupported = (): boolean => typeof window !== 'undefined' && browserSupportsWebAuthn();

export type PasskeyDevice = { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null };

/** Pesan yang dimengerti pengguna untuk galat dari browser / server. */
export function passkeyErrorMessage(err: unknown): string {
	if (err instanceof WebAuthnError) {
		if (err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'Perangkat ini sudah terdaftar.';
		if (err.code === 'ERROR_INVALID_DOMAIN') return 'Biometrik tidak tersedia di alamat ini.';
		if (err.code === 'ERROR_CEREMONY_ABORTED') return 'Dibatalkan.';
	}
	if (err instanceof Error && err.name === 'NotAllowedError') return 'Dibatalkan atau waktu habis.';
	if (err instanceof Error && err.message) return err.message;
	return 'Biometrik gagal, coba lagi.';
}

/** Masuk dengan passkey. Mengembalikan token sesi (bentuk sama dengan /auth/login). */
export async function loginWithPasskey(): Promise<{ accessToken: string; refreshToken: string | null }> {
	const res = await apiFetch('/auth/webauthn/login/options', { method: 'POST' });
	const json = await res.json();
	if (!res.ok) throw new Error(json?.error?.message ?? 'Biometrik tidak tersedia');
	const { challengeId, options } = json.data as {
		challengeId: string;
		options: PublicKeyCredentialRequestOptionsJSON;
	};

	const response = await startAuthentication({ optionsJSON: options });

	const verify = await apiFetch('/auth/webauthn/login/verify', {
		method: 'POST',
		body: JSON.stringify({ challengeId, response })
	});
	const out = await verify.json();
	if (!verify.ok) throw new Error(out?.error?.message ?? 'Login biometrik gagal');
	const accessToken = out.data?.accessToken as string | undefined;
	if (!accessToken) throw new Error('Token tidak ditemukan di respons');
	return { accessToken, refreshToken: out.data?.refreshToken ?? null };
}

/** Daftarkan perangkat ini sebagai passkey untuk akun yang sedang login. Password wajib dikonfirmasi ulang
 *  (API menolak tanpanya): token curian tak boleh menanam passkey penyerang. */
export async function registerPasskey(deviceName: string, password: string): Promise<PasskeyDevice> {
	const options = await api<PublicKeyCredentialCreationOptionsJSON>('/auth/webauthn/register/options', {
		method: 'POST',
		body: JSON.stringify({ password })
	});
	const response = await startRegistration({ optionsJSON: options });
	return api<PasskeyDevice>('/auth/webauthn/register/verify', {
		method: 'POST',
		body: JSON.stringify({ response, deviceName: deviceName.trim() || undefined })
	});
}

export const listPasskeys = () => api<PasskeyDevice[]>('/auth/webauthn/credentials');

export const deletePasskey = (id: string) =>
	api<{ deleted: boolean }>(`/auth/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
