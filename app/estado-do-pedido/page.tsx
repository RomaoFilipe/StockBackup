"use client";

import React from "react";
import AuthenticatedLayout from "../components/AuthenticatedLayout";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle, XCircle, Package } from "lucide-react";

const statusMap: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", icon: <FileText className="h-5 w-5" />, variant: "secondary" },
  SUBMITTED: { label: "Submetido", icon: <Upload className="h-5 w-5" />, variant: "default" },
  APPROVED: { label: "Aprovado", icon: <CheckCircle className="h-5 w-5" />, variant: "default" },
  REJECTED: { label: "Rejeitado", icon: <XCircle className="h-5 w-5" />, variant: "destructive" },
  FULFILLED: { label: "Cumprido", icon: <Package className="h-5 w-5" />, variant: "secondary" },
};

export default function EstadoDoPedidoPage() {
  const statuses = Object.keys(statusMap);

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Estado do Pedido</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statuses.map((s) => {
            const st = statusMap[s];
            return (
              <div key={s} className="flex items-center gap-3 rounded-lg border p-4">
                <div className="text-primary">{st.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{st.label}</div>
                    <Badge variant={st.variant} className="ml-2">{s}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Descrição rápida do estado {st.label.toLowerCase()}.</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
