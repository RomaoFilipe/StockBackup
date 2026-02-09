import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type BusinessInsightsPdfData = {
  generatedAt: Date;
  periodLabel: string;

  inventory: {
    totalProducts: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    averagePrice: number;
    totalQuantity: number;
  };

  requests: {
    totalRequests: number;
    totalItemsRequested: number;
    byStatus: Array<{ status: string; count: number }>;
    topProducts: Array<{ name: string; quantity: number }>;
  };
};

function formatDateTimePt(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function safeText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const v = typeof value === "string" ? value.trim() : "";
  return v || "-";
}

export async function buildBusinessInsightsPdfBytes(data: BusinessInsightsPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const marginX = 48;
  let y = height - 56;

  const drawLine = (text: string, opts?: { size?: number; bold?: boolean; color?: any }) => {
    const size = opts?.size ?? 11;
    const usedFont = opts?.bold ? fontBold : font;

    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: usedFont,
      color: opts?.color ?? rgb(0, 0, 0),
    });

    y -= size + 6;
  };

  const drawDivider = () => {
    y -= 6;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;
  };

  // Header
  drawLine("RELATÓRIO • INSIGHTS", { size: 16, bold: true });
  drawLine(`Período: ${safeText(data.periodLabel)}`, { size: 11, bold: true });
  drawLine(`Gerado em: ${formatDateTimePt(data.generatedAt)}`, { size: 10, color: rgb(0.25, 0.25, 0.25) });

  drawDivider();

  // Requests section
  drawLine("Requisições", { size: 13, bold: true });
  drawLine(`Total de requisições: ${safeText(data.requests.totalRequests)}`);
  drawLine(`Total de itens (quantidade): ${safeText(data.requests.totalItemsRequested)}`);

  if (data.requests.byStatus.length) {
    y -= 4;
    drawLine("Por estado:", { bold: true });
    for (const row of data.requests.byStatus) {
      drawLine(`- ${row.status}: ${row.count}`, { size: 10 });
      if (y < 220) break;
    }
  }

  if (data.requests.topProducts.length && y > 240) {
    y -= 4;
    drawLine("Top produtos requisitados:", { bold: true });
    for (const [idx, row] of data.requests.topProducts.slice(0, 10).entries()) {
      drawLine(`${idx + 1}. ${row.name} — ${row.quantity}`, { size: 10 });
      if (y < 220) break;
    }
  }

  drawDivider();

  // Inventory section
  drawLine("Inventário", { size: 13, bold: true });
  drawLine(`Total de produtos: ${safeText(data.inventory.totalProducts)}`);
  drawLine(`Valor total: ${safeText(data.inventory.totalValue)} €`);
  drawLine(`Stock baixo (≤ 20): ${safeText(data.inventory.lowStockItems)}`);
  drawLine(`Sem stock: ${safeText(data.inventory.outOfStockItems)}`);
  drawLine(`Quantidade total: ${safeText(data.inventory.totalQuantity)}`);
  drawLine(`Preço médio (aprox.): ${safeText(data.inventory.averagePrice)} €`);

  const bytes = await doc.save();
  return bytes;
}
