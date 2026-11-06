/** Renovar el token cuando le quedan menos de 4 h (el servidor corta a los 7 días del login). */
export const REFRESH_BEFORE_MS = 4 * 60 * 60 * 1000;

/** Vencimiento (ms) de un JWT sin verificar la firma; null si no es un JWT legible. */
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function needsRefresh(token: string, now = Date.now()): boolean {
  const exp = tokenExpiresAt(token);
  return exp !== null && exp - now <= REFRESH_BEFORE_MS && exp > now;
}
