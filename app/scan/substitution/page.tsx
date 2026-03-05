"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type SessionUser = {
  id: string;
  role: "USER" | "ADMIN";
};

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type UnitPreview = {
  id: string;
  code: string;
  status: "IN_STOCK" | "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
  assignedTo?: { id: string; name: string; email: string } | null;
  product: { id: string; name: string; sku: string };
};

type OldDisposition = "RETURN" | "REPAIR" | "SCRAP" | "LOST";

type SubstituteResponse = {
  kind: "ok";
  substitutionId: string;
  oldUnit: {
    id: string;
    code: string;
    statusAfter: "IN_STOCK" | "IN_REPAIR" | "SCRAPPED" | "LOST";
    product: { id: string; name: string; sku: string };
  };
  newUnit: {
    id: string;
    code: string;
    statusAfter: "ACQUIRED";
    product: { id: string; name: string; sku: string };
  };
  meta: {
    reason: string | null;
    reasonCode: "AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO";
    reasonDetail: string | null;
    costCenter: string | null;
    ticketNumber: string | null;
    notes: string | null;
    compatibilityOverrideReason?: string | null;
    performedAt: string;
  };
  linkedRequest: {
    id: string;
    gtmiNumber: string;
    ownerUserId: string;
    ownerName: string;
  };
};

type SubstitutionHistoryItem = {
  id: string;
  createdAt: string;
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
  actor?: { id: string; name: string; email: string } | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function statusLabel(status: UnitPreview["status"] | "ACQUIRED") {
  if (status === "IN_STOCK") return "Em stock";
  if (status === "ACQUIRED") return "Adquirida";
  if (status === "IN_REPAIR") return "Em reparação";
  if (status === "SCRAPPED") return "Abatida";
  return "Perdida";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ScanSubstitutionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [oldDisposition, setOldDisposition] = useState<OldDisposition>("RETURN");
  const [returnReasonCode, setReturnReasonCode] = useState<"AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO">("OUTRO");
  const [returnReasonDetail, setReturnReasonDetail] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [reason, setReason] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [compatibilityOverrideReason, setCompatibilityOverrideReason] = useState("");

  useEffect(() => {
    if (returnReasonCode === "AVARIA") {
      if (oldDisposition !== "REPAIR" && oldDisposition !== "SCRAP") setOldDisposition("REPAIR");
      return;
    }
    if (returnReasonCode === "EXTRAVIO") {
      setOldDisposition("LOST");
      return;
    }
    if (returnReasonCode === "FIM_USO" || returnReasonCode === "TROCA") {
      setOldDisposition("RETURN");
    }
  }, [returnReasonCode, oldDisposition]);

  const [oldPreview, setOldPreview] = useState<UnitPreview | null>(null);
  const [newPreview, setNewPreview] = useState<UnitPreview | null>(null);
  const [loadingOld, setLoadingOld] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<SubstituteResponse | null>(null);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyQ, setHistoryQ] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<SubstitutionHistoryItem[]>([]);
  const [eventQrDataUrl, setEventQrDataUrl] = useState("");

  useEffect(() => {
    const oldCodeParam = searchParams?.get("oldCode") ?? "";
    const newCodeParam = searchParams?.get("newCode") ?? "";
    if (oldCodeParam) setOldCode(oldCodeParam);
    if (newCodeParam) setNewCode(newCodeParam);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = (await res.json()) as SessionUser;
        if (!cancelled) setSession(data);
      } catch {
        // ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (session?.role !== "ADMIN") return;
      try {
        const res = await fetch("/api/users");
        if (!res.ok) return;
        const data = (await res.json()) as UserOption[];
        if (!cancelled) setUsers(data);
      } catch {
        // ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.role]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const code = oldCode.trim();
      if (!isUuid(code)) {
        setOldPreview(null);
        return;
      }
      setLoadingOld(true);
      try {
        const res = await fetch(`/api/units/lookup?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setOldPreview(null);
          return;
        }
        const data = (await res.json()) as UnitPreview;
        if (cancelled) return;
        setOldPreview(data);
        if (!assignedToUserId && data.assignedTo?.id) setAssignedToUserId(data.assignedTo.id);
      } catch {
        if (!cancelled) setOldPreview(null);
      } finally {
        if (!cancelled) setLoadingOld(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [oldCode, assignedToUserId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const code = newCode.trim();
      if (!isUuid(code)) {
        setNewPreview(null);
        return;
      }
      setLoadingNew(true);
      try {
        const res = await fetch(`/api/units/lookup?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setNewPreview(null);
          return;
        }
        const data = (await res.json()) as UnitPreview;
        if (cancelled) return;
        setNewPreview(data);
      } catch {
        if (!cancelled) setNewPreview(null);
      } finally {
        if (!cancelled) setLoadingNew(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [newCode]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setHistoryLoading(true);
      try {
        const qs = new URLSearchParams();
        if (historyFrom) qs.set("from", new Date(`${historyFrom}T00:00:00`).toISOString());
        if (historyTo) qs.set("to", new Date(`${historyTo}T23:59:59`).toISOString());
        if (historyQ.trim()) qs.set("q", historyQ.trim());
        qs.set("limit", "60");
        const res = await fetch(`/api/units/substitutions?${qs.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: SubstitutionHistoryItem[] };
        if (!cancelled) setHistoryItems(data.items ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    const t = setTimeout(() => {
      void run();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [historyFrom, historyTo, historyQ, result?.substitutionId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!result?.substitutionId || typeof window === "undefined") {
        setEventQrDataUrl("");
        return;
      }
      try {
        const url = `${window.location.origin}/scan/substitution/${encodeURIComponent(result.substitutionId)}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
        if (!cancelled) setEventQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setEventQrDataUrl("");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [result?.substitutionId]);

  const buildPickHref = (field: "oldCode" | "newCode") => {
    const retParams = new URLSearchParams();
    if (field !== "oldCode" && oldCode.trim()) retParams.set("oldCode", oldCode.trim());
    if (field !== "newCode" && newCode.trim()) retParams.set("newCode", newCode.trim());
    const returnTo = `/scan/substitution${retParams.toString() ? `?${retParams.toString()}` : ""}`;

    const qs = new URLSearchParams();
    qs.set("pickField", field);
    qs.set("returnTo", returnTo);
    return `/scan?${qs.toString()}`;
  };

  const canSubmit = useMemo(() => {
    const base = isUuid(oldCode) && isUuid(newCode) && oldCode.trim() !== newCode.trim() && !submitting;
    if (!base) return false;
    if (returnReasonCode === "OUTRO" && !returnReasonDetail.trim()) return false;
    if (returnReasonCode === "EXTRAVIO" && session?.role !== "ADMIN") return false;
    const skuMismatch = Boolean(oldPreview && newPreview && oldPreview.product.id !== newPreview.product.id);
    if (!skuMismatch) return true;
    return compatibilityOverrideReason.trim().length > 0;
  }, [oldCode, newCode, submitting, oldPreview, newPreview, compatibilityOverrideReason, returnReasonCode, returnReasonDetail, session?.role]);

  const allowedOldDispositions = useMemo<OldDisposition[]>(() => {
    if (returnReasonCode === "AVARIA") {
      return session?.role === "ADMIN" ? ["REPAIR", "SCRAP"] : ["REPAIR"];
    }
    if (returnReasonCode === "EXTRAVIO") {
      return session?.role === "ADMIN" ? ["LOST"] : [];
    }
    if (returnReasonCode === "FIM_USO" || returnReasonCode === "TROCA") {
      return ["RETURN"];
    }
    return session?.role === "ADMIN"
      ? ["RETURN", "REPAIR", "SCRAP", "LOST"]
      : ["RETURN", "REPAIR"];
  }, [returnReasonCode, session?.role]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "Dados inválidos",
        description: "Verifica os códigos antigo/novo e o motivo da devolução (detalhe obrigatório em OUTRO).",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/units/substitute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldCode: oldCode.trim(),
          newCode: newCode.trim(),
          oldDisposition,
          returnReasonCode,
          returnReasonDetail: returnReasonDetail || null,
          assignedToUserId: assignedToUserId || null,
          reason: reason || null,
          costCenter: costCenter || null,
          ticketNumber: ticketNumber || null,
          notes: notes || null,
          compatibilityOverrideReason: compatibilityOverrideReason || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SubstituteResponse & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Falha ao registar substituição");

      setResult(data);
      toast({ title: "Substituição registada", description: `Evento ${data.substitutionId} criado.` });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível registar substituição.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!result) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) return;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Folha de Substituição ${escapeHtml(result.substitutionId)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
    h1 { margin: 0 0 8px 0; font-size: 22px; }
    .meta { margin-bottom: 18px; color: #444; font-size: 13px; }
    .box { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .row { margin: 6px 0; }
    .label { color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .value { font-size: 14px; }
    .sign { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .line { margin-top: 52px; border-top: 1px solid #444; padding-top: 6px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <h1>Requisição de Substituição</h1>
  <div class="meta">Evento: ${escapeHtml(result.substitutionId)} • Data: ${escapeHtml(new Date(result.meta.performedAt).toLocaleString("pt-PT"))}</div>
  ${eventQrDataUrl ? `<div style=\"margin-bottom:12px;\"><img src=\"${eventQrDataUrl}\" alt=\"QR do evento\" style=\"width:130px;height:130px;\" /></div>` : ""}

  <div class="box">
    <div class="label">Equipamento Antigo</div>
    <div class="row value">Código: ${escapeHtml(result.oldUnit.code)}</div>
    <div class="row value">Produto: ${escapeHtml(result.oldUnit.product.name)} (${escapeHtml(result.oldUnit.product.sku)})</div>
    <div class="row value">Estado após operação: ${escapeHtml(statusLabel(result.oldUnit.statusAfter))}</div>
  </div>

  <div class="box">
    <div class="label">Equipamento Novo</div>
    <div class="row value">Código: ${escapeHtml(result.newUnit.code)}</div>
    <div class="row value">Produto: ${escapeHtml(result.newUnit.product.name)} (${escapeHtml(result.newUnit.product.sku)})</div>
    <div class="row value">Estado após operação: ${escapeHtml(statusLabel(result.newUnit.statusAfter))}</div>
  </div>

  <div class="box">
    <div class="label">Motivo e Dados</div>
    <div class="row value">Motivo: ${escapeHtml(result.meta.reason || "-")}</div>
    <div class="row value">Categoria: ${escapeHtml(result.meta.reasonCode || "-")}${result.meta.reasonDetail ? ` (${escapeHtml(result.meta.reasonDetail)})` : ""}</div>
    <div class="row value">Centro de custo: ${escapeHtml(result.meta.costCenter || "-")}</div>
    <div class="row value">Ticket: ${escapeHtml(result.meta.ticketNumber || "-")}</div>
    <div class="row value">Notas: ${escapeHtml(result.meta.notes || "-")}</div>
    <div class="row value">Compatibilidade (override): ${escapeHtml(result.meta.compatibilityOverrideReason || "-")}</div>
  </div>

  <div class="sign">
    <div class="line">Responsável técnico</div>
    <div class="line">Recebedor / utilizador</div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan • Requisição de Substituição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Equipamento antigo (primeiro)</Label>
              <div className="flex gap-2">
                <Input
                  value={oldCode}
                  onChange={(e) => setOldCode(e.target.value)}
                  placeholder="UUID do equipamento antigo"
                />
                <Button variant="outline" onClick={() => router.push(buildPickHref("oldCode"))}>Scan antigo</Button>
              </div>
              {loadingOld ? <p className="text-xs text-muted-foreground">A validar...</p> : null}
              {oldPreview ? (
                <p className="text-xs text-muted-foreground">
                  {oldPreview.product.name} ({oldPreview.product.sku}) • Estado: {statusLabel(oldPreview.status)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Equipamento novo (a seguir)</Label>
              <div className="flex gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="UUID do equipamento novo"
                />
                <Button variant="outline" onClick={() => router.push(buildPickHref("newCode"))}>Scan novo</Button>
              </div>
              {loadingNew ? <p className="text-xs text-muted-foreground">A validar...</p> : null}
              {newPreview ? (
                <p className="text-xs text-muted-foreground">
                  {newPreview.product.name} ({newPreview.product.sku}) • Estado: {statusLabel(newPreview.status)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Motivo da devolução/saída</Label>
              <Select value={returnReasonCode} onValueChange={(v) => setReturnReasonCode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVARIA">Avaria</SelectItem>
                  <SelectItem value="FIM_USO">Fim de uso</SelectItem>
                  <SelectItem value="TROCA">Troca programada</SelectItem>
                  {session?.role === "ADMIN" ? <SelectItem value="EXTRAVIO">Extravio</SelectItem> : null}
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
              {returnReasonCode === "OUTRO" ? (
                <Input
                  value={returnReasonDetail}
                  onChange={(e) => setReturnReasonDetail(e.target.value)}
                  placeholder="Detalha o motivo (obrigatório)"
                />
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Destino do equipamento antigo</Label>
              <Select value={oldDisposition} onValueChange={(v) => setOldDisposition(v as any)}> 
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedOldDispositions.includes("RETURN") ? <SelectItem value="RETURN">Devolver ao stock</SelectItem> : null}
                  {allowedOldDispositions.includes("REPAIR") ? <SelectItem value="REPAIR">Enviar para reparação</SelectItem> : null}
                  {allowedOldDispositions.includes("SCRAP") ? <SelectItem value="SCRAP">Abater antigo</SelectItem> : null}
                  {allowedOldDispositions.includes("LOST") ? <SelectItem value="LOST">Marcar como extraviado</SelectItem> : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">SCRAP/LOST disponível apenas para ADMIN.</p>
            </div>

            {session?.role === "ADMIN" ? (
              <div className="space-y-1">
                <Label>Atribuir novo equipamento a</Label>
                <Select
                  value={assignedToUserId || "__none__"}
                  onValueChange={(value) => setAssignedToUserId(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(Opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(Sem atribuição)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} • {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Substituição por avaria" />
            </div>
            <div className="space-y-1">
              <Label>Centro de custo</Label>
              <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="Ex: TI / 2026" />
            </div>
            <div className="space-y-1">
              <Label>Nº ticket / requisição</Label>
              <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} placeholder="Ex: INC-12345" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px]" />
            </div>
            {oldPreview && newPreview && oldPreview.product.id !== newPreview.product.id ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Justificação de compatibilidade (SKU diferente)</Label>
                <Input
                  value={compatibilityOverrideReason}
                  onChange={(e) => setCompatibilityOverrideReason(e.target.value)}
                  placeholder="Obrigatório quando produto/SKU antigo e novo não são iguais"
                />
                <p className="text-xs text-amber-700">
                  Atenção: o produto antigo e novo são diferentes. Esta justificação é obrigatória.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/scan")}>Voltar ao scan</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} isLoading={submitting}>
              Registar substituição
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Substituição registada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><span className="text-muted-foreground">Evento:</span> {result.substitutionId}</p>
            <p className="text-sm">
              <span className="text-muted-foreground">Req. devolução:</span>{" "}
              <button
                type="button"
                className="underline"
                onClick={() => router.push(`/requests/${encodeURIComponent(result.linkedRequest.id)}`)}
              >
                {result.linkedRequest.gtmiNumber}
              </button>
              {" • "}
              <span className="text-muted-foreground">Pessoa:</span> {result.linkedRequest.ownerName}
            </p>
            <p className="text-sm"><span className="text-muted-foreground">Antigo:</span> {result.oldUnit.code} • {statusLabel(result.oldUnit.statusAfter)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Novo:</span> {result.newUnit.code} • {statusLabel(result.newUnit.statusAfter)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Motivo:</span> {result.meta.reasonCode}{result.meta.reasonDetail ? ` • ${result.meta.reasonDetail}` : ""}</p>
            {result.meta.compatibilityOverrideReason ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Compatibilidade:</span> {result.meta.compatibilityOverrideReason}
              </p>
            ) : null}
            {eventQrDataUrl ? (
              <div className="pt-1">
                <Image src={eventQrDataUrl} alt="QR do evento" width={96} height={96} className="rounded border border-border/60" />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/movements?assignedToUserId=${encodeURIComponent(result.linkedRequest.ownerUserId)}`)}
              >
                Ver histórico da pessoa
              </Button>
              <Button variant="outline" onClick={() => router.push(`/scan/substitution/${encodeURIComponent(result.substitutionId)}`)}>
                Abrir evento
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/api/units/substitutions/pdf?id=${encodeURIComponent(result.substitutionId)}`, "_blank")}
              >
                Baixar PDF oficial
              </Button>
              <Button variant="outline" onClick={handlePrint}>Gerar folha / Imprimir</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Substituições</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Pesquisar</Label>
              <Input
                value={historyQ}
                onChange={(e) => setHistoryQ(e.target.value)}
                placeholder="Evento, código antigo/novo, motivo, ticket..."
              />
            </div>
          </div>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">A carregar histórico...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos para estes filtros.</p>
          ) : (
            <div className="space-y-2">
              {historyItems.map((h) => (
                <div key={h.id} className="rounded-md border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-xs">{h.id}</div>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/scan/substitution/${encodeURIComponent(h.id)}`)}>
                      Abrir evento
                    </Button>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString("pt-PT")} • {h.oldCode} → {h.newCode}
                  </div>
                  <div className="text-muted-foreground">
                    {h.oldDisposition === "SCRAP"
                      ? "Antigo abatido"
                      : h.oldDisposition === "REPAIR"
                        ? "Antigo em reparação"
                        : h.oldDisposition === "LOST"
                          ? "Antigo extraviado"
                          : "Antigo devolvido"} • {h.reason || "Sem motivo"}
                  </div>
                  {h.linkedRequestId ? (
                    <div className="text-muted-foreground">
                      Req:{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => router.push(`/requests/${encodeURIComponent(h.linkedRequestId!)}`)}
                      >
                        {h.linkedRequestGtmiNumber || h.linkedRequestId}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
