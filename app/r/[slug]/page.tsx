"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PublicLinkMeta = {
  access: { id: string; slug: string; isActive: boolean };
  requestingService: { id: number; codigo: string; designacao: string; ativo: boolean };
};

export default function PublicRequestPage() {
  const params = useParams<{ slug?: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { toast } = useToast();

  const [meta, setMeta] = useState<PublicLinkMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [pin, setPin] = useState("");

  const [requesterName, setRequesterName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [requestedAtDisplay, setRequestedAtDisplay] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    setRequestedAtDisplay(new Date().toLocaleString("pt-PT"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch(`/api/public/request-links/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Link inválido ou inativo.");
        }

        if (!cancelled) setMeta(data as PublicLinkMeta);
      } catch (e: any) {
        if (!cancelled) setMetaError(e?.message || "Não foi possível carregar.");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    if (slug) load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canSubmit =
    pin.trim().length >= 4 &&
    requesterName.trim().length > 0 &&
    deliveryLocation.trim().length > 0 &&
    notes.trim().length > 0 &&
    !submitting &&
    !metaLoading &&
    !metaError;

  async function submit() {
    if (pin.trim().length < 4) {
      toast({ title: "Erro", description: "Introduza um PIN válido.", variant: "destructive" });
      return;
    }

    if (!requesterName.trim()) {
      toast({ title: "Erro", description: "Indique o seu nome.", variant: "destructive" });
      return;
    }

    if (!deliveryLocation.trim()) {
      toast({ title: "Erro", description: "Indique o local de entrega.", variant: "destructive" });
      return;
    }

    if (!notes.trim()) {
      toast({ title: "Erro", description: "Indique o fundamento do pedido.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/request-links/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pin.trim(),
          requesterName: requesterName.trim(),
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          deliveryLocation: deliveryLocation.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível submeter.");
      }

      setSubmittedId(String(data?.id || ""));
      toast({ title: "Pedido submetido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Não foi possível submeter.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const serviceName = meta?.requestingService?.designacao ?? "";
  const serviceCode = meta?.requestingService?.codigo ?? "";

  return (
    <div className="min-h-[calc(100vh-2rem)] p-4 sm:p-8 flex items-start justify-center">
      <div className="w-full max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pedido</CardTitle>
            <CardDescription>
              {metaLoading ? "A carregar..." : metaError ? metaError : `${serviceName}${serviceCode ? ` (${serviceCode})` : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submittedId ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Pedido submetido com sucesso.</div>
                <div className="text-sm text-muted-foreground">Pode fechar esta página.</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <div className="text-sm font-medium">PIN</div>
                    <Input
                      type="password"
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                      }}
                      placeholder="Introduza o PIN"
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="flex items-end" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <div className="text-sm font-medium">Serviço requisitante</div>
                    <Input
                      value={
                        meta?.requestingService
                          ? `${meta.requestingService.designacao}${meta.requestingService.codigo ? ` (${meta.requestingService.codigo})` : ""}`
                          : ""
                      }
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Data/Hora do pedido</div>
                    <Input value={requestedAtDisplay} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Nome</div>
                    <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome do requerente" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Pedido (opcional)</div>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Pedido de Aquisição de um Portátil"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Local de entrega</div>
                  <Input
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="Ex: Gabinete / Armazém / Secção"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Fundamento do Pedido</div>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      "EX: A PRESENTE AQUISIÇÃO, MEDIANTE PEDIDO SUPERIOR, DESTINA-SE À AQUISIÇÃO E/OU SUBSTITUIÇÃO DO ATUAL EQUIPAMENTO INFORMÁTICO, O QUAL APRESENTA PROBLEMAS DE DESEMPENHO, COM VISTA À INSTALAÇÃO DAS APLICAÇÕES AUTÁRQUICAS E DE PRODUTIVIDADE NECESSÁRIAS, GARANTINDO O NORMAL FUNCIONAMENTO E A EFICIÊNCIA DO SERVIÇO."
                    }
                    className="min-h-[140px]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <Button onClick={submit} disabled={!canSubmit} isLoading={submitting}>
                    Submeter pedido
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
