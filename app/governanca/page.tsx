"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";

export default function GovernancaPage() {
  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Governança Municipal"
          description="Área base para fluxos de património, financiamento, aprovações e requerimentos internos/externos."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Património"
            description="Gestão de ativos municipais, ciclo de vida, afetação e abate."
          >
            <p className="text-sm text-muted-foreground">
              Próximo passo: catálogo patrimonial com classes, localização e histórico de movimentações administrativas.
            </p>
          </SectionCard>

          <SectionCard
            title="Financiamento"
            description="Cabimento, compromisso e acompanhamento do processo financeiro."
          >
            <p className="text-sm text-muted-foreground">
              Próximo passo: trilha orçamental por pedido e validações por perfil financeiro.
            </p>
          </SectionCard>

          <SectionCard
            title="Aprovações de Presidência"
            description="Fluxo de despacho e aprovação de alto nível."
          >
            <p className="text-sm text-muted-foreground">
              Já suportado na base RBAC com permissão dedicada para aprovação de presidência.
            </p>
          </SectionCard>

          <SectionCard
            title="Requerimentos Internos/Externos"
            description="Canal unificado para pedidos de munícipes e serviços internos."
          >
            <p className="text-sm text-muted-foreground">
              Já existe suporte inicial para requerimentos externos e controlo de acesso por permissão.
            </p>
          </SectionCard>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
