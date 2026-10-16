import { api } from './api';

/**
 * Terjemah otomatis ID → EN lewat API (/translate; penyedia: DeepL bila dikonfigurasi, selain itu MyMemory).
 * `list: true` untuk daftar kata pendek (keyword) — diterjemahkan sekaligus supaya tiap kata tidak salah arti.
 */
export async function translateToEn(texts: string[], opts: { list?: boolean } = {}): Promise<string[]> {
	const res = await api<{ texts: string[] }>('/translate', {
		method: 'POST',
		body: JSON.stringify({ texts, source: 'id', target: 'en', list: opts.list ?? false })
	});
	return res.texts;
}
