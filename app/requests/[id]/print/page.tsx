"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

type GoodsType = "MATERIALS_SERVICES" | "WAREHOUSE_MATERIALS" | "OTHER_PRODUCTS";

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  role?: "NORMAL" | "OLD" | "NEW";
  notes?: string | null;
  unit?: string | null;
  reference?: string | null;
  destination?: string | null;
  product?: { id: string; name: string; sku: string; supplier?: { id: string; name: string } | null };
  createdAt: string;
  updatedAt: string;
};

type RequestInvoiceDto = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  productId: string;
  reqNumber?: string | null;
  reqDate?: string | null;
  requestId?: string | null;
};

type RequestDto = {
  id: string;
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  requestType?: "STANDARD" | "RETURN";
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
  signedSignatureDataUrl?: string | null;
  signedByUserId?: string | null;
  signedBy?: { id: string; name: string; email: string } | null;

  signedVoidedAt?: string | null;
  signedVoidedReason?: string | null;
  signedVoidedBy?: { id: string; name: string; email: string } | null;

  pickupSignedAt?: string | null;
  pickupSignedByName?: string | null;
  pickupSignedByTitle?: string | null;
  pickupSignatureDataUrl?: string | null;

  pickupVoidedAt?: string | null;
  pickupVoidedReason?: string | null;
  pickupVoidedBy?: { id: string; name: string; email: string } | null;

  createdAt: string;
  updatedAt: string;
  items: RequestItemDto[];

  invoices?: RequestInvoiceDto[];
  latestInvoices?: RequestInvoiceDto[];

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
  return d.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function safeDateLabel(iso?: string | null) {
  if (!iso) return "";
  // Avoid timezone shift: keep YYYY-MM-DD.
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function formatDatePt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT");
}

export default function PrintRequestPage() {
  const routeParams = useParams<{ id: string }>();
  const requestId = routeParams?.id;
  const searchParams = useSearchParams();
  const queryAsUserId = useMemo(() => searchParams?.get("asUserId") ?? undefined, [searchParams]);
  const [asUserId] = useState<string | undefined>(() => queryAsUserId);
  const [logoOk, setLogoOk] = useState(true);

  const [request, setRequest] = useState<RequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [origin, setOrigin] = useState("");
  const [verifyQrDataUrl, setVerifyQrDataUrl] = useState<string>("");
  const [checksum, setChecksum] = useState<string>("");
  const [itemQrByCode, setItemQrByCode] = useState<Record<string, string>>({});

  useEffect(() => {
    const envBase = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    setOrigin(envBase || window.location.origin);
  }, []);

  useEffect(() => {
    // Prevent `asUserId=...` from showing in browser print headers/footers.
    if (!queryAsUserId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("asUserId");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [queryAsUserId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!request?.items?.length) {
        if (!cancelled) setItemQrByCode({});
        return;
      }

      const codes = Array.from(
        new Set(
          request.items
            .map((it) => (it.destination || "").trim())
            .filter((v) => Boolean(v))
        )
      );

      if (codes.length === 0) {
        if (!cancelled) setItemQrByCode({});
        return;
      }

      const entries = await Promise.all(
        codes.map(async (code) => {
          try {
            const dataUrl = await QRCode.toDataURL(code, {
              width: 80,
              margin: 1,
              color: { dark: "#000000", light: "#FFFFFF" },
            });
            return [code, dataUrl] as const;
          } catch {
            return [code, ""] as const;
          }
        })
      );

      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [code, dataUrl] of entries) {
        if (dataUrl) next[code] = dataUrl;
      }
      setItemQrByCode(next);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [request?.items]);

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

  const invoiceByProductId = useMemo(() => {
    const map: Record<string, RequestInvoiceDto> = {};
    const invoices = request?.latestInvoices?.length ? request.latestInvoices : request?.invoices || [];
    for (const inv of invoices) {
      if (!inv?.productId) continue;
      // API orders by issuedAt desc; first wins.
      if (!map[inv.productId]) map[inv.productId] = inv;
    }
    return map;
  }, [request?.invoices, request?.latestInvoices]);

  const signedText = request?.signedAt
    ? `${request.signedByName || request.signedBy?.name || ""}${request.signedByTitle ? ` • ${request.signedByTitle}` : ""}`
    : "";

  const verifyUrl = useMemo(() => {
    if (!origin || !requestId) return "";
    return `${origin}/requests/${requestId}`;
  }, [origin, requestId]);

  const printLogoUrl = useMemo(() => {
    const envLogo = String(process.env.NEXT_PUBLIC_PRINT_LOGO_URL ?? "").trim();
    return envLogo || "/logo.png";
  }, []);

  const renderItemQr = (destination?: string | null) => {
    const code = destination?.trim();
    if (!code) return null;
    const qr = itemQrByCode[code];
    const shortCode = code.length > 14 ? `${code.slice(0, 8)}...${code.slice(-4)}` : code;
    return (
      <div className="item-qr">
        {qr ? (
          <Image
            src={qr}
            alt={`QR ${code}`}
            width={50}
            height={50}
            unoptimized
            style={{ width: 50, height: 50, imageRendering: "pixelated" }}
          />
        ) : null}
        <span title={code}>{shortCode}</span>
      </div>
    );
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!verifyUrl) return;
      try {
        const url = await QRCode.toDataURL(verifyUrl, {
          width: 140,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        if (!cancelled) setVerifyQrDataUrl(url);
      } catch {
        if (!cancelled) setVerifyQrDataUrl("");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!request) return;
      if (!crypto?.subtle) return;
      const payload = `${request.id}|${request.gtmiNumber}|${request.requestedAt}|${request.updatedAt}`;
      const bytes = new TextEncoder().encode(payload);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const short = Array.from(new Uint8Array(hash))
        .slice(0, 5)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      if (!cancelled) setChecksum(short);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [request]);

  return (
    <div className="print-page">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 9mm;
        }

        body {
          background: #edf2f7;
        }

        .print-page {
          min-height: 100vh;
          padding: 18px;
          color: #0b1220;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .print-toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          max-width: 210mm;
          margin: 0 auto 14px;
          border: 1px solid rgba(37, 99, 235, 0.12);
          border-radius: 16px;
          background: linear-gradient(135deg, #eef6ff 0%, #ffffff 58%, #f8fafc 100%);
          padding: 12px 14px;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
        }

        .sheet {
          background: white;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          border: 2px solid rgba(15, 23, 42, 0.28);
          border-radius: 14px;
          padding: 10mm;
          box-shadow: 0 18px 55px rgba(15, 23, 42, 0.14);
        }

        .document-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 128px;
          gap: 14px;
          align-items: start;
          margin-bottom: 13px;
          border: 2px solid #172033;
          border-radius: 10px;
          background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
          padding: 10px 10px 9px;
          box-shadow: inset 0 -4px 0 #dbeafe;
        }

        .brand-block {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .doc-kicker {
          color: #174ea6;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .doc-number {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          border: 1.5px solid #64748b;
          border-radius: 999px;
          background: #eaf2ff;
          padding: 4px 10px;
          font-size: 10.5px;
          font-weight: 850;
          color: #0f172a;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 13px 0 7px;
          color: #0f172a;
          font-size: 11.5px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .section-title::before {
          content: "";
          width: 6px;
          height: 17px;
          border-radius: 2px;
          background: #174ea6;
          box-shadow: 6px 0 0 #93c5fd;
        }

        .section-title::after {
          content: "";
          height: 2px;
          flex: 1;
          background: linear-gradient(90deg, #334155 0%, #cbd5e1 100%);
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }

        .field {
          border: 1.6px solid #94a3b8;
          border-radius: 6px;
          padding: 8px 9px;
          min-height: 46px;
          background: #fbfdff;
          break-inside: avoid;
        }

        .label {
          font-size: 9.5px;
          color: #334155;
          font-weight: 850;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
        }

        .value {
          font-size: 12px;
          font-weight: 800;
          color: #020617;
          word-break: break-word;
          white-space: pre-wrap;
          line-height: 1.35;
        }

        .title {
          color: #020617;
          font-size: 21px;
          font-weight: 900;
          line-height: 1.12;
        }

        .subtitle {
          font-size: 10.5px;
          color: #334155;
          font-weight: 700;
          line-height: 1.35;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          break-inside: auto;
          page-break-inside: auto;
        }

        th,
        td {
          border: 1.35px solid #64748b;
          padding: 6px 7px;
          vertical-align: top;
          font-size: 10.8px;
          line-height: 1.38;
        }

        th {
          background: #dbeafe;
          color: #07111f;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-align: left;
          text-transform: uppercase;
        }

        tbody tr:nth-child(even) td {
          background: #f8fbff;
        }

        tbody td:first-child,
        tbody td:nth-child(4) {
          color: #020617;
          font-weight: 850;
          text-align: center;
        }

        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .muted {
          color: #334155;
          font-weight: 650;
        }

        .signature-img {
          display: block;
          width: 92%;
          height: 58px;
          object-fit: contain;
          margin: 0 auto -3px;
          mix-blend-mode: multiply;
        }

        .print-logo {
          display: block;
          height: 62px;
          width: auto;
          max-width: 290px;
          object-fit: contain;
        }

        .qr-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          text-align: right;
        }

        .qr-img {
          width: 82px;
          height: 82px;
          border: 1.6px solid #172033;
          border-radius: 6px;
          padding: 4px;
          background: #fff;
        }

        .checksum {
          font-size: 8.5px;
          color: #334155;
          font-weight: 700;
        }

        .item-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          color: #475569;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 7px;
          line-height: 1.2;
          max-width: 58px;
        }

        .item-qr span {
          display: block;
          max-width: 58px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .summary-band {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 7px;
          margin-bottom: 8px;
        }

        .signature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
          break-inside: avoid;
        }

        .signature-card {
          display: flex;
          min-height: 128px;
          flex-direction: column;
          justify-content: space-between;
          align-items: stretch;
          border: 1.8px solid #334155;
          border-radius: 8px;
          background: linear-gradient(180deg, #ffffff 0%, #eef6ff 100%);
          padding: 9px 11px 10px;
          break-inside: avoid;
        }

        .signature-slot {
          display: flex;
          min-height: 70px;
          align-items: center;
          justify-content: center;
          padding-top: 2px;
        }

        .signature-line {
          width: 88%;
          margin: 0 auto;
          border-top: 2px solid #111827;
          padding-top: 5px;
          color: #0f172a;
          font-size: 10px;
          font-weight: 850;
          text-align: center;
        }

        .signature-meta {
          color: #334155;
          font-size: 8.5px;
          font-weight: 650;
          line-height: 1.25;
          text-align: center;
        }

        .footer-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          border-top: 1.5px solid #64748b;
          padding-top: 8px;
          color: #334155;
          font-size: 9.5px;
          font-weight: 650;
        }

        .warn {
          border: 1px solid #fecaca;
          background: #fff1f2;
          border-radius: 8px;
          padding: 7px 9px;
          margin-bottom: 9px;
          font-size: 10px;
          color: #991b1b;
        }

        .screen-only-hint {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
        }

        @media print {
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          html,
          body {
            width: 210mm;
            background: white !important;
          }

          .print-page {
            padding: 0;
            min-height: auto;
          }

          .print-toolbar {
            display: none;
          }

          .sheet {
            border: none;
            border-radius: 0;
            padding: 0;
            width: auto;
            min-height: auto;
            box-shadow: none;
          }

          a[href]::after {
            content: "";
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div>
          <div className="title">Pedido de material</div>
          <div className="screen-only-hint">Pré-visualização A4. Use “Imprimir / Guardar PDF” para exportar.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => history.back()}>
            Voltar
          </Button>
          <Button onClick={handlePrint} disabled={loading || !request || printing}>
            {printing ? "A abrir impressão..." : "Imprimir / Guardar PDF"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !request ? (
        <p className="text-sm text-muted-foreground">Requisição não encontrada.</p>
      ) : (
        <div className="sheet">
          {!request.pickupSignedAt ||
          !request.signedAt ||
          !request.pickupSignatureDataUrl ||
          !request.signedSignatureDataUrl ||
          request.pickupVoidedAt ||
          request.signedVoidedAt ? (
            <div className="warn">
              Atenção: documento sem assinaturas completas.
              {!request.pickupSignedAt ? " • Falta assinatura (Responsável do pedido)." : ""}
              {request.pickupSignedAt && !request.pickupSignatureDataUrl ? " • Falta desenho da assinatura (Responsável)." : ""}
              {!request.signedAt ? " • Falta assinatura (Técnico GTMI)." : ""}
              {request.signedAt && !request.signedSignatureDataUrl ? " • Falta rubrica desenhada (Técnico GTMI)." : ""}
              {request.pickupVoidedAt ? " • Assinatura do responsável foi anulada." : ""}
              {request.signedVoidedAt ? " • Assinatura do técnico foi anulada." : ""}
            </div>
          ) : null}

          <div className="document-header">
            <div className="brand-block">
              {logoOk ? (
                <Image
                  src={printLogoUrl}
                  alt="Logo do serviço"
                  className="print-logo"
                  width={360}
                  height={68}
                  unoptimized
                  onError={() => setLogoOk(false)}
                />
              ) : null}
              <div>
                <div className="doc-kicker">Gabinete Técnico Municipal de Informática</div>
                <div className="title">Pedido de material de consumo / serviço</div>
                <div className="doc-number">Nº {request.gtmiNumber}</div>
              </div>
            </div>
            <div className="qr-box">
              {verifyQrDataUrl ? (
                <Image
                  src={verifyQrDataUrl}
                  alt="QR de verificação"
                  className="qr-img"
                  width={92}
                  height={92}
                  unoptimized
                />
              ) : null}
              {checksum ? <div className="checksum">Código: {checksum}</div> : null}
              <div>
                <div className="subtitle">Data/Hora do pedido</div>
                <div className="value">{safeDateTimeLabel(request.requestedAt)}</div>
              </div>
            </div>
          </div>

          <div className="section-title">Identificação do pedido</div>

          <div className="row" style={{ marginBottom: 7 }}>
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

          <div className="row" style={{ marginBottom: 7 }}>
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

          <div className="field" style={{ marginBottom: 7 }}>
            <div className="label">Fundamento do Pedido</div>
            <div className="value" style={{ whiteSpace: "pre-wrap" }}>{request.notes?.trim() ? request.notes : "—"}</div>
          </div>

          <div className="summary-band">
            <div className="field">
              <div className="label">Modalidade</div>
              <div className="value">{request.requestType === "RETURN" ? "Devolução / Substituição" : "Normal"}</div>
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <div className="label">Tipo de bem/serviço</div>
              <div className="value">{goodsTypesText}</div>
              <div className="muted" style={{ fontSize: 9, marginTop: 4 }}>
                [ {request.goodsTypes.includes("MATERIALS_SERVICES") ? "X" : " "} ] {goodsTypeLabels.MATERIALS_SERVICES} &nbsp;&nbsp;
                [ {request.goodsTypes.includes("WAREHOUSE_MATERIALS") ? "X" : " "} ] {goodsTypeLabels.WAREHOUSE_MATERIALS} &nbsp;&nbsp;
                [ {request.goodsTypes.includes("OTHER_PRODUCTS") ? "X" : " "} ] {goodsTypeLabels.OTHER_PRODUCTS}
              </div>
            </div>
          </div>

          <div className="section-title">Material solicitado</div>

          <div style={{ marginBottom: 10 }}>
            {request.requestType === "RETURN" ? (
              <>
                <div className="subtitle" style={{ marginBottom: 6 }}>Itens antigos (a devolver)</div>
                <table style={{ marginBottom: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>Nº</th>
                      <th>Designação</th>
                      <th style={{ width: 70 }}>Unid.</th>
                      <th style={{ width: 60 }}>Qtd</th>
                      <th style={{ width: 92 }}>Referência</th>
                      <th style={{ width: 70 }}>QR</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items.filter((it) => it.role === "OLD").map((it, idx) => (
                      <tr key={it.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{it.product?.name || it.productId}</div>
                          {it.product?.sku ? <div className="muted">SKU: {it.product.sku}</div> : null}
                        </td>
                        <td>{it.unit || ""}</td>
                        <td>{it.quantity}</td>
                        <td>{it.reference || ""}</td>
                        <td>{renderItemQr(it.destination)}</td>
                        <td>{it.notes || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="subtitle" style={{ marginBottom: 6 }}>Itens novos (a substituir)</div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>Nº</th>
                      <th>Designação</th>
                      <th style={{ width: 70 }}>Unid.</th>
                      <th style={{ width: 60 }}>Qtd</th>
                      <th style={{ width: 92 }}>Referência</th>
                      <th style={{ width: 70 }}>QR</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items.filter((it) => it.role === "NEW").map((it, idx) => (
                      <tr key={it.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{it.product?.name || it.productId}</div>
                          {it.product?.sku ? <div className="muted">SKU: {it.product.sku}</div> : null}
                        </td>
                        <td>{it.unit || ""}</td>
                        <td>{it.quantity}</td>
                        <td>{it.reference || ""}</td>
                        <td>{renderItemQr(it.destination)}</td>
                        <td>{it.notes || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>Nº</th>
                  <th>Designação</th>
                  <th style={{ width: 70 }}>Unid.</th>
                  <th style={{ width: 60 }}>Qtd</th>
                  <th style={{ width: 92 }}>Referência</th>
                  <th style={{ width: 70 }}>QR</th>
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
                    <td>{renderItemQr(it.destination)}</td>
                    <td>{it.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="section-title">Fornecedores / Faturas</div>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 160 }}>Empresa</th>
                  <th style={{ width: 92 }}>Fatura Nº</th>
                  <th style={{ width: 80 }}>Data</th>
                  <th style={{ width: 92 }}>REQ</th>
                  <th style={{ width: 80 }}>Data REQ</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((it, idx) => {
                  const supplierName = it.product?.supplier?.name || "";
                  const meta = it.productId ? invoiceByProductId[it.productId] : undefined;
                  const reqNumber = meta?.reqNumber || request.gtmiNumber;
                  const reqDate = meta?.reqDate || request.requestedAt;

                  return (
                    <tr key={`sup-${it.id || idx}`}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{it.product?.name || it.productId}</div>
                        {it.product?.sku ? <div className="muted">SKU: {it.product.sku}</div> : null}
                      </td>
                      <td>{supplierName || "—"}</td>
                      <td>{meta?.invoiceNumber || "—"}</td>
                      <td>{meta?.issuedAt ? formatDatePt(meta.issuedAt) : "—"}</td>
                      <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 11 }}>
                        {reqNumber || "—"}
                      </td>
                      <td>{reqDate ? formatDatePt(reqDate) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="section-title">Assinaturas</div>

          <div className="signature-grid">
            <div className="signature-card">
              <div className="label" style={{ textAlign: "center" }}>
                Assinatura do Responsável Pedido
              </div>
              <div className="signature-slot">
                {request.pickupVoidedAt && !request.pickupSignatureDataUrl ? (
                  <div className="value" style={{ textAlign: "center" }}>
                    {`ANULADA${request.pickupVoidedReason ? ` • ${request.pickupVoidedReason}` : ""}`}
                  </div>
                ) : null}
                {request.pickupSignatureDataUrl ? (
                  <Image
                    src={request.pickupSignatureDataUrl}
                    alt="Assinatura do responsável do pedido"
                    className="signature-img"
                    width={420}
                    height={120}
                    unoptimized
                  />
                ) : null}
              </div>
              <div className="signature-line">
                {request.pickupSignedByName || request.requesterName || "Responsável do pedido"}
              </div>
              {request.pickupSignedByTitle ? (
                <div className="signature-meta">{request.pickupSignedByTitle}</div>
              ) : null}
            </div>

            <div className="signature-card">
              <div className="label" style={{ textAlign: "center" }}>
                Assinatura (Técnico GTMI)
              </div>
              <div className="signature-slot">
                {request.signedAt && request.signedSignatureDataUrl ? (
                  <Image
                    src={request.signedSignatureDataUrl}
                    alt="Rubrica do técnico GTMI"
                    className="signature-img"
                    width={420}
                    height={120}
                    unoptimized
                  />
                ) : request.signedVoidedAt
                    ? (
                        <div className="value" style={{ textAlign: "center" }}>
                          {`ANULADA${request.signedVoidedReason ? ` • ${request.signedVoidedReason}` : ""}`}
                        </div>
                      )
                    : null}
              </div>
              <div className="signature-line">
                {request.signedAt ? request.signedByName || request.signedBy?.name || "Técnico GTMI" : "Técnico GTMI"}
              </div>
              <div className="signature-meta">
                {request.signedAt ? request.signedByTitle || signedText || "Assinatura digital validada" : "Assinatura digital"}
              </div>
            </div>
          </div>

          <div className="footer-line">
            <span>
              Criado por: {request.createdBy?.name || ""}{request.createdBy?.email ? ` (${request.createdBy.email})` : ""}
              {request.user && request.user.id !== request.createdBy?.id ? ` • Para: ${request.user.name}` : ""}
            </span>
            <span>{checksum ? `Validação: ${checksum}` : request.gtmiNumber}</span>
          </div>
        </div>
      )}
    </div>
  );
}
