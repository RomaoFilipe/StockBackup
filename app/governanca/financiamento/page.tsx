"use client";

import { useEffect, useState } from "react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type FinanceRow = {
  id: string;
  code: string;
  amount: number;
  currency: string;
  status: "DRAFT" | "CABIMENTO" | "COMPROMISSO" | "APPROVED" | "PAYMENT_AUTHORIZED" | "PAID" | "REJECTED";
  request: { id: string; gtmiNumber: string; status: string; title: string | null } | null;
  updatedAt: string;
};

export default function GovernancaFinanciamentoPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("EUR");
  const [budgetLine, setBudgetLine] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get<FinanceRow[]>("/governanca/finance");
      setRows(response.data);
    } catch (error: any) {
      toast({ title: "Financiamento", description: error?.response?.data?.error || "Falha ao carregar processos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createFinance = async () => {
    if (!code.trim() || amount <= 0) {
      toast({ title: "Financiamento", description: "Código e valor são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post("/governanca/finance", {
        code,
        amount,
        currency,
        budgetLine: budgetLine || null,
      });
      setCode("");
      setAmount(0);
      setCurrency("EUR");
      setBudgetLine("");
      await load();
      toast({ title: "Financiamento", description: "Processo financeiro criado." });
    } catch (error: any) {
      toast({ title: "Financiamento", description: error?.response?.data?.error || "Falha ao criar processo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader title="Financiamento" description="Cabimento, compromisso, aprovação e pagamento." />

        <SectionCard
          title="Novo Processo Financeiro"
          description="Registar processo financeiro"
          actions={<Button onClick={() => void createFinance()} disabled={saving}>{saving ? "A guardar..." : "Criar"}</Button>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rubrica</Label>
              <Input value={budgetLine} onChange={(e) => setBudgetLine(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Processos Financeiros" description={loading ? "A carregar..." : `${rows.length} registos`}>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{row.code} - {row.amount.toFixed(2)} {row.currency}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.request ? `Requisição: ${row.request.gtmiNumber}` : "Sem requisição associada"}
                    </div>
                  </div>
                  <Badge>{row.status}</Badge>
                </div>
              </div>
            ))}
            {!loading && rows.length === 0 ? <div className="text-sm text-muted-foreground">Sem processos financeiros.</div> : null}
          </div>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
