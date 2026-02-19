import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

type EventPdfData = {
  id: string;
  createdAt: string;
  oldCode: string;
  newCode: string;
  oldDisposition: "RETURN" | "REPAIR" | "SCRAP" | "LOST";
  reason: string | null;
  costCenter: string | null;
  ticketNumber: string | null;
  compatibilityOverrideReason: string | null;
  note?: string | null;
  actor?: { id: string; name: string; email: string } | null;
  oldUnit?: {
    id: string;
    code: string;
    status: string;
    product: { id: string; name: string; sku: string };
  } | null;
  newUnit?: {
    id: string;
    code: string;
    status: string;
    assignedTo?: { id: string; name: string; email: string } | null;
    product: { id: string; name: string; sku: string };
  } | null;
};

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("Expected PNG data URL");
  const base64 = dataUrl.slice(prefix.length);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function safe(value: string | null | undefined) {
  const v = value?.trim();
  return v && v.length > 0 ? v : "-";
}

function statusLabel(status?: string | null) {
  if (status === "IN_STOCK") return "Em stock";
  if (status === "ACQUIRED") return "Adquirida";
  if (status === "IN_REPAIR") return "Em reparação";
  if (status === "SCRAPPED") return "Abatida";
  if (status === "LOST") return "Perdida";
  return safe(status || "-");
}

export async function buildSubstitutionPdfBuffer(event: EventPdfData, eventUrl: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { height } = page.getSize();

  const marginX = 42;
  let y = height - 48;

  const drawText = (text: string, opts?: { size?: number; bold?: boolean; indent?: number }) => {
    const size = opts?.size ?? 11;
    page.drawText(text, {
      x: marginX + (opts?.indent ?? 0),
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: rgb(0.05, 0.05, 0.05),
    });
    y -= size + 6;
  };

  drawText("REQUISIÇÃO DE SUBSTITUIÇÃO", { size: 16, bold: true });
  drawText(`Evento: ${safe(event.id)}`, { bold: true });
  drawText(`Data: ${safe(new Date(event.createdAt).toLocaleString("pt-PT"))}`);
  drawText(`Responsável: ${safe(event.actor?.name)} (${safe(event.actor?.email)})`);

  const qrDataUrl = await QRCode.toDataURL(eventUrl, { width: 170, margin: 1 });
  const qrPng = await doc.embedPng(decodePngDataUrl(qrDataUrl));
  page.drawImage(qrPng, {
    x: 595.28 - 42 - 96,
    y: height - 42 - 96,
    width: 96,
    height: 96,
  });

  y -= 8;
  drawText("Equipamento Antigo", { bold: true, size: 13 });
  drawText(`Código: ${safe(event.oldCode)}`, { indent: 10 });
  drawText(`Produto: ${safe(event.oldUnit?.product.name)} (${safe(event.oldUnit?.product.sku)})`, { indent: 10 });
  drawText(`Estado atual: ${statusLabel(event.oldUnit?.status)}`, { indent: 10 });
  drawText(
    `Destino aplicado: ${
      event.oldDisposition === "SCRAP"
        ? "Abate"
        : event.oldDisposition === "REPAIR"
          ? "Reparação"
          : event.oldDisposition === "LOST"
            ? "Extravio"
            : "Devolução"
    }`,
    { indent: 10 }
  );

  y -= 6;
  drawText("Equipamento Novo", { bold: true, size: 13 });
  drawText(`Código: ${safe(event.newCode)}`, { indent: 10 });
  drawText(`Produto: ${safe(event.newUnit?.product.name)} (${safe(event.newUnit?.product.sku)})`, { indent: 10 });
  drawText(`Estado atual: ${statusLabel(event.newUnit?.status)}`, { indent: 10 });
  drawText(`Atribuído a: ${safe(event.newUnit?.assignedTo?.name)}`, { indent: 10 });

  y -= 6;
  drawText("Motivo e Auditoria", { bold: true, size: 13 });
  drawText(`Motivo: ${safe(event.reason)}`, { indent: 10 });
  drawText(`Centro de custo: ${safe(event.costCenter)}`, { indent: 10 });
  drawText(`Ticket: ${safe(event.ticketNumber)}`, { indent: 10 });
  drawText(`Compatibilidade (override): ${safe(event.compatibilityOverrideReason)}`, { indent: 10 });
  drawText(`Nota auditoria: ${safe(event.note)}`, { indent: 10 });

  y -= 8;
  drawText(`URL do evento: ${eventUrl}`, { size: 9 });

  y -= 30;
  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 220, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  page.drawLine({ start: { x: marginX + 290, y }, end: { x: marginX + 510, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  drawText("Responsável técnico", { size: 10 });
  page.drawText("Recebedor / utilizador", { x: marginX + 290, y: y + 16, size: 10, font, color: rgb(0.05, 0.05, 0.05) });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
