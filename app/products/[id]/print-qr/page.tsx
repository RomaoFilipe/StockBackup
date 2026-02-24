"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";

type ProductDetails = {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
};

type ProductUnit = {
  id: string;
  code: string;
  status: "IN_STOCK" | "ACQUIRED";
  serialNumber?: string | null;
  partNumber?: string | null;
  assetTag?: string | null;
  notes?: string | null;
  createdAt: string;
  acquiredAt?: string | null;
  productId: string;
  invoiceId?: string | null;
  acquiredByUserId?: string | null;
};

async function fetchAllUnits(params: { productId: string; asUserId?: string }) {
  const all: ProductUnit[] = [];
  let cursor: string | null | undefined = undefined;

  // Loop with cursor pagination until no more results.
  // Limit capped at 200 in API.
  while (true) {
    const res: any = await axiosInstance.get("/units", {
      params: {
        productId: params.productId,
        asUserId: params.asUserId || undefined,
        limit: 200,
        cursor: cursor || undefined,
      },
    });

    const items: ProductUnit[] = res.data?.items ?? [];
    all.push(...items);

    const nextCursor: string | null = res.data?.nextCursor ?? null;
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return all;
}

export default function PrintProductUnitsQrPage() {
  const routeParams = useParams<{ id: string }>();
  const productId = routeParams?.id;
  const searchParams = useSearchParams();

  const asUserId = useMemo(() => searchParams?.get("asUserId") ?? undefined, [searchParams]);

  const [origin, setOrigin] = useState("");
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [qrDataUrlByCode, setQrDataUrlByCode] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!productId) return;
      setLoading(true);
      try {
        const [productRes, allUnits] = await Promise.all([
          axiosInstance.get(`/products/${productId}`, {
            params: asUserId ? { asUserId } : undefined,
          }),
          fetchAllUnits({ productId, asUserId }),
        ]);

        if (cancelled) return;

        setProduct(productRes.data);
        // Keep newest first (API already does), but we want stable order for printing: oldest -> newest.
        setUnits(allUnits.slice().reverse());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [productId, asUserId]);

  useEffect(() => {
    let cancelled = false;

    const buildQrs = async () => {
      if (!origin) return;
      if (units.length === 0) return;

      const next: Record<string, string> = {};
      for (const u of units) {
        const url = `${origin}/scan/${u.code}`;
        // Moderate size: good for printing, still crisp.
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 220,
          errorCorrectionLevel: "M",
        });
        next[u.code] = dataUrl;
        if (cancelled) return;
      }

      if (!cancelled) setQrDataUrlByCode(next);
    };

    buildQrs();
    return () => {
      cancelled = true;
    };
  }, [origin, units]);

  const readyToPrint = !loading && units.length > 0 && Object.keys(qrDataUrlByCode).length === units.length;

  const handlePrint = async () => {
    setPrinting(true);
    // Small delay so the browser applies print styles reliably.
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  return (
    <div className="print-page">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
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

        .print-title {
          font-size: 14px;
          font-weight: 600;
        }

        .print-subtitle {
          font-size: 12px;
          color: hsl(var(--muted-foreground));
        }

        .labels-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6mm;
        }

        .label {
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 6px;
          padding: 8px;
          display: grid;
          grid-template-columns: 68px 1fr;
          gap: 8px;
          align-items: start;
          break-inside: avoid;
        }

        .label-qr {
          width: 68px;
          height: 68px;
        }

        .label-qr-img {
          width: 68px;
          height: 68px;
          display: block;
        }

        .label-meta {
          min-width: 0;
        }

        .label-product {
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 2px;
          word-break: break-word;
        }

        .label-line {
          font-size: 10px;
          line-height: 1.2;
          margin: 1px 0;
          word-break: break-word;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        @media print {
          .print-page {
            padding: 0;
          }

          .print-toolbar {
            display: none;
          }

          .label {
            border-color: rgba(0, 0, 0, 0.25);
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div>
          <div className="print-title">Imprimir QRs • Unidades</div>
          <div className="print-subtitle">
            {product ? `${product.name} • ${product.sku}` : ""}
            {units.length ? ` • ${units.length} unidade(s)` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => history.back()}>
            Voltar
          </Button>
          <Button onClick={handlePrint} disabled={!readyToPrint || printing}>
            {printing ? "A abrir impressão..." : readyToPrint ? "Imprimir" : "A preparar..."}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : units.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem unidades para imprimir.</p>
      ) : (
        <div className="labels-grid">
          {units.map((u) => (
            <div className="label" key={u.id}>
              <div className="label-qr">
                {qrDataUrlByCode[u.code] ? (
                  <Image
                    src={qrDataUrlByCode[u.code]}
                    alt={u.code}
                    width={68}
                    height={68}
                    unoptimized
                    className="label-qr-img"
                  />
                ) : null}
              </div>
              <div className="label-meta">
                <div className="label-product">{product?.name ?? "Produto"}</div>
                <div className="label-line">
                  <span className="mono">QR:</span> <span className="mono">{u.code}</span>
                </div>
                {u.serialNumber ? (
                  <div className="label-line">
                    <span className="mono">S/N:</span> <span className="mono">{u.serialNumber}</span>
                  </div>
                ) : null}
                {u.partNumber ? (
                  <div className="label-line">
                    <span className="mono">P/N:</span> <span className="mono">{u.partNumber}</span>
                  </div>
                ) : null}
                {u.assetTag ? (
                  <div className="label-line">
                    <span className="mono">TAG:</span> <span className="mono">{u.assetTag}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
