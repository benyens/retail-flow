import type { CartLine, WholesaleTier, CartGroupSummary, PriceSource } from '@/types';

interface WholesaleInput {
  variantId: string;
  variantGroupId: string;
  quantity: number;
  basePrice: number;
}

interface WholesaleOutput {
  unitPrice: number;
  priceSource: PriceSource;
  wholesaleMinQtyApplied?: number;
  wholesaleUnitPriceApplied?: number;
}

interface GroupTotals {
  [variantGroupId: string]: {
    totalQty: number;
    lines: WholesaleInput[];
  };
}

/**
 * Calculate wholesale pricing for cart lines.
 * 
 * Rules:
 * 1. Sum qty by variant_group_id (even if different variants like aromas)
 * 2. Find active tier: largest min_qty <= total_qty
 * 3. Apply same unit_price to ALL lines in the group
 * 4. Recalculate automatically when qty changes
 */
export function calculateWholesalePricing(
  lines: WholesaleInput[],
  tiers: WholesaleTier[]
): Map<string, WholesaleOutput> {
  const results = new Map<string, WholesaleOutput>();
  
  // Group lines by variant_group_id
  const groupTotals: GroupTotals = {};
  
  for (const line of lines) {
    if (!groupTotals[line.variantGroupId]) {
      groupTotals[line.variantGroupId] = { totalQty: 0, lines: [] };
    }
    groupTotals[line.variantGroupId].totalQty += line.quantity;
    groupTotals[line.variantGroupId].lines.push(line);
  }
  
  // Process each group
  for (const [variantGroupId, group] of Object.entries(groupTotals)) {
    // Find tiers for this group (sorted by minQty descending)
    const groupTiers = tiers
      .filter(t => t.variantGroupId === variantGroupId)
      .sort((a, b) => b.minQty - a.minQty);
    
    // Find active tier: largest min_qty <= total_qty
    const activeTier = groupTiers.find(t => t.minQty <= group.totalQty);
    
    // Apply pricing to all lines in the group
    for (const line of group.lines) {
      if (activeTier) {
        results.set(`${line.variantId}`, {
          unitPrice: activeTier.unitPrice,
          priceSource: 'WHOLESALE',
          wholesaleMinQtyApplied: activeTier.minQty,
          wholesaleUnitPriceApplied: activeTier.unitPrice,
        });
      } else {
        results.set(`${line.variantId}`, {
          unitPrice: line.basePrice,
          priceSource: 'NORMAL',
        });
      }
    }
  }
  
  return results;
}

/**
 * Get summary of wholesale pricing per variant group
 */
export function getGroupSummaries(
  lines: CartLine[],
  tiers: WholesaleTier[]
): CartGroupSummary[] {
  const groupMap = new Map<string, {
    variantGroupName: string;
    totalQty: number;
    basePrice: number;
  }>();
  
  // Aggregate by group
  for (const line of lines) {
    const existing = groupMap.get(line.variantGroupId);
    if (existing) {
      existing.totalQty += line.quantity;
    } else {
      groupMap.set(line.variantGroupId, {
        variantGroupName: line.variant.variantGroup.name,
        totalQty: line.quantity,
        basePrice: line.basePrice,
      });
    }
  }
  
  // Calculate summaries
  const summaries: CartGroupSummary[] = [];
  
  for (const [variantGroupId, group] of groupMap) {
    const groupTiers = tiers
      .filter(t => t.variantGroupId === variantGroupId)
      .sort((a, b) => b.minQty - a.minQty);
    
    const activeTier = groupTiers.find(t => t.minQty <= group.totalQty);
    
    summaries.push({
      variantGroupId,
      variantGroupName: group.variantGroupName,
      totalQty: group.totalQty,
      activeTier,
      appliedUnitPrice: activeTier ? activeTier.unitPrice : group.basePrice,
      isWholesale: !!activeTier,
    });
  }
  
  return summaries;
}

/**
 * Get next tier info for a group (for UI hints)
 */
export function getNextTierInfo(
  variantGroupId: string,
  currentQty: number,
  tiers: WholesaleTier[]
): { nextTier: WholesaleTier; qtyNeeded: number } | null {
  const groupTiers = tiers
    .filter(t => t.variantGroupId === variantGroupId)
    .sort((a, b) => a.minQty - b.minQty);
  
  const nextTier = groupTiers.find(t => t.minQty > currentQty);
  
  if (nextTier) {
    return {
      nextTier,
      qtyNeeded: nextTier.minQty - currentQty,
    };
  }
  
  return null;
}

/**
 * Apply wholesale pricing to cart lines and return updated cart
 */
export function applyWholesalePricing(
  lines: CartLine[],
  tiers: WholesaleTier[]
): CartLine[] {
  const inputs: WholesaleInput[] = lines.map(l => ({
    variantId: l.variantId,
    variantGroupId: l.variantGroupId,
    quantity: l.quantity,
    basePrice: l.basePrice,
  }));
  
  const pricingResults = calculateWholesalePricing(inputs, tiers);
  
  return lines.map(line => {
    const pricing = pricingResults.get(line.variantId);
    if (pricing) {
      return {
        ...line,
        unitPrice: pricing.unitPrice,
        priceSource: pricing.priceSource,
        wholesaleMinQtyApplied: pricing.wholesaleMinQtyApplied,
        wholesaleUnitPriceApplied: pricing.wholesaleUnitPriceApplied,
        subtotal: line.quantity * pricing.unitPrice,
      };
    }
    return line;
  });
}
