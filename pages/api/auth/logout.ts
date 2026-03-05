import { NextApiRequest, NextApiResponse } from "next";
import Cookies from "cookies";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "");
  const isSecure = forwardedProto === "https" || Boolean((req.socket as any)?.encrypted);

  const cookies = new Cookies(req, res, { secure: isSecure });
  cookies.set("session_id", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  // Clear user_role cookie as well
  cookies.set("user_role", "", {
    httpOnly: false,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookies.set("csrf_token", "", {
    httpOnly: false,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res.status(204).end();
}
