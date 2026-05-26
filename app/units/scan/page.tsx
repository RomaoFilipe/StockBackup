"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveX, Camera, ExternalLink, RefreshCw, RotateCcw, Search, ShieldAlert, Wrench } from "lucide-react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import EmptyState from "@/app/components/EmptyState";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type UnitStatus = "IN_STOCK" | "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
type UnitAction = "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";

type UnitDetail = {
  id: string;
  code: string;
  status: UnitStatus;
  serialNumber?: string | null;
  assetTag?: string | null;
  acquiredAt?: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    supplier?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
  };
  assignedTo?: { id: string; name: string; email: string } | null;
  invoice?: { invoiceNumber: string; reqNumber?: string | null } | null;
  stockMovements: Array<{
    id: string;
    type: "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";
    reason?: string | null;
    notes?: string | null;
    createdAt: string;
    request?: { id: string; gtmiNumber: string; status: string } | null;
    performedBy?: { id: string; name: string; email: string } | null;
    assignedTo?: { id: string; name: string; email: string } | null;
  }>;
};

function extractUnitCode(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const code = url.searchParams.get("code");
    if (code) return code.trim();
  } catch {
    // Plain QR content or partial URL.
  }

  const queryMatch = value.match(/[?&]code=([0-9a-fA-F-]{36})/);
  if (queryMatch?.[1]) return queryMatch[1];

  const uuidMatch = value.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return uuidMatch?.[0] || value;
}

function statusMeta(status: UnitStatus) {
  switch (status) {
    case "IN_STOCK":
      return { label: "Em stock", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" };
    case "ACQUIRED":
      return { label: "Entregue", className: "border-sky-500/30 bg-sky-500/10 text-sky-700" };
    case "IN_REPAIR":
      return { label: "Em reparação", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" };
    case "SCRAPPED":
      return { label: "Abatido", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700" };
    case "LOST":
      return { label: "Perdido", className: "border-rose-500/30 bg-rose-500/10 text-rose-700" };
  }
}

function movementLabel(type?: UnitDetail["stockMovements"][number]["type"]) {
  switch (type) {
    case "IN":
      return "Entrada";
    case "OUT":
      return "Saída";
    case "RETURN":
      return "Devolução";
    case "REPAIR_OUT":
      return "Enviado para reparação";
    case "REPAIR_IN":
      return "Recebido da reparação";
    case "SCRAP":
      return "Abate";
    case "LOST":
      return "Perdido";
    default:
      return "Sem movimento";
  }
}

export default function UnitScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScannedRef = useRef("");

  const [manualValue, setManualValue] = useState("");
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const lastMovement = unit?.stockMovements?.[0] ?? null;
  const meta = unit ? statusMeta(unit.status) : null;

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraRunning(false);
  }, []);

  const resolveCode = useCallback(
    async (input: string) => {
      const code = extractUnitCode(input);
      if (!code) return;
      setLoading(true);
      setCameraError("");
      try {
        const lookup = await axiosInstance.get<{ id: string }>("/units/lookup", { params: { code } });
        const detail = await axiosInstance.get<UnitDetail>(`/units/${lookup.data.id}`);
        setUnit(detail.data);
        setManualValue(code);
        lastScannedRef.current = code;
      } catch (error: any) {
        setUnit(null);
        toast({
          title: "QR não encontrado",
          description: error?.response?.data?.error || "Não foi possível abrir a ficha desta unidade.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError("");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        const text = result?.getText();
        if (!text) return;
        const code = extractUnitCode(text);
        if (!code || code === lastScannedRef.current) return;
        void resolveCode(code);
      });
      setCameraRunning(true);
    } catch (error: any) {
      setCameraError(error?.message || "Não foi possível iniciar a câmara.");
      setCameraRunning(false);
    }
  }, [resolveCode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const executeReturn = async () => {
    if (!unit) return;
    setActionLoading("RETURN");
    try {
      const res = await axiosInstance.post("/units/return", {
        code: unit.code,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      toast({
        title: "Devolução iniciada",
        description: `Criada a requisição ${res.data?.linkedRequest?.gtmiNumber || ""}.`,
      });
      await resolveCode(unit.code);
    } catch (error: any) {
      toast({
        title: "Falha ao devolver",
        description: error?.response?.data?.error || "Não foi possível iniciar a devolução.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const executeAction = async (action: UnitAction) => {
    if (!unit) return;
    setActionLoading(action);
    try {
      await axiosInstance.post("/units/action", {
        code: unit.code,
        action,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      toast({ title: "Ação registada", description: "A ficha da unidade foi atualizada." });
      await resolveCode(unit.code);
    } catch (error: any) {
      toast({
        title: "Falha na ação",
        description: error?.response?.data?.error || "Não foi possível atualizar a unidade.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const actionButtons = useMemo(() => {
    if (!unit) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {unit.status === "ACQUIRED" ? (
          <Button variant="outline" disabled={Boolean(actionLoading)} onClick={() => void executeReturn()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {actionLoading === "RETURN" ? "A devolver..." : "Devolver"}
          </Button>
        ) : null}
        {unit.status === "IN_REPAIR" ? (
          <Button variant="outline" disabled={Boolean(actionLoading)} onClick={() => void executeAction("REPAIR_IN")}>
            <Wrench className="mr-2 h-4 w-4" />
            {actionLoading === "REPAIR_IN" ? "A receber..." : "Receber reparação"}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={Boolean(actionLoading) || unit.status === "SCRAPPED" || unit.status === "LOST"}
            onClick={() => void executeAction("REPAIR_OUT")}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {actionLoading === "REPAIR_OUT" ? "A enviar..." : "Reparar"}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={Boolean(actionLoading) || unit.status === "SCRAPPED"}
          onClick={() => void executeAction("SCRAP")}
        >
          <ArchiveX className="mr-2 h-4 w-4" />
          {actionLoading === "SCRAP" ? "A abater..." : "Abatido"}
        </Button>
        <Button
          variant="outline"
          disabled={Boolean(actionLoading) || unit.status === "LOST"}
          onClick={() => void executeAction("LOST")}
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          {actionLoading === "LOST" ? "A marcar..." : "Perdido"}
        </Button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionLoading, unit, reason, notes]);

  return (
    <AuthenticatedLayout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Scanner QR"
          description="Leia uma etiqueta para abrir a ficha da unidade e executar ações rápidas."
          actions={
            <Button variant="outline" onClick={() => router.push("/units/reservations")}>
              Reservas QR
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <SectionCard title="Leitura" description="Use a câmara ou cole o código/link do QR.">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-black">
                <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              </div>
              {cameraError ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{cameraError}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void startCamera()} disabled={cameraRunning}>
                  <Camera className="mr-2 h-4 w-4" />
                  {cameraRunning ? "Câmara ativa" : "Iniciar câmara"}
                </Button>
                <Button type="button" variant="outline" onClick={stopCamera} disabled={!cameraRunning}>
                  Parar
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder="Cole aqui o QR, link ou código da unidade"
                />
                <Button type="button" variant="outline" onClick={() => void resolveCode(manualValue)} disabled={loading}>
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? "A procurar..." : "Procurar"}
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Unidade" description="Estado atual e ações disponíveis para o equipamento.">
            {!unit ? (
              <EmptyState title="Nenhum QR lido" description="Aponte a câmara para uma etiqueta ou introduza o código manualmente." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xl font-semibold">{unit.product.name}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground break-all">{unit.code}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta ? <Badge variant="outline" className={meta.className}>{meta.label}</Badge> : null}
                      <Badge variant="secondary">{unit.product.sku}</Badge>
                      {unit.assetTag ? <Badge variant="secondary">Asset {unit.assetTag}</Badge> : null}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => router.push(`/units/${unit.id}`)}>
                    Abrir ficha
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Entregue a" value={unit.assignedTo?.name || "—"} />
                  <Info label="S/N" value={unit.serialNumber || "—"} />
                  <Info label="Fornecedor" value={unit.product.supplier?.name || "—"} />
                  <Info label="Fatura" value={unit.invoice?.invoiceNumber || "—"} />
                  <Info label="Último movimento" value={movementLabel(lastMovement?.type)} />
                  <Info label="Data" value={lastMovement ? new Date(lastMovement.createdAt).toLocaleString("pt-PT") : "—"} />
                </div>

                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">Nota para a ação</div>
                  <div className="mt-3 grid gap-3">
                    <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo curto" />
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observações internas" />
                  </div>
                  <div className="mt-3">{actionButtons}</div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
