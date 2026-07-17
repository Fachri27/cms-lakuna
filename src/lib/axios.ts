import axios from "axios";
import Cookies from "js-cookie";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get("refreshToken");

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        );

        const newAccessToken = res.data.data?.newToken;
        if (!newAccessToken) {
          throw new Error("No token in refresh response");
        }

        const isProd = process.env.NODE_ENV === "production";
        Cookies.set("accessToken", newAccessToken, {
          secure: isProd,
          sameSite: isProd ? "Strict" : "Lax",
          path: "/",
          expires: 1 / 96,
        });

        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        Cookies.remove("accessToken", { path: "/" });
        Cookies.remove("refreshToken", { path: "/" });
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);