import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Public registration is intentionally disabled.
  // Users must be provisioned by an ADMIN via the internal admin panel.
  return res.status(403).json({
    error: "Registration disabled",
    code: "REGISTRATION_DISABLED",
  });
}
