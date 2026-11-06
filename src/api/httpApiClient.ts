import type {
  LoginCredentials, LoginResponse, Branch, CashRegister, CashSession, CashMovement, CashMovementType,
  CashMovementConcept, Product, Variant, VariantGroup, VariantWithProduct, VariantPrice, WholesaleTier,
  Stock, InventoryMovement, InventoryLine, SalesDocument, SalesLine, Payment, DTERequest, Customer,
  Supplier, PurchaseInvoice, PurchaseLine, Employee, EmployeeAdvance, User, AuditLog, DailySalesReport,
  CashSessionSummary, DocumentType, PaymentMethod, RefType, ProductCategory, QuickProductPayload,
} from "@/types";
import type { ApiClient } from "./client";

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
// Acepta la URL con o sin barra final y con o sin /api/v1.
export const API_ORIGIN = (RAW_API_BASE || "http://localhost:3000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
const API_BASE = `${API_ORIGIN}/api/v1`;
import { needsRefresh } from "@/utils/session";

const TOKEN_STORAGE_KEY = "auth_token";

class HttpError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) { super(message); }
}

/** Primer mensaje legible de un error de validación (zod `flatten()`), para no mostrar "Error 422". */
function validationMessage(data: unknown): string | undefined {
  const issues = (data as { issues?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } } | undefined)?.issues;
  if (!issues) return undefined;
  if (issues.formErrors?.[0]) return issues.formErrors[0];
  const [field, errors] = Object.entries(issues.fieldErrors ?? {}).find(([, v]) => v && v.length > 0) ?? [];
  return field && errors ? `Revisa el campo «${field}»: ${errors[0]}` : "Revisa los datos ingresados";
}

// Renovación silenciosa: mientras se usa la app, si el token está por vencer se pide
// uno nuevo en segundo plano (ver utils/session.ts).
let refreshing: Promise<void> | null = null;

export function maybeRefresh(token: string) {
  if (refreshing || !needsRefresh(token)) return;
  refreshing = post<LoginResponse>("/auth/refresh")
    .then((res) => {
      // Solo si nadie cerró o cambió la sesión mientras tanto.
      if (localStorage.getItem(TOKEN_STORAGE_KEY) !== token) return;
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      window.dispatchEvent(new CustomEvent("auth:refreshed", { detail: res }));
    })
    .catch(() => undefined) // si falla, el token actual sigue valiendo hasta su vencimiento
    .finally(() => { refreshing = null; });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers: Record<string, string> = {
    ...(options.body != null ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!RAW_API_BASE && import.meta.env.PROD) {
    throw new HttpError("Falta VITE_API_BASE_URL en el build. En Vercel: Settings > Environment Variables, agrégala y vuelve a desplegar.", 0);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new HttpError("No se pudo conectar con el servidor. Si es la primera vez en un rato, está despertando (hasta ~1 min): reintenta. Si persiste, revisa CORS_ORIGINS en Render.", 0);
  }
  // Sesión vencida, revocada o invalidada por cambio de contraseña: avisar a la app
  // para que vuelva al login en vez de quedar con una UI "logueada" que no funciona.
  // El login fallido también es 401, pero ahí no hay sesión que cerrar.
  if (res.status === 401 && token && !path.startsWith("/auth/login") && !path.startsWith("/auth/logout")) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
  if (res.ok && token && !path.startsWith("/auth/")) maybeRefresh(token);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new HttpError(data?.message ?? validationMessage(data) ?? `Error ${res.status}`, res.status, data);
  return data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

function stringify(params: object): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === undefined || v === "" ? undefined : String(v)]));
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

export class HttpApiClient implements ApiClient {
  getPriceLists(): Promise<import('@/types').PriceList[]> { return get('/price-lists'); }
  getSalesReport(branchId: string, filters: import('@/types').SalesReportFilters): Promise<import('@/types').SalesReport> {
    return get(`/reports/sales${qs({ branchId, ...stringify(filters) })}`);
  }
  getDashboard(branchId: string): Promise<import('@/types').Dashboard> { return get(`/reports/dashboard${qs({ branchId })}`); }
  getOverview(): Promise<import('@/types').Overview> { return get("/reports/overview"); }
  searchPurchases(branchId: string, filters: import('@/types').PurchaseSearchFilters): Promise<import('@/types').PurchaseSearchResult> {
    return get(`/purchases/search${qs({ branchId, ...stringify(filters) })}`);
  }
  async login(credentials: LoginCredentials): Promise<LoginResponse> { return post<LoginResponse>("/auth/login", credentials); }
  async logout(): Promise<void> { await post<void>("/auth/logout"); }
  refreshToken(): Promise<LoginResponse> { return post<LoginResponse>("/auth/refresh"); }
  changePassword(currentPassword: string, newPassword: string): Promise<{ token: string }> {
    return post<{ token: string }>("/auth/change-password", { currentPassword, newPassword });
  }

  getBranches(): Promise<Branch[]> { return get<Branch[]>("/branches"); }
  getCashRegisters(branchId: string): Promise<CashRegister[]> { return get<CashRegister[]>(`/cash-registers${qs({ branchId })}`); }
  getCompany(): Promise<import('@/types').Company> { return get("/company"); }
  updateCompany(p: Partial<Omit<import('@/types').Company, 'id'>>): Promise<import('@/types').Company> { return patch("/company", p); }
  listAllBranches(): Promise<import('@/types').BranchWithRegisters[]> { return get("/organization/branches"); }
  createBranch(input: { name: string; address: string }): Promise<import('@/types').BranchWithRegisters> { return post("/organization/branches", input); }
  updateBranch(id: string, p: Partial<{ name: string; address: string; isActive: boolean }>): Promise<import('@/types').BranchWithRegisters> { return patch(`/organization/branches/${id}`, p); }
  createCashRegister(branchId: string, input: { name: string; code: string }): Promise<CashRegister> { return post(`/organization/branches/${branchId}/registers`, input); }
  updateCashRegister(id: string, p: Partial<{ name: string; code: string; isActive: boolean }>): Promise<CashRegister> { return patch(`/organization/registers/${id}`, p); }

  openCashSession(cashRegisterId: string, initialFund: number): Promise<CashSession> { return post<CashSession>("/cash-sessions", { cashRegisterId, initialFund }); }
  getOpenSessions(branchId: string): Promise<import('@/types').OpenCashSession[]> { return get(`/cash-sessions/open${qs({ branchId })}`); }
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
  setMinStock(branchId: string, variantId: string, minQuantity: number | null): Promise<Stock> { return put<Stock>("/stock/minimum", { branchId, variantId, minQuantity }); }
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
  getReceipt(saleId: string): Promise<import('@/types').Receipt> { return get(`/sales/${saleId}/receipt`); }
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
  async resetUserPassword(userId: string, newPassword: string): Promise<void> { await post<void>(`/users/${userId}/password`, { newPassword }); }

  getDailySalesReport(branchId: string, date: string): Promise<DailySalesReport> { return get<DailySalesReport>(`/reports/daily-sales${qs({ branchId, date })}`); }

  getAuditLogs(entityType?: string, entityId?: string, filters: import('@/types').AuditFilters = {}): Promise<AuditLog[]> {
    return get(`/audit-logs${qs({ entityType, entityId, ...filters, offset: filters.offset?.toString() })}`);
  }
}
