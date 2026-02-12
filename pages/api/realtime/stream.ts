import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { RealtimeEnvelope, subscribeRealtimeEvents } from "@/utils/realtime";

export const config = {
  api: {
    bodyParser: false,
  },
};

function shouldDeliver(session: any, event: RealtimeEnvelope) {
  if (!session?.tenantId || event.tenantId !== session.tenantId) return false;

  if (session.role === "ADMIN") {
    return true;
  }

  if (event.audience === "ADMIN") return false;
  if (!event.userId) return true;
  return event.userId === session.id;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`event: ready\n`);
  res.write(`data: ${JSON.stringify({ ok: true, now: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeRealtimeEvents((event) => {
    if (!shouldDeliver(session, event)) return;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 25000);

  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
}
