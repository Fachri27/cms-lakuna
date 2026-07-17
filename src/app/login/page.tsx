"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInput, LoginSchema } from "@/lib/auth";
import { api } from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Kicker, Btn, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Jangan auto-redirect kalau token sudah kedaluwarsa — biarkan user login ulang.
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        Cookies.remove("accessToken", { path: "/" });
        Cookies.remove("refreshToken", { path: "/" });
        return;
      }
      if (payload.role === "ADMIN") {
        router.replace("/dashboard");
      } else if (payload.role === "CONTRIBUTOR") {
        router.replace("/dashboard/contributor");
      } else {
        Cookies.remove("accessToken", { path: "/" });
        Cookies.remove("refreshToken", { path: "/" });
      }
    } catch {
      Cookies.remove("accessToken", { path: "/" });
      Cookies.remove("refreshToken", { path: "/" });
    }
  }, [router, accessToken]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setServerError("");
    try {
      const res = await api.post("/auth/login", data);
      const token = res.data.data.accessToken;
      const refreshToken = res.data.data.refreshToken;

      const isProd = process.env.NODE_ENV === "production";

      Cookies.set("accessToken", token, {
        secure: isProd,
        sameSite: isProd ? "Strict" : "Lax",
        path: "/",
      });
      Cookies.set("refreshToken", refreshToken, {
        secure: isProd,
        sameSite: isProd ? "Strict" : "Lax",
        path: "/",
      });

      setAccessToken(token);

      const role = res.data.data.user?.role;
      if (role === "CONTRIBUTOR") {
        router.push("/dashboard/contributor");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        "Login gagal";
      setServerError(errorMsg);
    }
  }

  const features = [
    "Kelola foto, koleksi, & persetujuan",
    "Atur pengguna dan kontributor",
    "Pantau transaksi dan pencairan",
  ];

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — ink */}
      <div className="hidden md:flex flex-1 items-center justify-center p-12 relative overflow-hidden bg-ink">
        <div
          aria-hidden
          className="absolute top-0 left-0 h-px w-24 bg-safelight"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, rgba(255,77,18,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,77,18,0.04) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-md text-paper fade">
          <div className="flex items-center gap-2.5 mb-8">
            <span aria-hidden className="text-safelight text-xl leading-none">
              ▣
            </span>
            <span className="font-display text-2xl tracking-[-0.01em]">
              Lakuna
            </span>
          </div>
          <Kicker tone="paper" className="mb-5">
            Studio / CMS
          </Kicker>
          <h1 className="font-display text-[2.9rem] leading-[1.05] tracking-[-0.015em] mb-5">
            Ruang gelap untuk
            <br />
            <span className="text-safelight italic">arsip visual</span> nusantara.
          </h1>
          <p className="text-sm leading-relaxed text-paper/45 mb-10 max-w-sm">
            Panel administrasi & studio kontributor — kelola konten, pengguna,
            dan pengaturan platform dari satu tempat.
          </p>

          <ul className="space-y-3.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="font-mono text-[10px] text-safelight tracking-widest"
                >
                  ◇
                </span>
                <span className="text-sm text-paper/55">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel — paper */}
      <div className="flex-1 flex items-center justify-center p-8 bg-paper">
        <div className="w-full max-w-sm rise">
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <span aria-hidden className="text-safelight text-lg leading-none">
              ▣
            </span>
            <span className="font-display text-xl tracking-[-0.01em]">Lakuna</span>
          </div>

          <Kicker className="mb-4">Masuk</Kicker>
          <h2 className="font-display text-[2rem] leading-tight tracking-[-0.01em] mb-1.5">
            Selamat datang
          </h2>
          <p className="text-sm text-ash mb-8">
            Masuk ke panel administrasi studio.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="nama@email.com"
                {...register("email")}
                className="w-full px-3.5 py-3 text-sm border hairline border-solid rounded-[3px] bg-card-2 text-ink outline-none transition-colors focus:border-safelight focus:ring-2 focus:ring-safelight/15 placeholder:text-ash-2"
              />
              {errors.email && (
                <p className="text-safelight-dim text-xs mt-1.5 font-mono">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
                Sandi
              </label>
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                {...register("password")}
                className="w-full px-3.5 py-3 text-sm border hairline border-solid rounded-[3px] bg-card-2 text-ink outline-none transition-colors focus:border-safelight focus:ring-2 focus:ring-safelight/15 placeholder:text-ash-2"
              />
              {errors.password && (
                <p className="text-safelight-dim text-xs mt-1.5 font-mono">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-safelight-dim text-xs font-mono border-l-2 border-safelight pl-3 py-1">
                {serverError}
              </p>
            )}

            <Btn
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-3"
            >
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? "Memproses" : "Masuk"}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}