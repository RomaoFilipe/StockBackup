import axios from "axios";

const axiosInstance = axios.create({
  // usa sempre a API do mesmo host (AWS/Vercel/Local)
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default axiosInstance;
