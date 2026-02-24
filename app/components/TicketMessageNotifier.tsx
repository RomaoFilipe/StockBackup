"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/authContext";

type TicketMessageRealtimeEvent = {
  payload?: {
    ticketId?: string;
    messageId?: string;
    code?: string;
    authorUserId?: string;
  };
};

export default function TicketMessageNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, isLoggedIn, isAuthLoading } = useAuth();
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn || !user?.id) return;

    const es = new EventSource("/api/realtime/stream");
    const onMessageCreated = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as TicketMessageRealtimeEvent;
        const ticketId = data?.payload?.ticketId;
        const messageId = data?.payload?.messageId;
        const ticketCode = data?.payload?.code || "Ticket";
        const authorUserId = data?.payload?.authorUserId;

        if (!ticketId || !messageId) return;
        if (authorUserId && authorUserId === user.id) return;
        if (seenMessageIdsRef.current.has(messageId)) return;
        seenMessageIdsRef.current.add(messageId);
        if (seenMessageIdsRef.current.size > 100) {
          const first = seenMessageIdsRef.current.values().next().value;
          if (first) seenMessageIdsRef.current.delete(first);
        }

        const onSameTicketPage = pathname === `/tickets/${ticketId}`;
        if (onSameTicketPage) return;

        toast({
          title: `Nova mensagem em ${ticketCode}`,
          description: "Recebeste uma nova atualização no ticket.",
          action: (
            <Button size="sm" variant="outline" onClick={() => router.push(`/tickets/${ticketId}`)}>
              Abrir
            </Button>
          ),
        });

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const n = new Notification(`Nova mensagem • ${ticketCode}`, {
            body: "Abre o ticket para ver a resposta.",
          });
          n.onclick = () => {
            window.focus();
            router.push(`/tickets/${ticketId}`);
            n.close();
          };
        }
      } catch {
        // ignore malformed event payload
      }
    };

    es.addEventListener("ticket.message_created", onMessageCreated);
    return () => {
      es.removeEventListener("ticket.message_created", onMessageCreated);
      es.close();
    };
  }, [isAuthLoading, isLoggedIn, pathname, router, toast, user?.id]);

  return null;
}

