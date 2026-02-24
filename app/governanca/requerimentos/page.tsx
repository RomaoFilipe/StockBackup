"use client";

import { useState } from "react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

export default function GovernancaRequerimentosPage() {
  const { toast } = useToast();
  const [requestId, setRequestId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const dispatchToPresidency = async () => {
    if (!requestId.trim()) {
      toast({ title: "Requerimentos", description: "Indica um ID de requisição.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post(`/requests/${requestId}/presidency-dispatch`, { note: note || null });
      toast({ title: "Requerimentos", description: "Despacho enviado para presidência." });
    } catch (error: any) {
      toast({ title: "Requerimentos", description: error?.response?.data?.error || "Falha no despacho.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader title="Requerimentos" description="Internos e externos com despacho da presidência." />

        <SectionCard
          title="Despacho para Presidência"
          description="Encaminha uma requisição interna para decisão presidencial."
          actions={<Button onClick={() => void dispatchToPresidency()} disabled={loading}>{loading ? "A enviar..." : "Enviar"}</Button>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ID da Requisição</Label>
              <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} placeholder="UUID da requisição" />
            </div>
            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para presidência" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Portal Externo"
          description="API pública para submissão de requerimentos externos disponível em /api/portal/requests."
        >
          <p className="text-sm text-muted-foreground">
            Esta fase já inclui endpoint público para receção de requerimentos externos com itens e serviço requisitante.
          </p>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
