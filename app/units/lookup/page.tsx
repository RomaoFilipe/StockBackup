"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import EmptyState from "@/app/components/EmptyState";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";

export default function UnitLookupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = useMemo(() => searchParams?.get("code")?.trim() || "", [searchParams]);
  const [error, setError] = useState<string | null>(null);

  const resolve = async () => {
    if (!code) {
      setError("Código QR em falta.");
      return;
    }
    setError(null);
    try {
      const res = await axiosInstance.get<{ id: string }>("/units/lookup", {
        params: { code },
      });
      router.replace(`/units/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Não foi possível encontrar a unidade deste QR.");
    }
  };

  useEffect(() => {
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <AuthenticatedLayout>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="A abrir unidade"
          description={code ? `QR ${code}` : "Resolver código QR para a ficha do equipamento."}
          actions={
            <Button variant="outline" onClick={() => void resolve()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          }
        />

        {error ? (
          <EmptyState title="Unidade não encontrada" description={error} />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            A procurar a ficha desta unidade...
          </div>
        )}
      </main>
    </AuthenticatedLayout>
  );
}
