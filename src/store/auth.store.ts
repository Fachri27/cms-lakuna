import { create } from "zustand";
import Cookies from "js-cookie";

interface AuthStore {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  setAccessToken: (token) => {
    Cookies.set("accessToken", token, { expires: 1 / 96, path: "/" }); // 15 menit
    set({ accessToken: token });
  },
  clearAccessToken: () => {
    Cookies.remove("accessToken", { path: "/" });
    set({ accessToken: null });
  },
}));
