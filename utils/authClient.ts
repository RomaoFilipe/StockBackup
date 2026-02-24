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
    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SessionUser;
  } catch {
    return null;
  }
};
