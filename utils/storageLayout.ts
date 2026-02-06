import path from "path";

export function formatDateYmd(date: Date): string {
  // Use UTC to avoid timezone-dependent folder names.
  return date.toISOString().slice(0, 10);
}

export function toSafePathSegment(input: string, fallback = "item"): string {
  const ascii = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const cleaned = ascii
    // Guard against path traversal and Windows reserved characters.
    .replace(/[\\/]/g, "_")
    .replace(/[<>:"|?*]/g, "_")
    // Collapse whitespace.
    .replace(/\s+/g, " ")
    .trim()
    // Keep a conservative charset to avoid weird filesystem issues.
    .replace(/[^a-zA-Z0-9 _.-]/g, "_")
    // Avoid trailing dots/spaces.
    .replace(/[ .]+$/g, "")
    .slice(0, 180);

  return cleaned || fallback;
}

export function buildRequestFolderName(args: {
  gtmiNumber: string;
  requesterName?: string | null;
  summary?: string | null;
  requestedAt: Date;
}): string {
  const requester = (args.requesterName ?? "Funcionario").trim() || "Funcionario";
  const summary = (args.summary ?? "Pedido").trim() || "Pedido";
  const date = formatDateYmd(args.requestedAt);

  return toSafePathSegment(`${args.gtmiNumber} - ${requester} - ${summary} - ${date}`, "Pedido");
}

export function getRequestStorageDir(args: {
  tenantId: string;
  gtmiYear: number;
  folderName: string;
}): string {
  return path.join(
    process.cwd(),
    "storage",
    args.tenantId,
    String(args.gtmiYear),
    "REQUISICOES",
    args.folderName
  );
}

export function buildProductFolderName(args: { sku: string; name?: string | null }): string {
  const sku = (args.sku ?? "").trim() || "SKU";
  const name = (args.name ?? "Produto").trim() || "Produto";
  return toSafePathSegment(`${sku} - ${name}`, "Produto");
}

export function getProductStorageDir(args: {
  tenantId: string;
  year: number;
  folderName: string;
}): string {
  return path.join(process.cwd(), "storage", args.tenantId, String(args.year), "PRODUTOS", args.folderName);
}

export function getProductInvoiceStorageDir(args: {
  tenantId: string;
  year: number;
  productFolderName: string;
  invoiceFolderName: string;
}): string {
  const productDir = getProductStorageDir({
    tenantId: args.tenantId,
    year: args.year,
    folderName: args.productFolderName,
  });
  return path.join(productDir, "FATURAS", args.invoiceFolderName);
}

export function buildInvoiceFolderName(args: {
  invoiceNumber: string;
  issuedAt: Date;
}): string {
  const invoiceNumber = (args.invoiceNumber ?? "").trim() || "Fatura";
  const date = formatDateYmd(args.issuedAt);
  return toSafePathSegment(`FATURA - ${invoiceNumber} - ${date}`, "Fatura");
}

export function getInvoiceStorageDir(args: {
  tenantId: string;
  year: number;
  folderName: string;
}): string {
  // Fallback location when we can't compute a per-product destination.
  return path.join(
    process.cwd(),
    "storage",
    args.tenantId,
    String(args.year),
    "PRODUTOS",
    "SEM-PRODUTO",
    "FATURAS",
    args.folderName
  );
}

export function buildStoredFileName(args: {
  originalName: string;
  id: string;
}): string {
  const ext = path.extname(args.originalName).slice(0, 16);
  const base = path.basename(args.originalName, ext);
  const safeBase = toSafePathSegment(base, "file").slice(0, 80);
  return `${safeBase}-${args.id}${ext}`;
}
