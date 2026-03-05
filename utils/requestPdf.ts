import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type RequestForPdf = {
  gtmiNumber: string;
  requestedAt: Date;
  title?: string | null;
  notes?: string | null;

  requestingService?: string | null;
  requesterName?: string | null;
  requesterEmployeeNo?: string | null;
  deliveryLocation?: string | null;

  signedAt?: Date | null;
  signedByName?: string | null;
  signedByTitle?: string | null;

  pickupSignedAt?: Date | null;
  pickupSignedByName?: string | null;
  pickupSignedByTitle?: string | null;
  pickupSignatureDataUrl?: string | null;

  items: Array<{
    quantity: bigint | number;
    unit?: string | null;
    notes?: string | null;
    product: { name: string; sku?: string | null };
  }>;
};

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("Expected PNG data URL");
  }
  const base64 = dataUrl.slice(prefix.length);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function safeLine(value: unknown): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v || "-";
}

export async function buildSignedRequestPdfBuffer(req: RequestForPdf): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const marginX = 48;
  let y = height - 56;

  const drawText = (text: string, opts?: { size?: number; bold?: boolean; color?: any }) => {
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

  drawText("REQUISIÇÃO", { size: 16, bold: true });
  drawText(`Nº: ${safeLine(req.gtmiNumber)}`, { size: 13, bold: true });
  drawText(`Data do pedido: ${safeLine(req.requestedAt.toISOString().slice(0, 10))}`);
  drawText(`Serviço: ${safeLine(req.requestingService)}`);
  drawText(`Funcionário: ${safeLine(req.requesterName)}`);
  drawText(`Nº Mec.: ${safeLine(req.requesterEmployeeNo)}`);
  drawText(`Local de entrega: ${safeLine(req.deliveryLocation)}`);

  if (req.title) drawText(`Resumo: ${req.title}`);
  if (req.notes) drawText(`Notas: ${req.notes}`);

  y -= 6;
  drawText("Itens:", { bold: true });

  const maxItems = 40;
  for (const [idx, it] of req.items.slice(0, maxItems).entries()) {
    const qty = typeof it.quantity === "bigint" ? Number(it.quantity) : Number(it.quantity);
    const unit = it.unit?.trim() ? ` ${it.unit.trim()}` : "";
    const sku = it.product.sku ? ` (${it.product.sku})` : "";
    const notes = it.notes?.trim() ? ` — ${it.notes.trim()}` : "";
    const line = `${idx + 1}. ${qty}${unit} · ${it.product.name}${sku}${notes}`;

    // Very simple wrapping
    const maxChars = 95;
    if (line.length <= maxChars) {
      drawText(line, { size: 10 });
    } else {
      drawText(line.slice(0, maxChars), { size: 10 });
      drawText(line.slice(maxChars), { size: 10 });
    }

    if (y < 130) break;
  }

  y -= 8;
  if (req.signedAt || req.signedByName) {
    drawText("Assinatura de aprovação:", { bold: true });
    drawText(`Aprovado por: ${safeLine(req.signedByName)} (${safeLine(req.signedByTitle)})`);
    drawText(`Data: ${safeLine(req.signedAt ? req.signedAt.toISOString() : "-")}`);
    y -= 6;
  }

  if (req.pickupSignedAt || req.pickupSignedByName || req.pickupSignatureDataUrl) {
    drawText("Assinatura de levantamento:", { bold: true });
    drawText(`Assinado por: ${safeLine(req.pickupSignedByName)} (${safeLine(req.pickupSignedByTitle)})`);
    drawText(`Data: ${safeLine(req.pickupSignedAt ? req.pickupSignedAt.toISOString() : "-")}`);

    if (req.pickupSignatureDataUrl) {
      const pngBytes = decodePngDataUrl(req.pickupSignatureDataUrl);
      const img = await doc.embedPng(pngBytes);
      const maxW = width - marginX * 2;
      const targetW = Math.min(maxW, 420);
      const scale = targetW / img.width;
      const targetH = img.height * scale;

      const imgY = Math.max(60, y - targetH - 10);
      page.drawRectangle({
        x: marginX,
        y: imgY - 8,
        width: targetW + 16,
        height: targetH + 16,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawImage(img, {
        x: marginX + 8,
        y: imgY,
        width: targetW,
        height: targetH,
      });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
