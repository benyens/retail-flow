// ============ Core Types ============

export interface Company {
  id: string;
  name: string;
  rut: string;
  address: string;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  address: string;
  isActive: boolean;
}

export interface CashRegister {
  id: string;
  branchId: string;
  name: string;
  code: string;
  isActive: boolean;
}

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string;
  cashRegisterId: string;
  userId: string;
  openedAt: string;
  closedAt?: string;
  initialFund: number;
  expectedCash: number;
  declaredCash?: number;
  difference?: number;
  status: CashSessionStatus;
  closingNotes?: string;
}

export type CashMovementType = 'IN' | 'OUT';
export type CashMovementConcept = 
  | 'WITHDRAW_TO_SAFE' 
  | 'PETTY_CASH_EXPENSE' 
  | 'ADVANCE_EMPLOYEE' 
  | 'BONUS_AGUINALDO' 
  | 'REFUND_CUSTOMER' 
  | 'OTHER';

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  concept: CashMovementConcept;
  amount: number;
  reason: string;
  employeeId?: string;
  authorizedBy?: string;
  createdAt: string;
}

// ============ Users & Auth ============

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface User {
  id: string;
  email: string;
  name: string;
  rut: string;
  role: UserRole;
  branchIds: string[];
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// ============ Employee ============

export interface Employee {
  id: string;
  branchId: string;
  name: string;
  rut: string;
  position: string;
  isActive: boolean;
}

export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  cashSessionId: string;
  cashMovementId: string;
  type: 'ADVANCE' | 'BONUS';
  amount: number;
  reason: string;
  createdAt: string;
}

// ============ Catalog ============

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  allowedBranchIds?: string[] | null;
} 

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}


export interface VariantGroup {
  id: string;
  name: string;
  description?: string;
}

export interface Variant {
  id: string;
  productId: string;
  variantGroupId: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  unit: string;
  barcode?: string;
  isActive: boolean;
  lastPurchaseCost?: number | null;
  lastPurchaseDate?: string | null;
}

export interface VariantWithProduct extends Variant {
  product: Product;
  variantGroup: VariantGroup;
}


export type QuickProductMode = "NEW_PRODUCT" | "ADD_VARIANT";

export interface SalesReportFilters {
  from: string;
  to: string;
  docType?: DocumentType;
  status?: DocumentStatus;
  query?: string;
}

export interface SalesReport {
  documents: SalesDocument[];
  grossSales: number;
  refunds: number;
  netSales: number;
  transactions: number;
  byPaymentMethod: Record<PaymentMethod, number>;
}

export interface AuditFilters {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  offset?: number;
}

export type QuickProductPayload = {
  mode: QuickProductMode;

  // NEW_PRODUCT
  productName?: string;         // requerido si mode=NEW_PRODUCT

  // ADD_VARIANT
  existingProductId?: string;   // requerido si mode=ADD_VARIANT

  // Ambos
  variantName?: string;         // default: "Única"
  sku?: string;
  barcode?: string;
  salePrice: number;            // ✅ obligatorio (lista normal)
  lastPurchaseCost?: number;
  unit?: string;                // "UN", "KG", etc.
  categoryId?: string | null;
};




// ============ Pricing ============

export type PriceListType = 'NORMAL' | 'MAYORISTA';

export interface PriceList {
  id: string;
  name: string;
  type: PriceListType;
}

export interface VariantPrice {
  id: string;
  variantId: string;
  priceListId: string;
  price: number;
}

export interface WholesaleTier {
  id: string;
  variantGroupId: string;
  priceListId: string;
  minQty: number;
  unitPrice: number;
}

// ============ Stock ============

export interface Stock {
  branchId: string;
  variantId: string;
  quantity: number;
  lastUpdated: string;
}

export type InventoryMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';

export interface InventoryMovement {
  id: string;
  branchId: string;
  type: InventoryMovementType;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface InventoryLine {
  id: string;
  movementId: string;
  variantId: string;
  quantity: number;
  previousStock: number;
  newStock: number;
}

// ============ Sales ============

export type DocumentType = 'BOLETA' | 'FACTURA' | 'CREDIT_NOTE';
export type DocumentStatus = 'PENDING_ISSUE' | 'ISSUED' | 'REJECTED' | 'VOID_INTERNAL';
export type PriceSource = 'NORMAL' | 'WHOLESALE' | 'MANUAL';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'OTHER';

export interface Customer {
  id: string;
  name: string;
  rut: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SalesDocument {
  id: string;
  branchId: string;
  cashSessionId: string;
  customerId?: string;
  docType: DocumentType;
  status: DocumentStatus;
  folio?: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  createdBy: string;
}

export interface SalesLine {
  id: string;
  salesDocumentId: string;
  variantId: string;
  variantGroupId: string;
  quantity: number;
  unitPrice: number;
  priceSource: PriceSource;
  wholesaleMinQtyApplied?: number;
  wholesaleUnitPriceApplied?: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  salesDocumentId: string;
  cashSessionId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  createdAt: string;
}

export type DTEStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export interface DTERequest {
  id: string;
  salesDocumentId: string;
  status: DTEStatus;
  providerName: string;
  providerExternalId?: string;
  folio?: string;
  siiTrackId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type RefType = 'ANULACION_TOTAL' | 'DEVOLUCION_PARCIAL' | 'CORRECCION_MONTO';

export interface SalesDocumentReference {
  id: string;
  creditNoteId: string;
  originalDocumentId: string;
  refType: RefType;
}

// ============ Cart (Frontend State) ============

export interface CartLine {
  id: string;
  variantId: string;
  variantGroupId: string;
  variant: VariantWithProduct;
  quantity: number;
  basePrice: number;
  unitPrice: number;
  priceSource: PriceSource;
  wholesaleMinQtyApplied?: number;
  wholesaleUnitPriceApplied?: number;
  subtotal: number;
}

export interface CartGroupSummary {
  variantGroupId: string;
  variantGroupName: string;
  totalQty: number;
  activeTier?: WholesaleTier;
  appliedUnitPrice: number;
  isWholesale: boolean;
}

export interface Cart {
  lines: CartLine[];
  groupSummaries: CartGroupSummary[];
  subtotal: number;
  tax: number;
  total: number;
}

// ============ Purchases ============

export interface Supplier {
  id: string;
  name: string;
  rut: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  businessLine?: string;
}

export type PurchaseInvoiceStatus = "DRAFT" | "SII_SENT" | "SII_ACCEPTED" | "SII_REJECTED";

export interface PurchaseInvoice {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;

  // ✅ NUEVO
  invoiceDate: string;        // "YYYY-MM-DD"
  notes?: string;

  subtotal: number;
  tax: number;
  total: number;

  // ✅ NUEVO (para editar antes de enviar a SII)
  status: PurchaseInvoiceStatus;
  siiTrackId?: string | null;
  lastError?: string | null;
  updatedAt: string;

  createdAt: string;
  createdBy: string;
}



export interface PurchaseLine {
  id: string;
  purchaseInvoiceId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}


// ============ Audit ============

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  createdAt: string;
}

// ============ Reports ============

export interface DailySalesReport {
  date: string;
  branchId: string;
  totalSales: number;
  totalTransactions: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  byDocType: Record<DocumentType, number>;
}

export interface CashSessionSummary {
  session: CashSession;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalOtherSales: number;
  movements: CashMovement[];
  expectedCash: number;
}
