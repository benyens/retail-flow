/**
 * Format number as Chilean peso currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format Chilean RUT with dots and dash
 */
export function formatRut(rut: string): string {
  const cleaned = rut.replace(/[^0-9kK]/g, '');
  if (cleaned.length < 2) return cleaned;
  
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1).toUpperCase();
  
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

/**
 * Validate Chilean RUT
 */
export function validateRut(rut: string): boolean {
  const cleaned = rut.replace(/[^0-9kK]/g, '');
  if (cleaned.length < 2) return false;
  
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1).toUpperCase();
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDv = 11 - (sum % 11);
  const expectedDvChar = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
  
  return dv === expectedDvChar;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format time for display
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Generate a simple ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get document type label
 */
export function getDocTypeLabel(docType: string): string {
  const labels: Record<string, string> = {
    BOLETA: 'Boleta',
    FACTURA: 'Factura',
    CREDIT_NOTE: 'Nota de Crédito',
  };
  return labels[docType] || docType;
}

/**
 * Get document status label and color
 */
export function getDocStatusInfo(status: string): { label: string; color: string } {
  const info: Record<string, { label: string; color: string }> = {
    PENDING_ISSUE: { label: 'Pendiente', color: 'warning' },
    ISSUED: { label: 'Emitida', color: 'success' },
    REJECTED: { label: 'Rechazada', color: 'destructive' },
    VOID_INTERNAL: { label: 'Anulada', color: 'muted' },
  };
  return info[status] || { label: status, color: 'muted' };
}

/**
 * Get payment method label
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    OTHER: 'Otro',
  };
  return labels[method] || method;
}

/**
 * Get cash movement concept label
 */
export function getCashMovementConceptLabel(concept: string): string {
  const labels: Record<string, string> = {
    WITHDRAW_TO_SAFE: 'Retiro a Bóveda',
    PETTY_CASH_EXPENSE: 'Gasto Menor',
    ADVANCE_EMPLOYEE: 'Adelanto Trabajador',
    BONUS_AGUINALDO: 'Aguinaldo',
    REFUND_CUSTOMER: 'Reembolso Cliente',
    OTHER: 'Otro',
  };
  return labels[concept] || concept;
}
