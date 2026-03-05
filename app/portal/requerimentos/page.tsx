"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ItemDraft = {
  productId: string;
  quantity: number;
  unit: string;
};

export default function PortalRequerimentosPage() {
  const { toast } = useToast();

  const [requestingServiceId, setRequestingServiceId] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ productId: "", quantity: 1, unit: "" }]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!requestingServiceId || !requesterName.trim() || items.some((it) => !it.productId || it.quantity <= 0)) {
      toast({ title: "Portal", description: "Preenche todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestingServiceId: Number(requestingServiceId),
          requesterName,
          deliveryLocation: deliveryLocation || undefined,
          title: title || undefined,
          notes: notes || undefined,
          items,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Falha ao submeter requerimento");
      }

      setRequesterName("");
      setDeliveryLocation("");
      setTitle("");
      setNotes("");
      setItems([{ productId: "", quantity: 1, unit: "" }]);

      toast({ title: "Portal", description: `Requerimento submetido (ID: ${data.id}).` });
    } catch (error: any) {
      toast({ title: "Portal", description: error?.message || "Falha ao submeter requerimento.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="rounded-2xl border border-border/60 p-5">
        <h1 className="text-2xl font-semibold">Portal de Requerimentos Externos</h1>
        <p className="text-sm text-muted-foreground">Submissão de pedido para os serviços municipais.</p>
      </div>

      <div className="rounded-2xl border border-border/60 p-5 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>ID Serviço Requisitante</Label>
            <Input value={requestingServiceId} onChange={(e) => setRequestingServiceId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do Requerente</Label>
            <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Local de Entrega</Label>
            <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Product UUID"
                value={item.productId}
                onChange={(e) => {
                  const next = [...items];
                  next[index].productId = e.target.value;
                  setItems(next);
                }}
              />
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => {
                  const next = [...items];
                  next[index].quantity = Number(e.target.value);
                  setItems(next);
                }}
              />
              <Input
                placeholder="Unidade"
                value={item.unit}
                onChange={(e) => {
                  const next = [...items];
                  next[index].unit = e.target.value;
                  setItems(next);
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setItems((prev) => [...prev, { productId: "", quantity: 1, unit: "" }])}
          >
            Adicionar item
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "A submeter..." : "Submeter requerimento"}
          </Button>
        </div>
      </div>
    </main>
  );
}
