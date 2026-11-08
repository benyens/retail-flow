import type { Branch, PriceList } from '@/types';

/** Lista de venta de un local: la asignada o la NORMAL por defecto (igual que el servidor). */
export function branchPriceListId(branch: Pick<Branch, 'priceListId'> | null | undefined, lists: PriceList[]): string | undefined {
  if (branch?.priceListId && lists.some(l => l.id === branch.priceListId)) return branch.priceListId;
  const normal = lists.filter(l => l.type === 'NORMAL');
  return (normal.find(l => l.isDefault) ?? normal[0])?.id;
}
