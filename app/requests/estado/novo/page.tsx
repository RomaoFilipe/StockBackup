"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type IntakeMeta = {
  requestingService: { id: number; codigo: string; designacao: string };
  requesterName: string;
  requestedAt: string;
};

export default function NewRequestFromStatusPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [meta, setMeta] = useState<IntakeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/requests/estado/novo");
      return;
    }
    if (user?.role !== "USER") {
      router.replace("/requests/estado");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/requests/user-intake");
        if (!cancelled) {
          setMeta(res.data as IntakeMeta);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Erro",
            description: error?.response?.data?.error || "Não foi possível abrir o formulário.",
            variant: "destructive",
          });
          router.replace("/requests/estado");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isLoggedIn, router, toast, user?.role]);

  const requestedAtDisplay = useMemo(() => {
    if (!meta?.requestedAt) return new Date().toLocaleString("pt-PT");
    const d = new Date(meta.requestedAt);
    return Number.isNaN(d.getTime()) ? new Date().toLocaleString("pt-PT") : d.toLocaleString("pt-PT");
  }, [meta?.requestedAt]);

  const serviceDisplay = useMemo(() => {
    if (!meta?.requestingService) return "";
    const s = meta.requestingService;
    return `${s.designacao}${s.codigo ? ` (${s.codigo})` : ""}`;
  }, [meta?.requestingService]);

  const canSubmit = !loading && !submitting && deliveryLocation.trim().length > 0 && notes.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await axiosInstance.post("/requests/user-intake", {
        title: title.trim() || undefined,
        deliveryLocation: deliveryLocation.trim(),
        notes: notes.trim(),
      });

      const requestId = String(res.data?.id || "");
      toast({
        title: "Pedido submetido",
        description: requestId ? `ID: ${requestId}` : undefined,
      });
      router.replace(`/requests/estado${requestId ? `?submitted=${encodeURIComponent(requestId)}` : ""}`);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.response?.data?.error || "Não foi possível submeter.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pedido</CardTitle>
            <CardDescription>{loading ? "A carregar..." : serviceDisplay}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <div className="text-sm font-medium">Serviço requisitante</div>
                <Input value={serviceDisplay} disabled />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Data/Hora do pedido</div>
                <Input value={requestedAtDisplay} disabled />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Nome</div>
                <Input value={meta?.requesterName || ""} disabled />
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
                placeholder="EX: A PRESENTE AQUISIÇÃO, MEDIANTE PEDIDO SUPERIOR, DESTINA-SE À AQUISIÇÃO E/OU SUBSTITUIÇÃO..."
                className="min-h-[140px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <Button onClick={submit} disabled={!canSubmit} isLoading={submitting}>
                Submeter pedido
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
