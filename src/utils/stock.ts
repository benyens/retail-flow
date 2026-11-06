import type { Stock } from '@/types';

/** Por reponer: tiene mínimo definido y la cantidad está en el mínimo o bajo él. */
export const isLowStock = (s: Pick<Stock, 'quantity' | 'minQuantity'>) =>
  s.minQuantity != null && s.quantity <= s.minQuantity;
