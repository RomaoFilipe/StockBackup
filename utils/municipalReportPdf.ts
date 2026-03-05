import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { MunicipalReportData } from "@/utils/municipalReports";

function safe(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const s = typeof value === "string" ? value.trim() : "";
  return s || "-";
}

function formatDatePt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function eur(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(2)} €`;
}

export async function buildMunicipalReportPdfBytes(args: {
  tenantName?: string | null;
  data: MunicipalReportData;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;

  let page = doc.addPage(pageSize);
  let y = page.getSize().height - marginTop;

  const ensureSpace = (needed: number) => {
    if (y - needed >= marginBottom) return;
    page = doc.addPage(pageSize);
    y = page.getSize().height - marginTop;
  };

  const drawText = (text: string, opts?: { size?: number; bold?: boolean; color?: any }) => {
    const size = opts?.size ?? 11;
    ensureSpace(size + 10);

    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ?? rgb(0, 0, 0),
    });
    y -= size + 6;
  };

  const divider = () => {
    ensureSpace(24);
    y -= 6;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: page.getSize().width - marginX, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;
  };

  const title = (t: string) => {
    ensureSpace(32);
    y -= 2;
    drawText(t, { size: 13, bold: true });
  };

  const tableRow = (left: string, right: string) => {
    const size = 10;
    ensureSpace(size + 8);
    page.drawText(left, { x: marginX, y, size, font });
    const rightX = page.getSize().width - marginX;
    page.drawText(right, { x: rightX - font.widthOfTextAtSize(right, size), y, size, font });
    y -= size + 5;
  };

  // Header
  drawText("RELATÓRIO MUNICIPAL • STOCKLY", { size: 16, bold: true });
  drawText(`Entidade: ${safe(args.tenantName ?? "-")}`, { size: 11, bold: true });
  drawText(`Período: ${formatDatePt(args.data.meta.from)} → ${formatDatePt(args.data.meta.to)}`, {
    size: 10,
    color: rgb(0.25, 0.25, 0.25),
  });
  drawText(`Gerado em: ${formatDatePt(args.data.meta.generatedAt)}`, {
    size: 10,
    color: rgb(0.25, 0.25, 0.25),
  });

  divider();

  // Stock
  title("1) Posição de Stock");
  tableRow("Total de produtos", safe(args.data.stock.totalProducts));
  tableRow("Quantidade total", safe(args.data.stock.totalQuantity));
  tableRow("Valor total estimado", eur(args.data.stock.totalValue));
  tableRow("Artigos em baixo stock (≤ 20)", safe(args.data.stock.lowStockCount));
  tableRow("Artigos sem stock", safe(args.data.stock.outOfStockCount));

  y -= 6;
  drawText("Top produtos por valor:", { bold: true, size: 11 });
  for (const [i, p] of args.data.stock.topByValue.slice(0, 10).entries()) {
    drawText(`${i + 1}. ${p.name} (${p.sku}) — ${p.quantity} × ${eur(p.unitPrice)} = ${eur(p.value)}`, {
      size: 10,
    });
  }

  divider();

  // Purchases
  title("2) Compras / Entradas (Faturas)");
  tableRow("Nº de linhas de fatura", safe(args.data.purchases.invoicesCount));
  tableRow("Quantidade total recebida", safe(args.data.purchases.totalQuantity));
  tableRow("Total gasto", eur(args.data.purchases.totalSpend));

  y -= 6;
  drawText("Top fornecedores por gasto:", { bold: true, size: 11 });
  for (const [i, s] of args.data.purchases.bySupplier.slice(0, 8).entries()) {
    drawText(`${i + 1}. ${s.supplier} — ${eur(s.spend)} (${s.quantity} un.; ${s.invoices} linhas)`, { size: 10 });
  }

  y -= 6;
  drawText("Top produtos por gasto:", { bold: true, size: 11 });
  for (const [i, p] of args.data.purchases.topProducts.slice(0, 8).entries()) {
    drawText(`${i + 1}. ${p.name} (${p.sku}) — ${p.quantity} un.; ${eur(p.spend)}`, { size: 10 });
  }

  divider();

  // Requests
  title("3) Requisições / Saídas");
  tableRow("Nº de requisições", safe(args.data.requests.requestsCount));
  tableRow("Total de itens requisitados", safe(args.data.requests.totalItemsRequested));

  const compliance = args.data.requests.signatureCompliance;
  if (compliance.totalConsidered > 0) {
    const approvedPct = (compliance.approvedSignedCount / compliance.totalConsidered) * 100;
    const pickupPct = (compliance.pickupSignedCount / compliance.totalConsidered) * 100;
    tableRow("Conformidade (aprovação assinada)", `${approvedPct.toFixed(0)}%`);
    tableRow("Conformidade (levantamento assinado)", `${pickupPct.toFixed(0)}%`);
  }

  y -= 6;
  drawText("Por estado:", { bold: true, size: 11 });
  for (const row of args.data.requests.byStatus.slice(0, 10)) {
    drawText(`- ${row.status}: ${row.count}`, { size: 10 });
  }

  y -= 6;
  drawText("Top serviços por consumo:", { bold: true, size: 11 });
  for (const [i, s] of args.data.requests.byService.slice(0, 8).entries()) {
    drawText(`${i + 1}. ${s.service} — ${s.items} itens (${s.requests} req.)`, { size: 10 });
  }

  y -= 6;
  drawText("Top produtos requisitados:", { bold: true, size: 11 });
  for (const [i, p] of args.data.requests.topProducts.slice(0, 8).entries()) {
    drawText(`${i + 1}. ${p.name} (${p.sku}) — ${p.quantity}`, { size: 10 });
  }

  divider();

  // Movements
  title("4) Movimentos / Auditoria");
  tableRow("Total de movimentos (recentes)", safe(args.data.movements.totalMovements));
  y -= 6;
  drawText("Por tipo:", { bold: true, size: 11 });
  for (const row of args.data.movements.byType.slice(0, 10)) {
    drawText(`- ${row.type}: ${row.count} movimentos; ${row.quantity} un.`, { size: 10 });
  }

  divider();

  // Units
  title("5) Unidades / Ativos (QR)");
  tableRow("Total de unidades", safe(args.data.units.totalUnits));
  y -= 6;
  drawText("Por estado:", { bold: true, size: 11 });
  for (const row of args.data.units.byStatus) {
    drawText(`- ${row.status}: ${row.count}`, { size: 10 });
  }

  y -= 6;
  drawText("Top produtos por nº de unidades:", { bold: true, size: 11 });
  for (const [i, p] of args.data.units.topProducts.slice(0, 8).entries()) {
    drawText(`${i + 1}. ${p.name} (${p.sku}) — ${p.units}`, { size: 10 });
  }

  return await doc.save();
}
