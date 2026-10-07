import type {
  LoginCredentials, LoginResponse, Branch, CashRegister, CashSession, CashMovement, CashMovementType,
  CashMovementConcept, Product, Variant, VariantGroup, VariantWithProduct, VariantPrice, WholesaleTier,
  Stock, InventoryMovement, InventoryLine, SalesDocument, SalesLine, Payment, DTERequest, Customer,
  Supplier, PurchaseInvoice, PurchaseLine, Employee, EmployeeAdvance, User, AuditLog, DailySalesReport,
  CashSessionSummary, DocumentType, PaymentMethod, RefType, ProductCategory, QuickProductPayload,
} from "@/types";
import type { ApiClient } from "./client";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1`;
const TOKEN_STORAGE_KEY = "auth_token";

class HttpError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers: Record<string, string> = {
    ...(options.body != null ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new HttpError(data?.message ?? `Error ${res.status}`, res.status, data);
  return data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

export class HttpApiClient implements ApiClient {
  getPriceLists(): Promise<import('@/types').PriceList[]> { return get('/price-lists'); }
  getSalesReport(branchId: string, filters: import('@/types').SalesReportFilters): Promise<import('@/types').SalesReport> {
    return get(`/reports/sales${qs({ branchId, ...filters })}`);
  }
  async login(credentials: LoginCredentials): Promise<LoginResponse> { return post<LoginResponse>("/auth/login", credentials); }
  async logout(): Promise<void> { await post<void>("/auth/logout"); }

  getBranches(): Promise<Branch[]> { return get<Branch[]>("/branches"); }
  getCashRegisters(branchId: string): Promise<CashRegister[]> { return get<CashRegister[]>(`/cash-registers${qs({ branchId })}`); }

  openCashSession(cashRegisterId: string, initialFund: number): Promise<CashSession> { return post<CashSession>("/cash-sessions", { cashRegisterId, initialFund }); }
  getCurrentSession(cashRegisterId: string): Promise<CashSession | null> { return get<CashSession | null>(`/cash-sessions/current${qs({ cashRegisterId })}`); }
  closeCashSession(sessionId: string, declaredCash: number, notes?: string): Promise<CashSession> { return post<CashSession>(`/cash-sessions/${sessionId}/close`, { declaredCash, notes }); }
  getSessionSummary(sessionId: string): Promise<CashSessionSummary> { return get<CashSessionSummary>(`/cash-sessions/${sessionId}/summary`); }

  createCashMovement(sessionId: string, type: CashMovementType, concept: CashMovementConcept, amount: number, reason: string, employeeId?: string): Promise<CashMovement> {
    return post<CashMovement>(`/cash-sessions/${sessionId}/movements`, { type, concept, amount, reason, employeeId });
  }
  getSessionMovements(sessionId: string): Promise<CashMovement[]> { return get<CashMovement[]>(`/cash-sessions/${sessionId}/movements`); }

  getProducts(): Promise<Product[]> { return get<Product[]>("/products"); }
  createProduct(product: Omit<Product, "id">): Promise<Product> { return post<Product>("/products", product); }
  updateProduct(id: string, product: Partial<Product>): Promise<Product> { return patch<Product>(`/products/${id}`, product); }
  deleteProduct(id: string): Promise<void> { return del<void>(`/products/${id}`); }
  createQuickProduct(payload: QuickProductPayload): Promise<VariantWithProduct> { return post<VariantWithProduct>("/products/quick", payload); }

  getVariantGroups(): Promise<VariantGroup[]> { return get<VariantGroup[]>("/variant-groups"); }
  createVariantGroup(group: Omit<VariantGroup, "id">): Promise<VariantGroup> { return post<VariantGroup>("/variant-groups", group); }
  updateVariantGroup(id: string, group: Partial<VariantGroup>): Promise<VariantGroup> { return patch<VariantGroup>(`/variant-groups/${id}`, group); }
  deleteVariantGroup(id: string): Promise<void> { return del<void>(`/variant-groups/${id}`); }

  getVariants(branchId?: string): Promise<VariantWithProduct[]> { return get<VariantWithProduct[]>(`/variants${qs({ branchId })}`); }
  createVariant(variant: Omit<Variant, "id">): Promise<Variant> { return post<Variant>("/variants", variant); }
  updateVariant(id: string, variant: Partial<Variant>): Promise<Variant> { return patch<Variant>(`/variants/${id}`, variant); }
  deleteVariant(id: string): Promise<void> { return del<void>(`/variants/${id}`); }
  searchVariants(query: string): Promise<VariantWithProduct[]> { return get<VariantWithProduct[]>(`/variants/search${qs({ q: query })}`); }

  getProductCategories(): Promise<ProductCategory[]> { return get<ProductCategory[]>("/product-categories"); }
  createProductCategory(category: Omit<ProductCategory, "id">): Promise<ProductCategory> { return post<ProductCategory>("/product-categories", category); }
  updateProductCategory(id: string, category: Partial<ProductCategory>): Promise<ProductCategory> { return patch<ProductCategory>(`/product-categories/${id}`, category); }
  deleteProductCategory(id: string): Promise<void> { return del<void>(`/product-categories/${id}`); }

  getVariantPrices(): Promise<VariantPrice[]> { return get<VariantPrice[]>("/variant-prices"); }
  setVariantPrice(variantId: string, priceListId: string, price: number): Promise<VariantPrice> { return put<VariantPrice>("/variant-prices", { variantId, priceListId, price }); }

  getWholesaleTiers(): Promise<WholesaleTier[]> { return get<WholesaleTier[]>("/wholesale-tiers"); }
  createWholesaleTier(tier: Omit<WholesaleTier, "id">): Promise<WholesaleTier> { return post<WholesaleTier>("/wholesale-tiers", tier); }
  updateWholesaleTier(id: string, tier: Partial<WholesaleTier>): Promise<WholesaleTier> { return patch<WholesaleTier>(`/wholesale-tiers/${id}`, tier); }
  deleteWholesaleTier(id: string): Promise<void> { return del<void>(`/wholesale-tiers/${id}`); }

  getStock(branchId: string): Promise<Stock[]> { return get<Stock[]>(`/stock${qs({ branchId })}`); }
  getInventoryMovements(branchId: string): Promise<InventoryMovement[]> { return get<InventoryMovement[]>(`/inventory-movements${qs({ branchId })}`); }
  getInventoryLines(movementId: string): Promise<InventoryLine[]> { return get<InventoryLine[]>(`/inventory-lines/${movementId}`); }
  createAdjustment(branchId: string, variantId: string, quantity: number, notes: string): Promise<InventoryMovement> { return post<InventoryMovement>("/stock/adjustments", { branchId, variantId, quantity, notes }); }
  getStockByVariant(variantId: string): Promise<{ branchId: string; branchName: string; quantity: number }[]> { return get(`/stock/by-variant/${variantId}`); }

  getCustomers(): Promise<Customer[]> { return get<Customer[]>("/customers"); }
  createCustomer(customer: Omit<Customer, "id">): Promise<Customer> { return post<Customer>("/customers", customer); }
  updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> { return patch<Customer>(`/customers/${id}`, customer); }
  searchCustomers(query: string): Promise<Customer[]> { return get<Customer[]>(`/customers/search${qs({ q: query })}`); }

  createSale(
    branchId: string, sessionId: string, customerId: string | null, docType: DocumentType,
    lines: Omit<SalesLine, "id" | "salesDocumentId">[], payments: Omit<Payment, "id" | "salesDocumentId" | "cashSessionId" | "createdAt">[],
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }> {
    return post("/sales", { branchId, sessionId, customerId, docType, lines, payments });
  }
  getSales(branchId: string, sessionId?: string): Promise<SalesDocument[]> { return get<SalesDocument[]>(`/sales${qs({ branchId, sessionId })}`); }
  getSaleDetail(saleId: string): Promise<{ document: SalesDocument; lines: SalesLine[]; payments: Payment[]; dte: DTERequest | null }> { return get(`/sales/${saleId}`); }
  voidSaleInternal(saleId: string, reason: string): Promise<SalesDocument> { return post<SalesDocument>(`/sales/${saleId}/void`, { reason }); }

  createCreditNote(
    originalSaleId: string, refType: RefType, lines: { variantId: string; quantity: number }[], refundMethod: PaymentMethod,
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }> {
    return post("/sales/credit-notes", { originalSaleId, refType, lines, refundMethod });
  }
  retryDTE(dteRequestId: string): Promise<DTERequest> { return post<DTERequest>(`/dte-requests/${dteRequestId}/retry`); }

  getSuppliers(): Promise<Supplier[]> { return get<Supplier[]>("/suppliers"); }
  createSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier> { return post<Supplier>("/suppliers", supplier); }
  updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier> { return patch<Supplier>(`/suppliers/${id}`, supplier); }

  getPurchases(branchId: string): Promise<PurchaseInvoice[]> { return get<PurchaseInvoice[]>(`/purchases${qs({ branchId })}`); }
  createPurchase(
    branchId: string, supplierId: string, invoiceNumber: string, invoiceDate: string, notes: string,
    lines: { variantId: string; quantity: number; unitCost: number }[],
  ): Promise<PurchaseInvoice> {
    return post<PurchaseInvoice>("/purchases", { branchId, supplierId, invoiceNumber, invoiceDate, notes, lines });
  }
  updatePurchaseInvoice(id: string, patchBody: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> { return patch<PurchaseInvoice>(`/purchases/${id}`, patchBody); }
  sendPurchaseInvoiceToSII(id: string): Promise<PurchaseInvoice> { return post<PurchaseInvoice>(`/purchases/${id}/send-sii`); }
  getPurchaseLines(purchaseInvoiceId: string): Promise<PurchaseLine[]> { return get<PurchaseLine[]>(`/purchases/${purchaseInvoiceId}/lines`); }

  getEmployees(branchId: string): Promise<Employee[]> { return get<Employee[]>(`/employees${qs({ branchId })}`); }
  createEmployee(employee: Omit<Employee, "id">): Promise<Employee> { return post<Employee>("/employees", employee); }
  updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> { return patch<Employee>(`/employees/${id}`, employee); }
  getEmployeeAdvances(employeeId: string): Promise<EmployeeAdvance[]> { return get<EmployeeAdvance[]>(`/employees/${employeeId}/advances`); }

  getUsers(): Promise<User[]> { return get<User[]>("/users"); }
  createUser(user: Omit<User, "id"> & { password: string }): Promise<User> { return post<User>("/users", user); }
  updateUser(id: string, user: Partial<User>): Promise<User> { return patch<User>(`/users/${id}`, user); }

  getDailySalesReport(branchId: string, date: string): Promise<DailySalesReport> { return get<DailySalesReport>(`/reports/daily-sales${qs({ branchId, date })}`); }

  getAuditLogs(entityType?: string, entityId?: string, filters: import('@/types').AuditFilters = {}): Promise<AuditLog[]> {
    return get(`/audit-logs${qs({ entityType, entityId, ...filters, offset: filters.offset?.toString() })}`);
  }
}
