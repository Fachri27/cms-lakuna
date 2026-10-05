# Lakuna Studio — CMS (SvelteKit)

Panel administrasi & studio kontributor Lakuna Foto. Hasil migrasi dari Next.js ke SvelteKit 2 + Svelte 5 + Vite + Tailwind 4.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3001
```

Backend API harus jalan di `http://localhost:3000` (lihat `PUBLIC_API_URL` di `.env`).

```bash
npm run check   # typecheck
npm run build   # build produksi
```

## Struktur

- `src/routes/login` — login admin/kontributor
- `src/routes/dashboard` — ringkasan studio
- `src/routes/dashboard/{photos,approval,categories,keywords,photographers,orders,subscriptions,payouts,vouchers,events,users,homepage,settings}` — modul admin
- `src/routes/dashboard/contributor/{,upload,earnings}` — area kontributor
- `src/lib/api.ts` — HTTP client (Bearer + auto refresh)
- `src/lib/components/` — komponen UI bersama (port dari `ui.tsx`)

Kode Next.js lama tersimpan di `.next-backup/` sebagai referensi.
