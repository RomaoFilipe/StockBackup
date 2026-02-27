export interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  role?: "USER" | "ADMIN";
  permissions?: string[];
  permissionGrants?: Array<{ key: string; requestingServiceId: number | null }>;
  createdAt?: string;
  updatedAt?: string;
}

export const getSessionClient = async (): Promise<SessionUser | null> => {
  try {
    const abortController = new AbortController();
    const timeoutMs = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 15000);
    const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      signal: abortController.signal,
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SessionUser;
  } catch {
    return null;
  }
};
