"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { buildUnitLookupUrl } from "@/utils/unitQrLink";

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  reference?: string | null;
  destination?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    description?: string | null;
    supplier?: { id: string; name: string } | null;
  };
};

type RequestInvoiceDto = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  productId: string;
  reqNumber?: string | null;
  reqDate?: string | null;
};

type UnitLookupDto = {
  id: string;
  code: string;
  serialNumber?: string | null;
  partNumber?: string | null;
  assetTag?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    description?: string | null;
    supplier?: { id: string; name: string } | null;
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    reqNumber?: string | null;
    reqDate?: string | null;
    issuedAt: string;
  } | null;
};

type RequestDto = {
  id: string;
  gtmiNumber: string;
  requestedAt: string;
  items: RequestItemDto[];
  invoices?: RequestInvoiceDto[];
  latestInvoices?: RequestInvoiceDto[];
};

function formatDateShortPt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function normalizeComparable(value?: string | null) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-PT")
    .replace(/\s+/g, " ");
}

function joinUniqueParts(parts: Array<string | null | undefined>, separator = " | ") {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of parts) {
    const value = String(part || "").trim();
    if (!value) continue;
    const comparable = normalizeComparable(value);
    if (seen.has(comparable)) continue;
    seen.add(comparable);
    values.push(value);
  }
  return values.join(separator);
}

function cleanDocNumber(value?: string | null, prefix?: "FT" | "REQ") {
  const cleaned = String(value || "")
    .trim()
    .replace(/^(fatura|factura|fat\.?|ft\.?|req\.?|requisi[cç][aã]o)\s*(n[ºo.]*)?\s*[:.-]?\s*/i, "")
    .trim();
  return cleaned ? `${prefix ? `${prefix} ` : ""}${cleaned}` : "";
}

export default function RequestLabelsPrintPage() {
  const routeParams = useParams<{ id: string }>();
  const requestId = routeParams?.id;
  const searchParams = useSearchParams();
  const asUserId = useMemo(() => searchParams?.get("asUserId") ?? undefined, [searchParams]);

  const [request, setRequest] = useState<RequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [qrByCode, setQrByCode] = useState<Record<string, string>>({});
  const [unitByCode, setUnitByCode] = useState<Record<string, UnitLookupDto>>({});
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const envBase = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    setOrigin(envBase || window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!requestId) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/requests/${requestId}`, {
          params: asUserId ? { asUserId } : undefined,
        });
        if (!cancelled) setRequest(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [requestId, asUserId]);

  const labelItems = useMemo(
    () => (request?.items || []).filter((item) => Boolean(item.destination?.trim())),
    [request?.items]
  );

  const invoiceByProductId = useMemo(() => {
    const map: Record<string, RequestInvoiceDto> = {};
    const invoices = request?.latestInvoices?.length ? request.latestInvoices : request?.invoices || [];
    for (const invoice of invoices) {
      if (!invoice.productId || map[invoice.productId]) continue;
      map[invoice.productId] = invoice;
    }
    return map;
  }, [request?.invoices, request?.latestInvoices]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const codes = Array.from(new Set(labelItems.map((item) => item.destination?.trim()).filter(Boolean) as string[]));
      if (!codes.length) {
        setQrByCode({});
        return;
      }

      const entries = await Promise.all(
        codes.map(async (code) => {
          const dataUrl = await QRCode.toDataURL(buildUnitLookupUrl({ origin, code }), {
            width: 190,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          return [code, dataUrl] as const;
        })
      );

      if (cancelled) return;
      setQrByCode(Object.fromEntries(entries));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [labelItems, origin]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const codes = Array.from(new Set(labelItems.map((item) => item.destination?.trim()).filter(Boolean) as string[]));
      if (!codes.length) {
        setUnitByCode({});
        return;
      }

      const entries = await Promise.all(
        codes.map(async (code) => {
          try {
            const res = await axiosInstance.get<UnitLookupDto>("/units/lookup", {
              params: { code, ...(asUserId ? { asUserId } : {}) },
            });
            return [code, res.data] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setUnitByCode(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, UnitLookupDto]>));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [labelItems, asUserId]);

  const readyToPrint = !loading && labelItems.length > 0 && labelItems.every((item) => qrByCode[item.destination?.trim() || ""]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  return (
    <div className="label-print-page">
      <style jsx global>{`
        @page {
          size: 96mm 24mm;
          margin: 0;
        }

        body {
          background: #eef3f8;
        }

        .label-print-page {
          min-height: 100vh;
          padding: 18px;
          color: #111827;
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
          max-width: 100mm;
          margin: 0 auto 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #fff;
          padding: 10px 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }

        .print-title {
          font-size: 15px;
          font-weight: 800;
        }

        .print-subtitle {
          color: #64748b;
          font-size: 12px;
        }

        .labels-sheet {
          display: grid;
          gap: 5mm;
          max-width: 100mm;
          margin: 0 auto;
          justify-items: start;
        }

        .label-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 19mm;
          align-items: center;
          gap: 2mm;
          width: 96mm;
          height: 24mm;
          overflow: hidden;
          border: 1.1px solid #0b1220;
          border-radius: 0;
          background: #ffffff;
          padding: 1.45mm 1.65mm 1.35mm 2.35mm;
          break-inside: avoid;
          box-sizing: border-box;
        }

        .label-qr {
          width: 19mm;
          height: 19mm;
          justify-self: end;
        }

        .label-qr-img {
          display: block;
          width: 19mm;
          height: 19mm;
          image-rendering: pixelated;
        }

        .label-text {
          min-width: 0;
          overflow: hidden;
        }

        .label-municipality {
          color: #000;
          font-size: 10.4pt;
          font-weight: 950;
          line-height: 0.98;
          margin-bottom: 1mm;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .label-product {
          color: #000;
          font-size: 7.1pt;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 0.72mm;
          max-height: 3.9mm;
          overflow: hidden;
          text-transform: uppercase;
          word-break: normal;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .label-line {
          color: #000;
          font-size: 6.25pt;
          font-weight: 900;
          line-height: 1;
          margin-top: 0.72mm;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
        }

        .label-doc-line {
          font-size: 5.8pt;
          letter-spacing: 0;
        }

        @media print {
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body {
            background: #fff !important;
          }

          .label-print-page {
            padding: 0;
            min-height: 0;
          }

          .print-toolbar {
            display: none;
          }

          .labels-sheet {
            display: block;
            width: 96mm;
            max-width: 96mm;
            margin: 0;
          }

          .label-card {
            width: 96mm;
            height: 24mm;
            margin: 0;
            page-break-after: always;
            break-after: page;
          }

          .label-card:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div>
          <div className="print-title">Etiquetas QR</div>
          <div className="print-subtitle">
            {request?.gtmiNumber || "Requisição"} {labelItems.length ? `• ${labelItems.length} etiqueta(s)` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => history.back()}>
            Voltar
          </Button>
          <Button onClick={handlePrint} disabled={!readyToPrint || printing}>
            {printing ? "A abrir..." : readyToPrint ? "Imprimir" : "A preparar..."}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : labelItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Não existem códigos QR associados aos itens deste pedido.</p>
      ) : (
        <div className="labels-sheet">
          {labelItems.map((item) => {
            const code = item.destination?.trim() || "";
            const unit = unitByCode[code];
            const product = unit?.product || item.product;
            const invoice = unit?.invoice || invoiceByProductId[item.productId];
            const supplierName = product?.supplier?.name || item.product?.supplier?.name || "";
            const specs = product?.description || item.notes || "";
            const sku = product?.sku || item.product?.sku || "";
            const serialNumber = unit?.serialNumber || item.reference || "";
            const invoiceText = invoice?.invoiceNumber
              ? `${cleanDocNumber(invoice.invoiceNumber, "FT")}${invoice.issuedAt ? ` ${formatDateShortPt(invoice.issuedAt)}` : ""}`
              : "";
            const reqNumber = invoice?.reqNumber || request?.gtmiNumber || "";
            const reqDate = invoice?.reqDate || request?.requestedAt || "";
            const reqText = reqNumber ? `${cleanDocNumber(reqNumber, "REQ")}${reqDate ? ` ${formatDateShortPt(reqDate)}` : ""}` : "";
            const productText = joinUniqueParts([product?.name || item.productId, specs]);
            const identityText = joinUniqueParts([serialNumber ? `SN: ${serialNumber}` : "", supplierName]);
            const secondaryText = productText && normalizeComparable(productText) !== normalizeComparable(sku) ? sku : "";

            return (
              <div className="label-card" key={item.id}>
                <div className="label-text">
                  <div className="label-municipality">MUNICIPIO CHAMUSCA</div>
                  <div className="label-product">{productText}</div>
                  <div className="label-line">{joinUniqueParts([secondaryText, identityText])}</div>
                  <div className="label-line label-doc-line">{joinUniqueParts([invoiceText, reqText])}</div>
                </div>
                <div className="label-qr">
                  {qrByCode[code] ? (
                    <Image
                      src={qrByCode[code]}
                      alt={`QR ${code}`}
                      width={96}
                      height={96}
                      className="label-qr-img"
                      unoptimized
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
