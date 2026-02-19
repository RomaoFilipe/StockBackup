"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

type UnitLookup = {
  id: string;
  code: string;
  status: "IN_STOCK" | "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
  createdAt: string;
  acquiredAt: string | null;
  acquiredByUserId: string | null;
  assignedToUserId?: string | null;
  acquiredReason?: string | null;
  costCenter?: string | null;
  acquiredNotes?: string | null;
  invoiceId: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  product: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    reqNumber: string | null;
    issuedAt: string;
  } | null;
};

type StockMovement = {
  id: string;
  type: "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";
  quantity: number;
  reason?: string | null;
  costCenter?: string | null;
  notes?: string | null;
  createdAt: string;
  invoice?: { id: string; invoiceNumber: string; reqNumber: string | null } | null;
  request?: { id: string; title: string | null } | null;
  performedBy?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

type UnitActionConfig = {
  endpoint: "/api/units/return" | "/api/units/repair-out" | "/api/units/repair-in" | "/api/units/scrap" | "/api/units/lost";
  pendingSetter: (value: boolean) => void;
  successTitle: string;
  successDescription: (productName: string) => string;
  defaultError: string;
};

type DestructiveActionType = "SCRAP" | "LOST" | null;

const STATUS_LABEL: Record<UnitLookup["status"], string> = {
  IN_STOCK: "Em stock",
  ACQUIRED: "Adquirida",
  IN_REPAIR: "Em reparação",
  SCRAPPED: "Abatida",
  LOST: "Perdida",
};

const STATUS_BADGE_CLASS: Record<UnitLookup["status"], string> = {
  IN_STOCK: "border-emerald-200 bg-emerald-100 text-emerald-800",
  ACQUIRED: "border-sky-200 bg-sky-100 text-sky-800",
  IN_REPAIR: "border-amber-200 bg-amber-100 text-amber-800",
  SCRAPPED: "border-zinc-200 bg-zinc-100 text-zinc-800",
  LOST: "border-rose-200 bg-rose-100 text-rose-800",
};

export default function ScanUnitPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = useMemo(() => (typeof params?.code === "string" ? params.code : ""), [params]);

  const { toast } = useToast();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isRepairOut, setIsRepairOut] = useState(false);
  const [isRepairIn, setIsRepairIn] = useState(false);
  const [isScrapping, setIsScrapping] = useState(false);
  const [isMarkingLost, setIsMarkingLost] = useState(false);
  const [unit, setUnit] = useState<UnitLookup | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [costCenter, setCostCenter] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [destructiveAction, setDestructiveAction] = useState<DestructiveActionType>(null);
  const [destructiveConfirmText, setDestructiveConfirmText] = useState("");

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
      if (!session || session.role !== "ADMIN") return;
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
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!code) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/units/lookup?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Falha ao carregar");
        }
        const data = (await res.json()) as UnitLookup;
        if (!cancelled) {
          setUnit(data);
          // If unit already has metadata, keep the form in sync
          setAssignedToUserId(data.assignedToUserId ?? "");
          setReason(data.acquiredReason ?? "");
          setCostCenter(data.costCenter ?? "");
          setNotes(data.acquiredNotes ?? "");
        }
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error?.message || "Não foi possível carregar a unidade.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, toast]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!unit?.id) return;
      setMovementsLoading(true);
      try {
        const res = await fetch(`/api/stock-movements?unitId=${encodeURIComponent(unit.id)}&limit=10`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: StockMovement[] };
        if (!cancelled) setMovements(data.items ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setMovementsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [unit?.id]);

  const refreshUnitAndMovements = async (unitId: string, unitCode: string) => {
    const lookupRes = await fetch(`/api/units/lookup?code=${encodeURIComponent(unitCode)}`);
    if (lookupRes.ok) {
      const refreshed = (await lookupRes.json()) as UnitLookup;
      setUnit(refreshed);
    }

    const movementsRes = await fetch(`/api/stock-movements?unitId=${encodeURIComponent(unitId)}&limit=10`);
    if (movementsRes.ok) {
      const data = (await movementsRes.json()) as { items?: StockMovement[] };
      setMovements(data.items ?? []);
    }
  };

  const runUnitAction = async (config: UnitActionConfig) => {
    if (!unit) return;

    config.pendingSetter(true);
    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: unit.code,
          reason: reason ? reason : null,
          costCenter: costCenter ? costCenter : null,
          notes: notes ? notes : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || config.defaultError);

      toast({
        title: config.successTitle,
        description: config.successDescription(unit.product.name),
      });

      await refreshUnitAndMovements(unit.id, unit.code);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || config.defaultError,
        variant: "destructive",
      });
    } finally {
      config.pendingSetter(false);
    }
  };

  const handleAcquire = async () => {
    if (!unit) return;
    setIsAcquiring(true);
    try {
      const res = await fetch("/api/units/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: unit.code,
          assignedToUserId: assignedToUserId ? assignedToUserId : null,
          reason: reason ? reason : null,
          costCenter: costCenter ? costCenter : null,
          notes: notes ? notes : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao registar aquisição");

      toast({
        title: "Aquisição registada",
        description: `Unidade marcada como adquirida: ${unit.product.name}`,
      });

      await refreshUnitAndMovements(unit.id, unit.code);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível registar aquisição.",
        variant: "destructive",
      });
    } finally {
      setIsAcquiring(false);
    }
  };

  const handleReturn = async () =>
    runUnitAction({
      endpoint: "/api/units/return",
      pendingSetter: setIsReturning,
      successTitle: "Devolução registada",
      successDescription: (name) => `Unidade devolvida ao stock: ${name}`,
      defaultError: "Não foi possível devolver a unidade.",
    });

  const handleRepairOut = async () => {
    await runUnitAction({
      endpoint: "/api/units/repair-out",
      pendingSetter: setIsRepairOut,
      successTitle: "Enviado para reparação",
      successDescription: (name) => `Unidade marcada como em reparação: ${name}`,
      defaultError: "Não foi possível enviar para reparação.",
    });
  };

  const handleRepairIn = async () => {
    await runUnitAction({
      endpoint: "/api/units/repair-in",
      pendingSetter: setIsRepairIn,
      successTitle: "Reparação concluída",
      successDescription: (name) => `Unidade recebida de reparação e voltou ao stock: ${name}`,
      defaultError: "Não foi possível receber de reparação.",
    });
  };

  const handleScrap = () => setDestructiveAction("SCRAP");

  const handleLost = () => setDestructiveAction("LOST");

  const resetDestructiveDialog = () => {
    setDestructiveAction(null);
    setDestructiveConfirmText("");
  };

  const handleConfirmDestructive = async () => {
    if (destructiveAction === "SCRAP") {
      await runUnitAction({
        endpoint: "/api/units/scrap",
        pendingSetter: setIsScrapping,
        successTitle: "Abate registado",
        successDescription: (name) => `Unidade abatida: ${name}`,
        defaultError: "Não foi possível abater a unidade.",
      });
      resetDestructiveDialog();
      return;
    }
    if (destructiveAction === "LOST") {
      await runUnitAction({
        endpoint: "/api/units/lost",
        pendingSetter: setIsMarkingLost,
        successTitle: "Marcado como perdido",
        successDescription: (name) => `Unidade marcada como perdida: ${name}`,
        defaultError: "Não foi possível marcar como perdido.",
      });
      resetDestructiveDialog();
    }
  };

  const isAdmin = session?.role === "ADMIN";
  const isBusy = isAcquiring || isReturning || isRepairOut || isRepairIn || isScrapping || isMarkingLost;
  const latestMovement = movements[0] ?? null;
  const destructiveKeyword = destructiveAction === "SCRAP" ? "ABATER" : destructiveAction === "LOST" ? "PERDIDO" : "";
  const destructiveReady = destructiveKeyword.length > 0 && destructiveConfirmText.trim().toUpperCase() === destructiveKeyword;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Scan • Unidade</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(unit ? `/scan/substitution?oldCode=${encodeURIComponent(unit.code)}` : "/scan/substitution")}
              >
                Substituição
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/scan")}>
                Abrir câmara
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : !unit ? (
            <p className="text-sm text-muted-foreground">Unidade não encontrada.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Produto</p>
                <p className="text-base font-semibold">{unit.product.name}</p>
                <p className="text-sm text-muted-foreground">SKU: {unit.product.sku}</p>
                {unit.product.description && (
                  <p className="mt-2 text-sm">{unit.product.description}</p>
                )}
              </div>

              {unit.invoice && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-sm font-medium">Fatura</p>
                  <p className="text-sm text-muted-foreground">Fatura Nº: {unit.invoice.invoiceNumber}</p>
                  {unit.invoice.reqNumber && (
                    <p className="text-sm text-muted-foreground">REQ Nº: {unit.invoice.reqNumber}</p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Estado</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[unit.status]}>
                        {STATUS_LABEL[unit.status]}
                      </Badge>
                    </div>
                    {latestMovement ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Última ação: {latestMovement.type} por {latestMovement.performedBy?.name ?? "utilizador"} em{" "}
                        {new Date(latestMovement.createdAt).toLocaleString("pt-PT")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {unit.status === "IN_STOCK" ? (
                      <Button onClick={handleAcquire} disabled={isBusy} isLoading={isAcquiring}>
                        Aquisição
                      </Button>
                    ) : null}

                    {unit.status === "ACQUIRED" ? (
                      <Button variant="outline" onClick={handleReturn} disabled={isBusy} isLoading={isReturning}>
                        Devolver
                      </Button>
                    ) : null}

                    {(unit.status === "IN_STOCK" || unit.status === "ACQUIRED") ? (
                      <Button variant="outline" onClick={handleRepairOut} disabled={isBusy} isLoading={isRepairOut}>
                        Reparação (envio)
                      </Button>
                    ) : null}

                    {unit.status === "IN_REPAIR" ? (
                      <Button variant="outline" onClick={handleRepairIn} disabled={isBusy} isLoading={isRepairIn}>
                        Reparação (receção)
                      </Button>
                    ) : null}

                    {unit.status !== "SCRAPPED" && unit.status !== "LOST" && isAdmin ? (
                      <>
                        <Button variant="destructive" onClick={handleScrap} disabled={isBusy} isLoading={isScrapping}>
                          Abate
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleLost}
                          disabled={isBusy}
                          isLoading={isMarkingLost}
                        >
                          Perdido
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {!isAdmin && unit.status !== "SCRAPPED" && unit.status !== "LOST" ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Abate e Perdido estão disponíveis apenas para ADMIN.
                  </p>
                ) : null}
                {(unit.status === "SCRAPPED" || unit.status === "LOST") ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Unidade em estado final; não há operações disponíveis.
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium">Dados da aquisição</p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {session?.role === "ADMIN" && (
                    <div className="space-y-1">
                      <Label>Atribuir a</Label>
                      <Select
                        value={assignedToUserId || ""}
                        onValueChange={(value) => setAssignedToUserId(value === "__none__" ? "" : value)}
                        disabled={unit.status !== "IN_STOCK" || isBusy}
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
                      {unit.status !== "IN_STOCK" && unit.assignedTo && (
                        <p className="text-xs text-muted-foreground">
                          Atribuída a: {unit.assignedTo.name} ({unit.assignedTo.email})
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Motivo</Label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex: Entrega, substituição, etc."
                      disabled={
                        isBusy
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Centro de custo</Label>
                    <Input
                      value={costCenter}
                      onChange={(e) => setCostCenter(e.target.value)}
                      placeholder="Ex: TI / 2026 / Projeto X"
                      disabled={
                        isBusy
                      }
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="(Opcional)"
                      disabled={
                        isBusy
                      }
                      className="min-h-[90px]"
                    />
                  </div>
                </div>

                {unit.status !== "IN_STOCK" && (unit.acquiredReason || unit.costCenter || unit.acquiredNotes) && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {unit.acquiredReason && <p>Motivo: {unit.acquiredReason}</p>}
                    {unit.costCenter && <p>Centro de custo: {unit.costCenter}</p>}
                    {unit.acquiredNotes && <p>Notas: {unit.acquiredNotes}</p>}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Histórico</p>
                  <p className="text-xs text-muted-foreground">Últimos 10</p>
                </div>

                {movementsLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">A carregar…</p>
                ) : movements.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Sem movimentos.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {movements.map((m) => (
                      <div key={m.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span
                            className={
                              m.type === "IN"
                                ? "text-emerald-600"
                                : m.type === "OUT"
                                  ? "text-rose-600"
                                  : m.type === "RETURN"
                                    ? "text-sky-600"
                                    : m.type === "REPAIR_OUT"
                                      ? "text-amber-600"
                                      : m.type === "REPAIR_IN"
                                        ? "text-emerald-700"
                                        : "text-zinc-600"
                            }
                          >
                            {m.type} • {m.quantity}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString("pt-PT")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.invoice?.invoiceNumber ? `FT: ${m.invoice.invoiceNumber}` : ""}
                          {m.invoice?.reqNumber ? ` • REQ: ${m.invoice.reqNumber}` : ""}
                          {m.assignedTo ? ` • Atribuído: ${m.assignedTo.name}` : ""}
                          {m.reason ? ` • Motivo: ${m.reason}` : ""}
                          {m.costCenter ? ` • CC: ${m.costCenter}` : ""}
                        </div>
                        {m.notes ? <div className="text-xs">{m.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">Código: {unit.code}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={destructiveAction !== null} onOpenChange={(open) => (!open ? resetDestructiveDialog() : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {destructiveAction === "SCRAP" ? "Confirmar abate da unidade" : "Confirmar unidade como perdida"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é destrutiva. Para confirmar, escreve <span className="font-semibold">{destructiveKeyword}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={destructiveConfirmText}
            onChange={(e) => setDestructiveConfirmText(e.target.value)}
            placeholder={`Escreve ${destructiveKeyword}`}
            disabled={isBusy}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetDestructiveDialog}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!destructiveReady || isBusy}
              onClick={(e) => {
                e.preventDefault();
                if (!destructiveReady || isBusy) return;
                void handleConfirmDestructive();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
