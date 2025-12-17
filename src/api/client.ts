import type {
  LoginCredentials,
  LoginResponse,
  Branch,
  CashRegister,
  CashSession,
  CashMovement,
  CashMovementType,
  CashMovementConcept,
  Product,
  Variant,
  VariantGroup,
  VariantWithProduct,
  VariantPrice,
  WholesaleTier,
  Stock,
  InventoryMovement,
  InventoryLine,
  SalesDocument,
  SalesLine,
  Payment,
  DTERequest,
  Customer,
  Supplier,
  PurchaseInvoice,
  PurchaseLine,
  Employee,
  EmployeeAdvance,
  User,
  AuditLog,
  DailySalesReport,
  CashSessionSummary,
  DocumentType,
  PaymentMethod,
  RefType,
  ProductCategory,
  QuickProductPayload,
} from '@/types';

// ============ API Client Interface ============

export interface ApiClient {
  // Auth
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  logout(): Promise<void>;
  
  // Branches & Cash Registers
  getBranches(): Promise<Branch[]>;
  getCashRegisters(branchId: string): Promise<CashRegister[]>;
  
  // Cash Sessions
  openCashSession(cashRegisterId: string, initialFund: number): Promise<CashSession>;
  closeCashSession(sessionId: string, declaredCash: number, notes?: string): Promise<CashSession>;
  getCurrentSession(cashRegisterId: string): Promise<CashSession | null>;
  getSessionSummary(sessionId: string): Promise<CashSessionSummary>;
  
  // Cash Movements
  createCashMovement(
    sessionId: string,
    type: CashMovementType,
    concept: CashMovementConcept,
    amount: number,
    reason: string,
    employeeId?: string
  ): Promise<CashMovement>;
  getSessionMovements(sessionId: string): Promise<CashMovement[]>;
  
  // Catalog
  getProducts(): Promise<Product[]>;
  createProduct(product: Omit<Product, 'id'>): Promise<Product>;
  updateProduct(id: string, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  createQuickProduct(payload: QuickProductPayload): Promise<VariantWithProduct>;
  
  getVariantGroups(): Promise<VariantGroup[]>;
  createVariantGroup(group: Omit<VariantGroup, 'id'>): Promise<VariantGroup>;
  updateVariantGroup(id: string, group: Partial<VariantGroup>): Promise<VariantGroup>;
  deleteVariantGroup(id: string): Promise<void>;
  
  getVariants(branchId?: string): Promise<VariantWithProduct[]>;
  createVariant(variant: Omit<Variant, 'id'>): Promise<Variant>;
  updateVariant(id: string, variant: Partial<Variant>): Promise<Variant>;
  deleteVariant(id: string): Promise<void>;
  searchVariants(query: string): Promise<VariantWithProduct[]>;
  

  // Product categories
  getProductCategories(): Promise<ProductCategory[]>;
  createProductCategory(category: Omit<ProductCategory, 'id'>): Promise<ProductCategory>;
  updateProductCategory(id: string, category: Partial<ProductCategory>): Promise<ProductCategory>;
  deleteProductCategory(id: string): Promise<void>;

  // Pricing
  getVariantPrices(): Promise<VariantPrice[]>;
  setVariantPrice(variantId: string, priceListId: string, price: number): Promise<VariantPrice>;
  
  getWholesaleTiers(): Promise<WholesaleTier[]>;
  createWholesaleTier(tier: Omit<WholesaleTier, 'id'>): Promise<WholesaleTier>;
  updateWholesaleTier(id: string, tier: Partial<WholesaleTier>): Promise<WholesaleTier>;
  deleteWholesaleTier(id: string): Promise<void>;
  
  // Stock
  getStock(branchId: string): Promise<Stock[]>;
  getInventoryMovements(branchId: string): Promise<InventoryMovement[]>;
  getInventoryLines(movementId: string): Promise<InventoryLine[]>;
  createAdjustment(branchId: string, variantId: string, quantity: number, notes: string): Promise<InventoryMovement>;
  getStockByVariant(variantId: string): Promise<{branchId: string;branchName: string;quantity: number;}[]>;



  // Customers
  getCustomers(): Promise<Customer[]>;
  createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer>;
  searchCustomers(query: string): Promise<Customer[]>;
  
  // Sales
  createSale(
    branchId: string,
    sessionId: string,
    customerId: string | null,
    docType: DocumentType,
    lines: Omit<SalesLine, 'id' | 'salesDocumentId'>[],
    payments: Omit<Payment, 'id' | 'salesDocumentId' | 'cashSessionId' | 'createdAt'>[]
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }>;
  
  getSales(branchId: string, sessionId?: string): Promise<SalesDocument[]>;
  getSaleDetail(saleId: string): Promise<{ document: SalesDocument; lines: SalesLine[]; payments: Payment[]; dte: DTERequest | null }>;
  
  voidSaleInternal(saleId: string, reason: string): Promise<SalesDocument>;
  createCreditNote(
    originalSaleId: string,
    refType: RefType,
    lines: { variantId: string; quantity: number }[],
    refundMethod: PaymentMethod
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }>;
  
  retryDTE(dteRequestId: string): Promise<DTERequest>;
  
  // Suppliers & Purchases
  getSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier>;
  
  getPurchases(branchId: string): Promise<PurchaseInvoice[]>;
  createPurchase(
    branchId: string,
    supplierId: string,
    invoiceNumber: string,
    invoiceDate: string,
    notes: string,
    lines: { variantId: string; quantity: number; unitCost: number }[]
  ): Promise<PurchaseInvoice>;


  updatePurchaseInvoice(
    id: string,
    patch: Partial<PurchaseInvoice>
  ): Promise<PurchaseInvoice>;

  sendPurchaseInvoiceToSII(id: string): Promise<PurchaseInvoice>;

  getPurchaseLines(purchaseInvoiceId: string): Promise<PurchaseLine[]>;

  // Employees
  getEmployees(branchId: string): Promise<Employee[]>;
  createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee>;
  getEmployeeAdvances(employeeId: string): Promise<EmployeeAdvance[]>;
  
  // Users
  getUsers(): Promise<User[]>;
  createUser(user: Omit<User, 'id'> & { password: string }): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  
  // Reports
  getDailySalesReport(branchId: string, date: string): Promise<DailySalesReport>;
  
  // Audit
  getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]>;
}
