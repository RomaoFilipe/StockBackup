export const OPEN_REQUEST_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED"] as const;

export async function getReservedUnitCodes(
  prismaLike: any,
  args: {
    tenantId: string;
    productId: string;
    excludeRequestId?: string | null;
  }
): Promise<string[]> {
  const rows = await prismaLike.requestItem.findMany({
    where: {
      productId: args.productId,
      role: { not: "OLD" },
      OR: [{ destination: { not: null } }, { reservedUnitId: { not: null } }],
      request: {
        tenantId: args.tenantId,
        status: { in: [...OPEN_REQUEST_STATUSES] },
        ...(args.excludeRequestId ? { id: { not: args.excludeRequestId } } : {}),
      },
    },
    select: { destination: true, reservedUnit: { select: { code: true } } },
  });

  return Array.from(
    new Set(
      rows
        .map((row: { destination: string | null; reservedUnit?: { code: string } | null }) =>
          (row.reservedUnit?.code ?? row.destination ?? "").trim()
        )
        .filter(Boolean)
    )
  );
}

export function mergeExcludedUnitCodes(...groups: Array<Array<string | null | undefined> | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .map((code) => (code ?? "").trim())
        .filter(Boolean)
    )
  );
}

export type ReservableRequestItem = {
  productId: string;
  quantity: number;
  notes?: string | null;
  unit?: string | null;
  reference?: string | null;
  destination?: string | null;
  reservedUnitId?: string | null;
  role?: "NORMAL" | "OLD" | "NEW";
};

function cleanOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function normalizeRequestItemsForUnitReservations(
  prismaLike: any,
  args: {
    tenantId: string;
    items: ReservableRequestItem[];
    unitCountByProductId: Map<string, number>;
    excludeRequestId?: string | null;
  }
): Promise<ReservableRequestItem[]> {
  const selectedCodesByProductId = new Map<string, Set<string>>();
  const normalized: ReservableRequestItem[] = [];

  for (const rawItem of args.items) {
    const quantity = Number(rawItem.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid quantity");
    }

    const role = rawItem.role ?? "NORMAL";
    const item: ReservableRequestItem = {
      ...rawItem,
      quantity,
      notes: cleanOptionalText(rawItem.notes),
      unit: cleanOptionalText(rawItem.unit),
      reference: cleanOptionalText(rawItem.reference),
      destination: cleanOptionalText(rawItem.destination),
      role,
    };

    const isUnitTracked = (args.unitCountByProductId.get(item.productId) ?? 0) > 0;
    if (!isUnitTracked || role === "OLD") {
      normalized.push(item);
      continue;
    }

    const requestedCode = typeof item.destination === "string" ? item.destination.trim() : "";
    const selectedCodes = selectedCodesByProductId.get(item.productId) ?? new Set<string>();
    const reservedCodes = await getReservedUnitCodes(prismaLike, {
      tenantId: args.tenantId,
      productId: item.productId,
      excludeRequestId: args.excludeRequestId,
    });

    if (requestedCode) {
      if (quantity !== 1) {
        throw new Error("Para produtos com QR e código já escolhido, use Qtd=1 por linha.");
      }
      if (selectedCodes.has(requestedCode)) {
        throw new Error("A mesma unidade QR não pode ser usada em duas linhas do pedido.");
      }
      if (reservedCodes.includes(requestedCode)) {
        throw new Error("Esta unidade QR já está reservada noutro pedido aberto.");
      }

      const unit = await prismaLike.productUnit.findFirst({
        where: {
          tenantId: args.tenantId,
          productId: item.productId,
          code: requestedCode,
          status: "IN_STOCK",
        },
        select: { id: true, code: true },
      });
      if (!unit) {
        throw new Error("Sem unidades em stock suficientes para um dos produtos selecionados.");
      }

      selectedCodes.add(requestedCode);
      selectedCodesByProductId.set(item.productId, selectedCodes);
      normalized.push({ ...item, quantity: 1, destination: requestedCode, reservedUnitId: unit.id });
      continue;
    }

    const excludedCodes = mergeExcludedUnitCodes(reservedCodes, Array.from(selectedCodes));
    const units = await prismaLike.productUnit.findMany({
      where: {
        tenantId: args.tenantId,
        productId: item.productId,
        status: "IN_STOCK",
        ...(excludedCodes.length ? { code: { notIn: excludedCodes } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: quantity,
      select: { id: true, code: true },
    });

    if (units.length < quantity) {
      throw new Error("Sem unidades em stock suficientes para um dos produtos selecionados.");
    }

    for (const unit of units) {
      selectedCodes.add(unit.code);
      normalized.push({ ...item, quantity: 1, destination: unit.code, reservedUnitId: unit.id });
    }
    selectedCodesByProductId.set(item.productId, selectedCodes);
  }

  return normalized;
}
