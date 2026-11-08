import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Lista de precios de venta de una sucursal: la asignada, o la lista NORMAL por
 * defecto. Es la que cobra el POS y la que define qué productos se ven en el local.
 */
export async function branchPriceListId(db: Db, branchId: string): Promise<string> {
  const branch = await db.branch.findUnique({ where: { id: branchId }, select: { priceListId: true } });
  if (branch?.priceListId) return branch.priceListId;
  const fallback = await db.priceList.findFirst({ where: { type: "NORMAL", isDefault: true }, select: { id: true } })
    ?? await db.priceList.findFirst({ where: { type: "NORMAL" }, orderBy: { id: "asc" }, select: { id: true } });
  if (!fallback) throw new Error("No existe una lista de precios NORMAL (falta correr el seed)");
  return fallback.id;
}
