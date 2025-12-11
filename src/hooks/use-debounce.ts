
import { useEffect, useState } from 'react';

/**
 * Devuelve una versión "debounced" de un valor.
 * Útil para búsquedas: el valor solo cambia después de X ms sin teclear.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
