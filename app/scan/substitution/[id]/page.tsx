"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EventDetail = {
  id: string;
  createdAt: string;
  note?: string | null;
  oldCode: string;
  newCode: string;
  linkedRequestId: string | null;
  linkedRequestGtmiNumber: string | null;
  oldDisposition: "RETURN" | "REPAIR" | "SCRAP" | "LOST";
  returnReasonCode: "AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO" | null;
  returnReasonDetail: string | null;
  reason: string | null;
  costCenter: string | null;
  ticketNumber: string | null;
  assignedToUserId: string | null;
  actor?: { id: string; name: string; email: string } | null;
  oldUnit?: { id: string; code: string; status: string; product: { id: string; name: string; sku: string } } | null;
  newUnit?: {
    id: string;
    code: string;
    status: string;
    product: { id: string; name: string; sku: string };
    assignedTo?: { id: string; name: string; email: string } | null;
  } | null;
};

function statusLabel(status?: string | null) {
  if (status === "IN_STOCK") return "Em stock";
  if (status === "ACQUIRED") return "Adquirida";
  if (status === "IN_REPAIR") return "Em reparação";
  if (status === "SCRAPPED") return "Abatida";
  if (status === "LOST") return "Perdida";
  return status || "-";
}

export default function SubstitutionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = useMemo(() => (typeof params?.id === "string" ? params.id : ""), [params]);

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/units/substitutions/${encodeURIComponent(id)}`);
        const data = (await res.json().catch(() => ({}))) as EventDetail & { error?: string };
        if (!res.ok) throw new Error(data?.error || "Falha ao carregar evento");
        if (!cancelled) setEvent(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar evento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Substituição • Evento</CardTitle>
            <div className="flex items-center gap-2">
              {id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/units/substitutions/pdf?id=${encodeURIComponent(id)}`, "_blank")}
                >
                  Baixar PDF
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => router.push("/scan/substitution")}>Voltar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">A carregar...</p> : null}
          {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !error && event ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border/60 p-3">
                <p className="font-mono text-xs">{event.id}</p>
                <p className="text-muted-foreground">{new Date(event.createdAt).toLocaleString("pt-PT")}</p>
                <p className="text-muted-foreground">Por: {event.actor?.name || "-"} ({event.actor?.email || "-"})</p>
              </div>

              <div className="rounded-md border border-border/60 p-3">
                <p className="font-medium">Antigo</p>
                <p>{event.oldCode}</p>
                <p className="text-muted-foreground">{event.oldUnit?.product.name || "-"} ({event.oldUnit?.product.sku || "-"})</p>
                <p className="text-muted-foreground">Estado atual: {statusLabel(event.oldUnit?.status)}</p>
                <p className="text-muted-foreground">
                  Destino aplicado: {event.oldDisposition === "SCRAP" ? "Abate" : event.oldDisposition === "REPAIR" ? "Reparação" : event.oldDisposition === "LOST" ? "Extravio" : "Devolução"}
                </p>
              </div>

              <div className="rounded-md border border-border/60 p-3">
                <p className="font-medium">Novo</p>
                <p>{event.newCode}</p>
                <p className="text-muted-foreground">{event.newUnit?.product.name || "-"} ({event.newUnit?.product.sku || "-"})</p>
                <p className="text-muted-foreground">Estado atual: {statusLabel(event.newUnit?.status)}</p>
                <p className="text-muted-foreground">Atribuído a: {event.newUnit?.assignedTo?.name || "-"}</p>
              </div>

              <div className="rounded-md border border-border/60 p-3">
                <p className="font-medium">Contexto</p>
                <p className="text-muted-foreground">Motivo: {event.reason || "-"}</p>
                <p className="text-muted-foreground">Categoria: {event.returnReasonCode || "-"}{event.returnReasonDetail ? ` • ${event.returnReasonDetail}` : ""}</p>
                <p className="text-muted-foreground">Centro de custo: {event.costCenter || "-"}</p>
                <p className="text-muted-foreground">Ticket: {event.ticketNumber || "-"}</p>
                <p className="text-muted-foreground">
                  Requisição de devolução:{" "}
                  {event.linkedRequestId ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => router.push(`/requests/${encodeURIComponent(event.linkedRequestId!)}`)}
                    >
                      {event.linkedRequestGtmiNumber || event.linkedRequestId}
                    </button>
                  ) : (
                    "-"
                  )}
                </p>
                <p className="text-muted-foreground">Nota auditoria: {event.note || "-"}</p>
              </div>

              {event.newUnit?.assignedTo?.id ? (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/movements?assignedToUserId=${encodeURIComponent(event.newUnit!.assignedTo!.id)}`)}
                  >
                    Ver histórico da pessoa
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
