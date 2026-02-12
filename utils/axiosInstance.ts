import axios from "axios";

const axiosInstance = axios.create({
  // usa sempre a API do mesmo host (AWS/Vercel/Local)
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("csrf_token="));
    const csrfToken = cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : "";
    if (csrfToken) {
      config.headers = config.headers ?? {};
      (config.headers as any)["x-csrf-token"] = csrfToken;
    }
  }
  return config;
});

export default axiosInstance;
