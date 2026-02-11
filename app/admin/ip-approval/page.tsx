"use client";

import React from "react";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";

export default function IpApprovalPage() {
  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-lg border bg-background p-6">
          <h1 className="text-2xl font-semibold mb-2">Acesso Admin por IP</h1>
          <p className="text-sm text-muted-foreground mb-4">
            O acesso ao painel de administração está limitado por endereço IP. O seu
            IP não consta na lista de IPs aprovados. Para obter acesso, contacte o
            administrador e peça aprovação do seu IP.
          </p>
          <div className="mt-4">
            <a href="/" className="text-primary underline">Voltar para a página inicial</a>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
