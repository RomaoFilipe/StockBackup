"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  status: "IN_STOCK" | "ACQUIRED";
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
  type: "IN" | "OUT";
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

export default function ScanUnitPage() {
  const params = useParams<{ code: string }>();
  const code = useMemo(() => (typeof params?.code === "string" ? params.code : ""), [params]);

  const { toast } = useToast();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [unit, setUnit] = useState<UnitLookup | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [costCenter, setCostCenter] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

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
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao registar aquisição");
      }

      toast({
        title: "Aquisição registada",
        description: `Unidade marcada como adquirida: ${unit.product.name}`,
      });

      // Refresh
      const lookupRes = await fetch(`/api/units/lookup?code=${encodeURIComponent(unit.code)}`);
      if (lookupRes.ok) {
        const refreshed = (await lookupRes.json()) as UnitLookup;
        setUnit(refreshed);
      }

      // Refresh movements
      const movementsRes = await fetch(`/api/stock-movements?unitId=${encodeURIComponent(unit.id)}&limit=10`);
      if (movementsRes.ok) {
        const data = (await movementsRes.json()) as { items?: StockMovement[] };
        setMovements(data.items ?? []);
      }
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan • Unidade</CardTitle>
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

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Estado</p>
                  <p className="text-sm text-muted-foreground">
                    {unit.status === "IN_STOCK" ? "Em stock" : "Adquirida"}
                  </p>
                </div>

                <Button
                  onClick={handleAcquire}
                  disabled={isAcquiring || unit.status !== "IN_STOCK"}
                  isLoading={isAcquiring}
                >
                  Registar aquisição
                </Button>
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
                        disabled={unit.status !== "IN_STOCK"}
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
                      disabled={unit.status !== "IN_STOCK"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Centro de custo</Label>
                    <Input
                      value={costCenter}
                      onChange={(e) => setCostCenter(e.target.value)}
                      placeholder="Ex: TI / 2026 / Projeto X"
                      disabled={unit.status !== "IN_STOCK"}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="(Opcional)"
                      disabled={unit.status !== "IN_STOCK"}
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
                          <span className={m.type === "IN" ? "text-emerald-600" : "text-rose-600"}>
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
    </div>
  );
}
