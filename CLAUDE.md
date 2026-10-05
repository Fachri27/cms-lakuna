# CMS — SvelteKit

SvelteKit 2 + Svelte 5 (runes) + Tailwind 4. Dev di port 3001, API di `PUBLIC_API_URL` (default `http://localhost:3000/api`).

- Auth: token di `localStorage` (`accessToken`/`refreshToken`), guard peran di `src/routes/dashboard/+layout.svelte` (ADMIN penuh, CONTRIBUTOR hanya `/dashboard/contributor*`).
- HTTP: pakai `api` / `apiEnvelope` / `apiFetch` dari `src/lib/api.ts` (jangan `fetch` mentah ke API).
- Halaman: client-side (`onMount`), tanpa `$:` — pakai runes (`$state`, `$derived`, `$effect`).
