"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";

type GoodsType = "MATERIALS_SERVICES" | "WAREHOUSE_MATERIALS" | "OTHER_PRODUCTS";

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  unit?: string | null;
  reference?: string | null;
  destination?: string | null;
  product?: { id: string; name: string; sku: string };
  createdAt: string;
  updatedAt: string;
};

type RequestDto = {
  id: string;
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  title?: string | null;
  notes?: string | null;

  gtmiYear: number;
  gtmiSeq: number;
  gtmiNumber: string;

  requestedAt: string;
  requestingService?: string | null;
  requesterName?: string | null;
  requesterEmployeeNo?: string | null;
  deliveryLocation?: string | null;
  expectedDeliveryFrom?: string | null;
  expectedDeliveryTo?: string | null;
  goodsTypes: GoodsType[];

  supplierOption1?: string | null;
  supplierOption2?: string | null;
  supplierOption3?: string | null;

  signedAt?: string | null;
  signedByName?: string | null;
  signedByTitle?: string | null;
  signedByUserId?: string | null;
  signedBy?: { id: string; name: string; email: string } | null;

  createdAt: string;
  updatedAt: string;
  items: RequestItemDto[];

  user?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string };
};

const goodsTypeLabels: Record<GoodsType, string> = {
  MATERIALS_SERVICES: "Material de consumo / Serviços",
  WAREHOUSE_MATERIALS: "Material de armazém",
  OTHER_PRODUCTS: "Outros produtos",
};

function safeDateTimeLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function safeDateLabel(iso?: string | null) {
  if (!iso) return "";
  // Avoid timezone shift: keep YYYY-MM-DD.
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export default function PrintRequestPage() {
  const routeParams = useParams<{ id: string }>();
  const requestId = routeParams?.id;
  const searchParams = useSearchParams();
  const asUserId = useMemo(() => searchParams?.get("asUserId") ?? undefined, [searchParams]);

  const [request, setRequest] = useState<RequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!requestId) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/requests/${requestId}`, {
          params: asUserId ? { asUserId } : undefined,
        });
        if (cancelled) return;
        setRequest(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [requestId, asUserId]);

  const handlePrint = async () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  const goodsTypesText = request?.goodsTypes?.length
    ? request.goodsTypes.map((g) => goodsTypeLabels[g]).join(" • ")
    : "";

  const signedText = request?.signedAt
    ? `${request.signedByName || request.signedBy?.name || ""}${request.signedByTitle ? ` • ${request.signedByTitle}` : ""}\n${safeDateTimeLabel(request.signedAt)}`
    : "";

  return (
    <div className="print-page">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        .print-page {
          padding: 16px;
        }

        .print-toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .sheet {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          padding: 14px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .field {
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 8px;
          padding: 8px;
          min-height: 44px;
        }

        .label {
          font-size: 11px;
          color: rgba(0, 0, 0, 0.65);
          margin-bottom: 2px;
        }

        .value {
          font-size: 12px;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.88);
          word-break: break-word;
          white-space: pre-wrap;
        }

        .title {
          font-size: 16px;
          font-weight: 800;
        }

        .subtitle {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.65);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          border: 1px solid rgba(0, 0, 0, 0.18);
          padding: 6px;
          vertical-align: top;
          font-size: 11px;
        }

        th {
          background: rgba(0, 0, 0, 0.04);
          font-weight: 700;
          text-align: left;
        }

        .muted {
          color: rgba(0, 0, 0, 0.6);
          font-weight: 500;
        }

        .sign {
          height: 54px;
        }

        @media print {
          .print-page {
            padding: 0;
          }

          .print-toolbar {
            display: none;
          }

          .sheet {
            border: none;
            border-radius: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div>
          <div className="title">Imprimir • Pedido de requisição</div>
          <div className="subtitle">Formato A4 (use imprimir do navegador)</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => history.back()}>
            Voltar
          </Button>
          <Button onClick={handlePrint} disabled={loading || !request || printing}>
            {printing ? "A abrir impressão..." : "Imprimir"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !request ? (
        <p className="text-sm text-muted-foreground">Requisição não encontrada.</p>
      ) : (
        <div className="sheet">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div>
              <div className="title">Pedido de material de consumo / serviço</div>
              <div className="subtitle">Nº: {request.gtmiNumber}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="subtitle">Data/Hora do pedido</div>
              <div className="value">{safeDateTimeLabel(request.requestedAt)}</div>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <div className="label">Serviço requisitante</div>
              <div className="value">{request.requestingService || ""}</div>
            </div>
            <div className="field">
              <div className="label">Funcionário / Órgão</div>
              <div className="value">
                {request.requesterName || ""}
                {request.requesterEmployeeNo ? ` (${request.requesterEmployeeNo})` : ""}
              </div>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <div className="label">Local de entrega</div>
              <div className="value">{request.deliveryLocation || ""}</div>
            </div>
            <div className="field">
              <div className="label">Data prevista (de → até)</div>
              <div className="value">
                {safeDateLabel(request.expectedDeliveryFrom) || "—"} → {safeDateLabel(request.expectedDeliveryTo) || "—"}
              </div>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <div className="label">Tipo de bem/serviço</div>
            <div className="value">{goodsTypesText}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
              [ {request.goodsTypes.includes("MATERIALS_SERVICES") ? "X" : " "} ] {goodsTypeLabels.MATERIALS_SERVICES} &nbsp;&nbsp;
              [ {request.goodsTypes.includes("WAREHOUSE_MATERIALS") ? "X" : " "} ] {goodsTypeLabels.WAREHOUSE_MATERIALS} &nbsp;&nbsp;
              [ {request.goodsTypes.includes("OTHER_PRODUCTS") ? "X" : " "} ] {goodsTypeLabels.OTHER_PRODUCTS}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>Nº</th>
                  <th>Designação</th>
                  <th style={{ width: 70 }}>Unid.</th>
                  <th style={{ width: 60 }}>Qtd</th>
                  <th style={{ width: 92 }}>Referência</th>
                  <th style={{ width: 92 }}>Destino</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{it.product?.name || it.productId}</div>
                      {it.product?.sku ? <div className="muted">SKU: {it.product.sku}</div> : null}
                    </td>
                    <td>{it.unit || ""}</td>
                    <td>{it.quantity}</td>
                    <td>{it.reference || ""}</td>
                    <td>{it.destination || ""}</td>
                    <td>{it.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <div className="label">Fornecedor (opção 1)</div>
              <div className="value">{request.supplierOption1 || ""}</div>
            </div>
            <div className="field">
              <div className="label">Fornecedor (opção 2)</div>
              <div className="value">{request.supplierOption2 || ""}</div>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <div className="label">Fornecedor (opção 3)</div>
              <div className="value">{request.supplierOption3 || ""}</div>
            </div>
            <div className="field">
              <div className="label">Notas gerais</div>
              <div className="value">{request.notes || ""}</div>
            </div>
          </div>

          <div className="row">
            <div className="field sign">
              <div className="label">Assinatura (Requisitante)</div>
              <div className="value">{request.requesterName || ""}</div>
            </div>
            <div className="field sign">
              <div className="label">Assinatura (Aprovação)</div>
              <div className="value">{signedText}</div>
            </div>
          </div>

          <div className="subtitle" style={{ marginTop: 10 }}>
            Criado por: {request.createdBy?.name || ""}{request.createdBy?.email ? ` (${request.createdBy.email})` : ""}
            {request.user && request.user.id !== request.createdBy?.id ? ` • Para: ${request.user.name}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
