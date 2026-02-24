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

type Asset = {
  id: string;
  code: string;
  name: string;
  status: "REGISTERED" | "ACTIVE" | "ASSIGNED" | "MAINTENANCE" | "SCRAPPED" | "DISPOSED";
  category: string | null;
  location: string | null;
  updatedAt: string;
};

export default function GovernancaPatrimonioPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Asset[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get<Asset[]>("/governanca/assets");
      setRows(response.data);
    } catch (error: any) {
      toast({ title: "Património", description: error?.response?.data?.error || "Falha ao carregar ativos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createAsset = async () => {
    if (!code.trim() || !name.trim()) {
      toast({ title: "Património", description: "Código e nome são obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post("/governanca/assets", {
        code,
        name,
        category: category || null,
        location: location || null,
      });
      setCode("");
      setName("");
      setCategory("");
      setLocation("");
      await load();
      toast({ title: "Património", description: "Ativo criado com sucesso." });
    } catch (error: any) {
      toast({ title: "Património", description: error?.response?.data?.error || "Não foi possível criar ativo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader title="Património" description="Ativos municipais, ciclo de vida, afetação e abate." />

        <SectionCard
          title="Novo Ativo"
          description="Registar novo ativo patrimonial"
          actions={<Button onClick={() => void createAsset()} disabled={saving}>{saving ? "A guardar..." : "Criar"}</Button>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Ativos" description={loading ? "A carregar..." : `${rows.length} registos`}>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{row.code} - {row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.category || "Sem categoria"} • {row.location || "Sem localização"}
                    </div>
                  </div>
                  <Badge>{row.status}</Badge>
                </div>
              </div>
            ))}
            {!loading && rows.length === 0 ? <div className="text-sm text-muted-foreground">Sem ativos registados.</div> : null}
          </div>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
