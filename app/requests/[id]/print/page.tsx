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
  return d.toLocaleString();
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
      if (!origin || !request?.items?.length) {
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
            const url = `${origin}/scan/${encodeURIComponent(code)}`;
            const dataUrl = await QRCode.toDataURL(url, {
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
  }, [origin, request?.items]);

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
          height: 86px;
        }

        .signature-img {
          display: block;
          width: 100%;
          height: 44px;
          object-fit: contain;
          margin-top: 6px;
        }

        .print-logo {
          display: block;
          height: 68px;
          width: auto;
          max-width: 360px;
          object-fit: contain;
        }

        .qr-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .qr-img {
          width: 92px;
          height: 92px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          border-radius: 8px;
        }

        .checksum {
          font-size: 10px;
          color: rgba(0, 0, 0, 0.65);
        }

        .warn {
          border: 1px solid rgba(185, 28, 28, 0.25);
          background: rgba(185, 28, 28, 0.06);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 10px;
          font-size: 11px;
          color: rgba(185, 28, 28, 0.95);
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
          {!request.pickupSignedAt || !request.signedAt || request.pickupVoidedAt || request.signedVoidedAt ? (
            <div className="warn">
              Atenção: documento sem assinaturas completas.
              {!request.pickupSignedAt ? " • Falta assinatura (Responsável do pedido)." : ""}
              {!request.signedAt ? " • Falta assinatura (Técnico GTMI)." : ""}
              {request.pickupVoidedAt ? " • Assinatura do responsável foi anulada." : ""}
              {request.signedVoidedAt ? " • Assinatura do técnico foi anulada." : ""}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                <div className="title">Pedido de material de consumo / serviço</div>
                <div className="subtitle">Nº: {request.gtmiNumber}</div>
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
              <div style={{ textAlign: "right" }}>
                <div className="subtitle">Data/Hora do pedido</div>
                <div className="value">{safeDateTimeLabel(request.requestedAt)}</div>
              </div>
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
            <div className="label">Fundamento do Pedido</div>
            <div className="value" style={{ whiteSpace: "pre-wrap" }}>{request.notes?.trim() ? request.notes : "—"}</div>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <div className="label">Modalidade</div>
            <div className="value">{request.requestType === "RETURN" ? "Devolução / Substituição" : "Normal"}</div>
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
                        <td>{it.destination || ""}</td>
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
                        <td>
                          {it.destination?.trim() ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {itemQrByCode[it.destination.trim()] ? (
                                <Image
                                  src={itemQrByCode[it.destination.trim()]}
                                  alt={`QR ${it.destination.trim()}`}
                                  width={44}
                                  height={44}
                                  unoptimized
                                  style={{ width: 44, height: 44, imageRendering: "pixelated" }}
                                />
                              ) : null}
                            </div>
                          ) : (
                            ""
                          )}
                        </td>
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
                    <td>
                      {it.destination?.trim() ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {itemQrByCode[it.destination.trim()] ? (
                            <Image
                              src={itemQrByCode[it.destination.trim()]}
                              alt={`QR ${it.destination.trim()}`}
                              width={44}
                              height={44}
                              unoptimized
                              style={{ width: 44, height: 44, imageRendering: "pixelated" }}
                            />
                          ) : null}
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>{it.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="subtitle" style={{ marginBottom: 6 }}>
              Fornecedores / Faturas
            </div>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1fr",
              gap: 10,
            }}
          >
            <div />
            <div className="field sign" style={{ textAlign: "center" }}>
              <div className="label" style={{ textAlign: "center" }}>
                Assinatura do Responsável Pedido
              </div>
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

            <div className="field sign" style={{ textAlign: "right", padding: 6 }}>
              <div className="label" style={{ fontSize: 10, textAlign: "right" }}>
                Assinatura (Técnico GTMI)
              </div>
              <div className="value" style={{ fontSize: 10, textAlign: "right", minHeight: 44 }}>
                {request.signedAt
                  ? signedText
                  : request.signedVoidedAt
                    ? `ANULADA${request.signedVoidedReason ? ` • ${request.signedVoidedReason}` : ""}`
                    : ""}
              </div>
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
