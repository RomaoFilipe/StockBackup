import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

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
  signedSignatureDataUrl?: string | null;

  pickupSignedAt?: Date | null;
  pickupSignedByName?: string | null;
  pickupSignedByTitle?: string | null;
  pickupSignatureDataUrl?: string | null;

  items: Array<{
    quantity: bigint | number;
    unit?: string | null;
    notes?: string | null;
    reference?: string | null;
    destination?: string | null;
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

function shortQrCode(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function formatDatePt(date?: Date | null, withTime = false): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export async function buildSignedRequestPdfBuffer(req: RequestForPdf): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const ink = rgb(0.06, 0.1, 0.18);
  const muted = rgb(0.38, 0.45, 0.56);
  const border = rgb(0.78, 0.82, 0.88);
  const soft = rgb(0.96, 0.98, 1);
  const header = rgb(0.9, 0.95, 1);
  const tableHeader = rgb(0.94, 0.96, 0.98);
  const marginX = 32;
  const contentW = width - marginX * 2;
  let y = height - 34;

  const text = (
    value: string,
    x: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; color?: any; maxWidth?: number }
  ) => {
    const size = opts?.size ?? 9;
    const usedFont = opts?.bold ? fontBold : font;
    let printed = value;
    if (opts?.maxWidth) {
      while (printed.length > 1 && usedFont.widthOfTextAtSize(printed, size) > opts.maxWidth) {
        printed = printed.slice(0, -1);
      }
      if (printed !== value && printed.length > 3) printed = `${printed.slice(0, -3)}...`;
    }
    page.drawText(printed, {
      x,
      y: yPos,
      size,
      font: usedFont,
      color: opts?.color ?? ink,
    });
  };

  const wrap = (value: string, maxWidth: number, size = 9, bold = false) => {
    const usedFont = bold ? fontBold : font;
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (usedFont.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ["-"];
  };

  const box = (x: number, yPos: number, w: number, h: number, fill = rgb(1, 1, 1)) => {
    page.drawRectangle({
      x,
      y: yPos,
      width: w,
      height: h,
      color: fill,
      borderColor: border,
      borderWidth: 0.8,
    });
  };

  const field = (label: string, value: string, x: number, yTop: number, w: number, h: number) => {
    box(x, yTop - h, w, h);
    text(label, x + 8, yTop - 14, { size: 7.5, color: muted });
    const lines = wrap(value || "-", w - 16, 9.5, true).slice(0, 2);
    lines.forEach((line, idx) => text(line, x + 8, yTop - 30 - idx * 11, { size: 9.5, bold: idx === 0 }));
  };

  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: header });
  text("Suporte Tecnico Municipal", marginX, height - 37, { size: 8.5, color: muted });
  text("Pedido de material de consumo / servico", marginX, height - 58, { size: 17, bold: true });
  text(`N.º ${safeLine(req.gtmiNumber)}`, marginX, height - 76, { size: 10.5, bold: true });
  text("Documento assinado", width - marginX - 130, height - 45, { size: 9, color: muted });
  text(formatDatePt(new Date(), true), width - marginX - 130, height - 62, { size: 10, bold: true });

  y = height - 112;
  const colGap = 10;
  const colW = (contentW - colGap) / 2;
  field("Servico requisitante", safeLine(req.requestingService), marginX, y, colW, 48);
  field("Funcionario / Orgao", safeLine(req.requesterName), marginX + colW + colGap, y, colW, 48);
  y -= 58;
  field("Local de entrega", safeLine(req.deliveryLocation), marginX, y, colW, 48);
  field("Data do pedido", formatDatePt(req.requestedAt), marginX + colW + colGap, y, colW, 48);
  y -= 58;
  field("Fundamento do pedido", safeLine(req.notes || req.title), marginX, y, contentW, 58);
  y -= 74;

  const qrImageByCode = new Map<string, Uint8Array>();
  const qrCodes = Array.from(
    new Set(req.items.map((it) => it.destination?.trim()).filter((code): code is string => Boolean(code)))
  );
  await Promise.all(
    qrCodes.map(async (code) => {
      try {
        const dataUrl = await QRCode.toDataURL(code, {
          width: 132,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        qrImageByCode.set(code, decodePngDataUrl(dataUrl));
      } catch {
        // The QR is helpful but should not block the legal PDF.
      }
    })
  );

  text("Material requisitado", marginX, y, { size: 11, bold: true });
  y -= 18;
  const tableX = marginX;
  const tableW = contentW;
  const headH = 24;
  box(tableX, y - headH, tableW, headH, tableHeader);
  text("N.º", tableX + 8, y - 16, { size: 8, bold: true });
  text("Designacao", tableX + 38, y - 16, { size: 8, bold: true });
  text("Unid.", tableX + tableW - 176, y - 16, { size: 8, bold: true });
  text("Qtd", tableX + tableW - 132, y - 16, { size: 8, bold: true });
  text("QR unidade", tableX + tableW - 82, y - 16, { size: 8, bold: true });
  y -= headH;

  const maxItems = 12;
  for (const [idx, it] of req.items.slice(0, maxItems).entries()) {
    const qty = typeof it.quantity === "bigint" ? Number(it.quantity) : Number(it.quantity);
    const sku = it.product.sku ? `SKU: ${it.product.sku}` : "";
    const reference = it.reference?.trim() ? `Ref.: ${it.reference.trim()}` : "";
    const code = it.destination?.trim() || "";
    const lines = [
      ...wrap(it.product.name, tableW - 230, 9, true).slice(0, 2),
      ...wrap([sku, reference].filter(Boolean).join(" · "), tableW - 230, 7.5).slice(0, 1),
    ].filter(Boolean);
    const rowH = Math.max(code ? 72 : 38, 16 + lines.length * 10);
    if (y - rowH < 190) break;
    box(tableX, y - rowH, tableW, rowH);
    text(String(idx + 1), tableX + 9, y - 16, { size: 8.5 });
    lines.forEach((line, lineIdx) =>
      text(line, tableX + 38, y - 16 - lineIdx * 10, {
        size: lineIdx === 0 ? 9 : 7.5,
        bold: lineIdx === 0,
        color: lineIdx === 0 ? ink : muted,
        maxWidth: tableW - 230,
      })
    );
    text(safeLine(it.unit || "UN"), tableX + tableW - 176, y - 16, { size: 8.5, maxWidth: 34 });
    text(String(Number.isFinite(qty) ? qty : "-"), tableX + tableW - 132, y - 16, { size: 8.5, bold: true });
    if (code) {
      const qrBytes = qrImageByCode.get(code);
      if (qrBytes) {
        try {
          const qrImg = await doc.embedPng(qrBytes);
          page.drawImage(qrImg, {
            x: tableX + tableW - 78,
            y: y - rowH + 14,
            width: 50,
            height: 50,
          });
        } catch {
          text(shortQrCode(code), tableX + tableW - 86, y - 18, { size: 6.5, maxWidth: 74 });
        }
      } else {
        text(shortQrCode(code), tableX + tableW - 86, y - 18, { size: 6.5, maxWidth: 74 });
      }
    }
    y -= rowH;
  }

  y = Math.min(y - 20, 178);
  const sigW = (contentW - 12) / 2;
  const sigH = 118;
  const sigY = 56;
  box(marginX, sigY, sigW, sigH, soft);
  box(marginX + sigW + 12, sigY, sigW, sigH, soft);

  text("Assinatura do responsavel pelo pedido", marginX + 12, sigY + sigH - 18, { size: 8.5, color: muted });
  text("Assinatura do tecnico GTMI", marginX + sigW + 24, sigY + sigH - 18, { size: 8.5, color: muted });

  if (req.pickupSignatureDataUrl) {
    try {
      const pngBytes = decodePngDataUrl(req.pickupSignatureDataUrl);
      const img = await doc.embedPng(pngBytes);
      const targetW = Math.min(sigW - 44, 170);
      const scale = targetW / img.width;
      const targetH = Math.min(img.height * scale, 44);
      page.drawImage(img, {
        x: marginX + (sigW - targetW) / 2,
        y: sigY + 46,
        width: targetW,
        height: targetH,
      });
    } catch {
      // Fall back to the typed identity if the stored signature image is unavailable.
    }
  }

  if (req.signedSignatureDataUrl) {
    try {
      const pngBytes = decodePngDataUrl(req.signedSignatureDataUrl);
      const img = await doc.embedPng(pngBytes);
      const targetW = Math.min(sigW - 44, 170);
      const scale = targetW / img.width;
      const targetH = Math.min(img.height * scale, 44);
      page.drawImage(img, {
        x: marginX + sigW + 12 + (sigW - targetW) / 2,
        y: sigY + 46,
        width: targetW,
        height: targetH,
      });
    } catch {
      // Fall back to the typed identity if the stored signature image is unavailable.
    }
  }

  page.drawLine({ start: { x: marginX + 24, y: sigY + 42 }, end: { x: marginX + sigW - 24, y: sigY + 42 }, thickness: 0.8, color: border });
  page.drawLine({
    start: { x: marginX + sigW + 36, y: sigY + 42 },
    end: { x: marginX + contentW - 24, y: sigY + 42 },
    thickness: 0.8,
    color: border,
  });
  text(safeLine(req.pickupSignedByName), marginX + 24, sigY + 26, { size: 9, bold: true, maxWidth: sigW - 48 });
  text(formatDatePt(req.pickupSignedAt, true), marginX + 24, sigY + 13, { size: 7.5, color: muted });
  text(safeLine(req.signedByName), marginX + sigW + 36, sigY + 26, { size: 9, bold: true, maxWidth: sigW - 60 });
  text(formatDatePt(req.signedAt, true), marginX + sigW + 36, sigY + 13, { size: 7.5, color: muted });

  text(`Gerado automaticamente pelo sistema · ${safeLine(req.gtmiNumber)}`, marginX, 24, { size: 7.5, color: muted });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
