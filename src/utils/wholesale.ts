import type { Cart, CartLine, CartGroupSummary, WholesaleTier } from "@/types";

const VAT_RATE = 0.19;
const roundClp = (n: number) => Math.round(n);

/**
 * Elegir tramo activo: el de mayor minQty <= totalQty
 */
function pickActiveTier(groupTiers: WholesaleTier[], totalQty: number) {
  let active: WholesaleTier | undefined;
  for (const t of groupTiers) {
    if (t.minQty <= totalQty) active = t;
    else break;
  }
  return active;
}

/**
 * Recalcula TODO el carrito:
 * - suma cantidades por grupo de equivalencia
 * - elige tramo mayorista por grupo
 * - aplica precios (respeta MANUAL)
 * - calcula neto/iva/total asumiendo que los precios YA incluyen IVA
 */
export function recalculateCart(lines: CartLine[], wholesaleTiers: WholesaleTier[]): Cart {
  // Index de tramos por grupo
  const tiersByGroup = new Map<string, WholesaleTier[]>();
  for (const t of wholesaleTiers) {
    const arr = tiersByGroup.get(t.variantGroupId) ?? [];
    arr.push(t);
    tiersByGroup.set(t.variantGroupId, arr);
  }
  for (const [gid, arr] of tiersByGroup.entries()) {
    arr.sort((a, b) => a.minQty - b.minQty);
    tiersByGroup.set(gid, arr);
  }

  // Cantidad total por grupo
  const qtyByGroup = new Map<string, number>();
  for (const l of lines) {
    qtyByGroup.set(l.variantGroupId, (qtyByGroup.get(l.variantGroupId) ?? 0) + l.quantity);
  }

  // Tramo activo por grupo
  const activeTierByGroup = new Map<string, WholesaleTier | undefined>();
  for (const [gid, totalQty] of qtyByGroup.entries()) {
    const groupTiers = tiersByGroup.get(gid) ?? [];
    activeTierByGroup.set(gid, pickActiveTier(groupTiers, totalQty));
  }

  // Aplicar precios línea a línea
  const newLines: CartLine[] = lines.map((l) => {
    if (l.priceSource === "MANUAL") {
      return { ...l, subtotal: roundClp(l.unitPrice * l.quantity) };
    }

    const activeTier = activeTierByGroup.get(l.variantGroupId);
    if (activeTier) {
      const unitPrice = activeTier.unitPrice;
      return {
        ...l,
        unitPrice,
        priceSource: "WHOLESALE",
        wholesaleMinQtyApplied: activeTier.minQty,
        wholesaleUnitPriceApplied: activeTier.unitPrice,
        subtotal: roundClp(unitPrice * l.quantity),
      };
    }

    // Sin tramo -> precio normal
    const unitPrice = l.basePrice;
    return {
      ...l,
      unitPrice,
      priceSource: "NORMAL",
      wholesaleMinQtyApplied: undefined,
      wholesaleUnitPriceApplied: undefined,
      subtotal: roundClp(unitPrice * l.quantity),
    };
  });

  // Resumen por grupo (para panel mayorista)
  const groupSummaries: CartGroupSummary[] = [];
  for (const [gid, totalQty] of qtyByGroup.entries()) {
    const sample = newLines.find((x) => x.variantGroupId === gid);
    const activeTier = activeTierByGroup.get(gid);
    const isWholesale = Boolean(activeTier);

    groupSummaries.push({
      variantGroupId: gid,
      variantGroupName: sample?.variant?.variantGroup?.name ?? "Grupo",
      totalQty,
      activeTier,
      appliedUnitPrice: isWholesale
        ? activeTier?.unitPrice ?? 0
        : sample?.basePrice ?? 0,
      isWholesale,
    });
  }

  // Total bruto (precios ya vienen con IVA incluido)
  const total = newLines.reduce((acc, l) => acc + (l.subtotal ?? 0), 0);

  // Desglosar neto + IVA desde total
  const net = Math.round(total / (1 + VAT_RATE));
  const tax = total - net;

  return {
    lines: newLines,
    groupSummaries,
    subtotal: net, // Neto
    tax,           // IVA incluido
    total,         // Total IVA incl.
  };
}
