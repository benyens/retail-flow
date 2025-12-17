import type { ApiClient } from './client';
import {
  mockState,
  BRANCHES,
  CASH_REGISTERS,
  USERS,
  getAllVariantsWithProducts,
} from './mockData';
import { generateId } from '@/utils/format';
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

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function generateAutoSku(productName: string, variantName?: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const baseProd = clean(productName).slice(0, 8) || "PROD";
  const baseVar = variantName ? clean(variantName).slice(0, 4) : "";
  const base = baseVar ? `${baseProd}-${baseVar}` : baseProd;

  const existing = new Set(
    mockState.variants
      .map((v) => v.sku)
      .filter((s): s is string => !!s)
  );

  let n = 1;
  let candidate = `${base}-${String(n).padStart(3, "0")}`;
  while (existing.has(candidate)) {
    n++;
    candidate = `${base}-${String(n).padStart(3, "0")}`;
  }
  return candidate;
}


export class MockApiClient implements ApiClient {
  
  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    await delay(300);
    const index = mockState.customers.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Cliente no encontrado');
    mockState.customers[index] = { ...mockState.customers[index], ...customer };
    return mockState.customers[index];
  }

  private currentUserId: string | null = null;

  // ============ Auth ============
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    await delay(500);
    
    const user = USERS.find(u => u.email === credentials.email && u.password === credentials.password);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }
    
    this.currentUserId = user.id;
    const { password, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token: `mock-token-${user.id}-${Date.now()}`,
    };
  }

  async logout(): Promise<void> {
    await delay(200);
    this.currentUserId = null;
  }

  // ============ Branches & Cash Registers ============
  async getBranches(): Promise<Branch[]> {
    await delay(200);
    return BRANCHES;
  }

  async getCashRegisters(branchId: string): Promise<CashRegister[]> {
    await delay(200);
    return CASH_REGISTERS.filter(r => r.branchId === branchId);
  }

  // ============ Cash Sessions ============
  async openCashSession(cashRegisterId: string, initialFund: number): Promise<CashSession> {
    await delay(300);
    
    const existing = mockState.cashSessions.find(
      s => s.cashRegisterId === cashRegisterId && s.status === 'OPEN'
    );
    if (existing) {
      throw new Error('Ya existe una sesión abierta para esta caja');
    }

    const session: CashSession = {
      id: generateId(),
      cashRegisterId,
      userId: this.currentUserId || 'user-1',
      openedAt: new Date().toISOString(),
      initialFund,
      expectedCash: initialFund,
      status: 'OPEN',
    };
    
    mockState.cashSessions.push(session);
    return session;
  }

  async closeCashSession(sessionId: string, declaredCash: number, notes?: string): Promise<CashSession> {
    await delay(300);
    
    const session = mockState.cashSessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Sesión no encontrada');
    if (session.status === 'CLOSED') throw new Error('La sesión ya está cerrada');

    session.closedAt = new Date().toISOString();
    session.declaredCash = declaredCash;
    session.difference = declaredCash - session.expectedCash;
    session.status = 'CLOSED';
    session.closingNotes = notes;
    
    return session;
  }

  async getCurrentSession(cashRegisterId: string): Promise<CashSession | null> {
    await delay(200);
    return mockState.cashSessions.find(
      s => s.cashRegisterId === cashRegisterId && s.status === 'OPEN'
    ) || null;
  }

  async getSessionSummary(sessionId: string): Promise<CashSessionSummary> {
    await delay(300);
    
    const session = mockState.cashSessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Sesión no encontrada');

    const sessionSales = mockState.salesDocuments.filter(d => d.cashSessionId === sessionId);
    const sessionPayments = mockState.payments.filter(p => p.cashSessionId === sessionId);
    const movements = mockState.cashMovements.filter(m => m.cashSessionId === sessionId);

    const totalCashSales = sessionPayments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0);
    const totalCardSales = sessionPayments.filter(p => p.method === 'CARD').reduce((sum, p) => sum + p.amount, 0);
    const totalTransferSales = sessionPayments.filter(p => p.method === 'TRANSFER').reduce((sum, p) => sum + p.amount, 0);
    const totalOtherSales = sessionPayments.filter(p => p.method === 'OTHER').reduce((sum, p) => sum + p.amount, 0);

    const movementsCashIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0);
    const movementsCashOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0);

    const expectedCash = session.initialFund + totalCashSales + movementsCashIn - movementsCashOut;

    return {
      session: { ...session, expectedCash },
      totalSales: sessionSales.reduce((sum, d) => sum + d.total, 0),
      totalCashSales,
      totalCardSales,
      totalTransferSales,
      totalOtherSales,
      movements,
      expectedCash,
    };
  }

  // ============ Cash Movements ============
  async createCashMovement(
    sessionId: string,
    type: CashMovementType,
    concept: CashMovementConcept,
    amount: number,
    reason: string,
    employeeId?: string
  ): Promise<CashMovement> {
    await delay(300);

    const session = mockState.cashSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'OPEN') {
      throw new Error('La sesión de caja no está abierta');
    }

    const movement: CashMovement = {
      id: generateId(),
      cashSessionId: sessionId,
      type,
      concept,
      amount,
      reason,
      employeeId,
      authorizedBy: this.currentUserId || undefined,
      createdAt: new Date().toISOString(),
    };

    mockState.cashMovements.push(movement);

    // Update expected cash
    if (type === 'IN') {
      session.expectedCash += amount;
    } else {
      session.expectedCash -= amount;
    }

    // If employee advance/bonus, create advance record
    if (employeeId && (concept === 'ADVANCE_EMPLOYEE' || concept === 'BONUS_AGUINALDO')) {
      const advance: EmployeeAdvance = {
        id: generateId(),
        employeeId,
        cashSessionId: sessionId,
        cashMovementId: movement.id,
        type: concept === 'ADVANCE_EMPLOYEE' ? 'ADVANCE' : 'BONUS',
        amount,
        reason,
        createdAt: new Date().toISOString(),
      };
      mockState.employeeAdvances.push(advance);
    }

    return movement;
  }

  async getSessionMovements(sessionId: string): Promise<CashMovement[]> {
    await delay(200);
    return mockState.cashMovements.filter(m => m.cashSessionId === sessionId);
  }

  // ============ Catalog ============
  async getProducts(): Promise<Product[]> {
    await delay(200);
    return mockState.products;
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    await delay(300);
    const newProduct: Product = { ...product, id: generateId() };
    mockState.products.push(newProduct);
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    await delay(300);
    const index = mockState.products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Producto no encontrado');
    mockState.products[index] = { ...mockState.products[index], ...product };
    return mockState.products[index];
  }

  async deleteProduct(id: string): Promise<void> {
    await delay(300);
    const index = mockState.products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Producto no encontrado');
    mockState.products.splice(index, 1);
  }

  /** Genera un SKU único basado en el nombre del producto + un contador */
  private generateUniqueSku(baseName: string): string {
    const base =
      baseName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')   // solo letras/números con guiones
        .replace(/^-+|-+$/g, '')       // quita guiones al inicio/fin
        .slice(0, 10) || 'SKU';

    const existing = new Set(mockState.variants.map(v => v.sku));
    let i = 1;
    // SKU tipo: COCA-COLA-001, COCA-COLA-002, ...
    let candidate = `${base}-${String(i).padStart(3, '0')}`;
    while (existing.has(candidate)) {
      i += 1;
      candidate = `${base}-${String(i).padStart(3, '0')}`;
    }
    return candidate;
  }

  // ------- NUEVO PRODUCTO RÁPIDO --------
  async createQuickProduct(payload: QuickProductPayload): Promise<VariantWithProduct> {
    await delay(300);

    // ---- Validaciones base ----
    const mode = payload.mode;
    const variantName = (payload.variantName ?? "").trim() || "Única";
    const unit = payload.unit?.trim() || "UN";

    const salePrice =
      typeof payload.salePrice === "number" ? payload.salePrice : Number(payload.salePrice);

    if (!salePrice || salePrice <= 0) {
      throw new Error("Precio de venta (lista normal) es obligatorio para que el producto aparezca en POS/Precios.");
    }

    const lastPurchaseCost =
      typeof payload.lastPurchaseCost === "number"
        ? payload.lastPurchaseCost
        : payload.lastPurchaseCost != null
        ? Number(payload.lastPurchaseCost)
        : undefined;

    // ---- Resolver Product + VariantGroup según modo ----
    let product: Product | null = null;

    if (mode === "ADD_VARIANT") {
      const pid = payload.existingProductId?.trim();
      if (!pid) throw new Error("Debes seleccionar un producto existente para agregar una variante.");

      product = mockState.products.find(p => p.id === pid) ?? null;
      if (!product) throw new Error("Producto existente no encontrado.");
    } else {
      const productName = (payload.productName ?? "").trim();
      if (!productName) throw new Error("Nombre de producto es obligatorio.");

      // Crear Product (mínimo y consistente con tu interface)
      product = {
        id: generateId(),
        name: productName,
        description: "",
        category: "Sin categoría",
        isActive: true,
      };
      mockState.products.push(product);
    }

    // Asegurar un VariantGroup coherente (1:1 por nombre del producto, para mayorista)
    let variantGroup = mockState.variantGroups.find(
      g => g.name.trim().toLowerCase() === product!.name.trim().toLowerCase()
    );

    if (!variantGroup) {
      variantGroup = {
        id: generateId(),
        name: product!.name.trim(),
        description: `Grupo para ${product!.name}`,
      };
      mockState.variantGroups.push(variantGroup);
    }

    // SKU
    const sku = payload.sku?.trim() || generateAutoSku(product!.name, variantName);
    const barcode = payload.barcode?.trim() || undefined;

    // Crear Variant
    const variant: Variant = {
      id: generateId(),
      productId: product!.id,
      variantGroupId: variantGroup.id,
      name: variantName,
      sku,
      barcode,
      unit,
      attributes: {},
      isActive: true,
      lastPurchaseCost: typeof lastPurchaseCost === "number" ? lastPurchaseCost : null,
      lastPurchaseDate: typeof lastPurchaseCost === "number" ? new Date().toISOString() : null,
    } as Variant;

    mockState.variants.push(variant);

    // ✅ Crear SIEMPRE precio lista normal "pl-1"
    const normalListId = "pl-1";
    const existingPrice = mockState.variantPrices.find(
      vp => vp.variantId === variant.id && vp.priceListId === normalListId
    );

    if (existingPrice) {
      existingPrice.price = salePrice;
    } else {
      mockState.variantPrices.push({
        id: generateId(),
        variantId: variant.id,
        priceListId: normalListId,
        price: salePrice,
      } as VariantPrice);
    }

    // Devolver VariantWithProduct consistente
    const full: VariantWithProduct = {
      ...variant,
      product: product!,
      variantGroup,
    } as VariantWithProduct;

    return full;
  }


  // ---------- VARIANTES ----------

  async getVariantGroups(): Promise<VariantGroup[]> {
    await delay(200);
    return mockState.variantGroups;
  }

  async createVariantGroup(group: Omit<VariantGroup, 'id'>): Promise<VariantGroup> {
    await delay(300);
    const newGroup: VariantGroup = { ...group, id: generateId() };
    mockState.variantGroups.push(newGroup);
    return newGroup;
  }

  async updateVariantGroup(id: string, group: Partial<VariantGroup>): Promise<VariantGroup> {
    await delay(300);
    const index = mockState.variantGroups.findIndex(g => g.id === id);
    if (index === -1) throw new Error('Grupo no encontrado');
    mockState.variantGroups[index] = { ...mockState.variantGroups[index], ...group };
    return mockState.variantGroups[index];
  }

  async deleteVariantGroup(id: string): Promise<void> {
    await delay(300);
    const index = mockState.variantGroups.findIndex(g => g.id === id);
    if (index === -1) throw new Error('Grupo no encontrado');
    mockState.variantGroups.splice(index, 1);
  }

  async getVariants(branchId?: string): Promise<VariantWithProduct[]> {
    await delay(200);
    const all = getAllVariantsWithProducts(); // tu fuente actual
    
  if (!branchId) return all;

  return all.filter(v => {
    const allowed = v.product.allowedBranchIds;
    if (!allowed || allowed.length === 0) return true;
    return allowed.includes(branchId);
  });
  }

  async createVariant(variant: Omit<Variant, 'id'>): Promise<Variant> {
    await delay(300);
    const newVariant: Variant = { ...variant, id: generateId() };
    mockState.variants.push(newVariant);
    return newVariant;
  }

  async updateVariant(id: string, variant: Partial<Variant>): Promise<Variant> {
    await delay(300);
    const index = mockState.variants.findIndex(v => v.id === id);
    if (index === -1) throw new Error('Variante no encontrada');
    mockState.variants[index] = { ...mockState.variants[index], ...variant };
    return mockState.variants[index];
  }

  async deleteVariant(id: string): Promise<void> {
    await delay(300);
    const index = mockState.variants.findIndex(v => v.id === id);
    if (index === -1) throw new Error('Variante no encontrada');
    mockState.variants.splice(index, 1);
  }

  async searchVariants(query: string): Promise<VariantWithProduct[]> {
    await delay(200);
    const q = query.toLowerCase();
    return getAllVariantsWithProducts().filter(v =>
      v.sku.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.barcode?.toLowerCase().includes(q) ||
      v.product.name.toLowerCase().includes(q)
    );
  }

    // ============ Product Categories ============
  async getProductCategories(): Promise<ProductCategory[]> {
    await delay(200);
    return mockState.categories;
  }

  async createProductCategory(category: Omit<ProductCategory, 'id'>): Promise<ProductCategory> {
    await delay(300);
    const newCategory: ProductCategory = { ...category, id: generateId() };
    mockState.categories.push(newCategory);
    return newCategory;
  }

  async updateProductCategory(id: string, category: Partial<ProductCategory>): Promise<ProductCategory> {
    await delay(300);
    const index = mockState.categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Categoría no encontrada');
    mockState.categories[index] = { ...mockState.categories[index], ...category };
    return mockState.categories[index];
  }

  async deleteProductCategory(id: string): Promise<void> {
    await delay(300);
    const index = mockState.categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Categoría no encontrada');

    const name = mockState.categories[index].name;
    const usedByProduct = mockState.products.some(p => p.category === name);
    if (usedByProduct) {
      throw new Error('No se puede eliminar una categoría que tiene productos asociados');
    }

    mockState.categories.splice(index, 1);
  }

  // ============ Pricing ============
  async getVariantPrices(): Promise<VariantPrice[]> {
    await delay(200);
    return mockState.variantPrices;
  }

  async setVariantPrice(variantId: string, priceListId: string, price: number): Promise<VariantPrice> {
    await delay(300);
    const existing = mockState.variantPrices.find(
      vp => vp.variantId === variantId && vp.priceListId === priceListId
    );
    if (existing) {
      existing.price = price;
      return existing;
    }
    const newPrice: VariantPrice = { id: generateId(), variantId, priceListId, price };
    mockState.variantPrices.push(newPrice);
    return newPrice;
  }

  async getWholesaleTiers(): Promise<WholesaleTier[]> {
    await delay(200);
    return mockState.wholesaleTiers;
  }

  async createWholesaleTier(tier: Omit<WholesaleTier, 'id'>): Promise<WholesaleTier> {
    await delay(300);
    const newTier: WholesaleTier = { ...tier, id: generateId() };
    mockState.wholesaleTiers.push(newTier);
    return newTier;
  }

  async updateWholesaleTier(id: string, tier: Partial<WholesaleTier>): Promise<WholesaleTier> {
    await delay(300);
    const index = mockState.wholesaleTiers.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tramo no encontrado');
    mockState.wholesaleTiers[index] = { ...mockState.wholesaleTiers[index], ...tier };
    return mockState.wholesaleTiers[index];
  }

  async deleteWholesaleTier(id: string): Promise<void> {
    await delay(300);
    const index = mockState.wholesaleTiers.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tramo no encontrado');
    mockState.wholesaleTiers.splice(index, 1);
  }

  // ============ Stock ============
  async getStock(branchId: string): Promise<Stock[]> {
    await delay(200);
    return mockState.stock.filter(s => s.branchId === branchId);
  }

  async getStockByVariant(variantId: string): Promise<{ branchId: string; branchName: string; quantity: number }[]> {
    await delay(200);
    const stocks = mockState.stock.filter(s => s.variantId === variantId);

    return stocks.map(s => {
      const branch = BRANCHES.find(b => b.id === s.branchId);
      return {
        branchId: s.branchId,
        branchName: branch?.name ?? 'Sucursal',
        quantity: s.quantity,
      };
    });
  }

  async getInventoryMovements(branchId: string): Promise<InventoryMovement[]> {
    await delay(200);
    return mockState.inventoryMovements.filter(m => m.branchId === branchId);
  }

  async getInventoryLines(movementId: string): Promise<InventoryLine[]> {
    await delay(200);
    return mockState.inventoryLines.filter(l => l.movementId === movementId);
  }

  async createAdjustment(branchId: string, variantId: string, quantity: number, notes: string): Promise<InventoryMovement> {
    await delay(300);
    
    const stockItem = mockState.stock.find(s => s.branchId === branchId && s.variantId === variantId);
    const previousStock = stockItem?.quantity ?? 0;
    const newStock = previousStock + quantity;

    const movement: InventoryMovement = {
      id: generateId(),
      branchId,
      type: 'ADJUSTMENT',
      notes,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserId || 'user-1',
    };
    mockState.inventoryMovements.push(movement);

    const line: InventoryLine = {
      id: generateId(),
      movementId: movement.id,
      variantId,
      quantity,
      previousStock,
      newStock,
    };
    mockState.inventoryLines.push(line);

    if (stockItem) {
      stockItem.quantity = newStock;
      stockItem.lastUpdated = new Date().toISOString();
    } else {
      mockState.stock.push({
        branchId,
        variantId,
        quantity: newStock,
        lastUpdated: new Date().toISOString(),
      });
    }

    return movement;
  }

  // ============ Customers ============
  async getCustomers(): Promise<Customer[]> {
    await delay(200);
    return mockState.customers;
  }

  async createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    await delay(300);
    const newCustomer: Customer = { ...customer, id: generateId() };
    mockState.customers.push(newCustomer);
    return newCustomer;
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    await delay(200);
    const q = query.toLowerCase();
    return mockState.customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q)
    );
  }

  // ============ Sales ============
  async createSale(
    branchId: string,
    sessionId: string,
    customerId: string | null,
    docType: DocumentType,
    lines: Omit<SalesLine, 'id' | 'salesDocumentId'>[],
    payments: Omit<Payment, 'id' | 'salesDocumentId' | 'cashSessionId' | 'createdAt'>[]
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }> {
    await delay(500);

    const session = mockState.cashSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'OPEN') {
      throw new Error('No hay sesión de caja abierta');
    }
    const total = lines.reduce(
          (acc, l) => acc + l.unitPrice * l.quantity,
          0
        );

    const subtotal = Math.round(total / 1.19);   
    const tax = total - subtotal;  

    const document: SalesDocument = {
      id: generateId(),
      branchId,
      cashSessionId: sessionId,
      customerId: customerId || undefined,
      docType,
      status: 'PENDING_ISSUE',
      subtotal,
      tax,
      total,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserId || 'user-1',
    };
    mockState.salesDocuments.push(document);

    // Add lines
    for (const line of lines) {
      mockState.salesLines.push({
        ...line,
        id: generateId(),
        salesDocumentId: document.id,
      });

      // Update stock
      const stockItem = mockState.stock.find(s => s.branchId === branchId && s.variantId === line.variantId);
      if (stockItem) {
        stockItem.quantity -= line.quantity;
        stockItem.lastUpdated = new Date().toISOString();
      }
    }

    // Add payments
    let totalCashPayment = 0;
    for (const payment of payments) {
      mockState.payments.push({
        ...payment,
        id: generateId(),
        salesDocumentId: document.id,
        cashSessionId: sessionId,
        createdAt: new Date().toISOString(),
      });
      if (payment.method === 'CASH') {
        totalCashPayment += payment.amount;
      }
    }

    // Update session expected cash
    session.expectedCash += totalCashPayment;

    // Create inventory movement
    const movement: InventoryMovement = {
      id: generateId(),
      branchId,
      type: 'SALE',
      referenceId: document.id,
      referenceType: 'sales_document',
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserId || 'user-1',
    };
    mockState.inventoryMovements.push(movement);

    // Create DTE request (simulated)
    const dteRequest: DTERequest = {
      id: generateId(),
      salesDocumentId: document.id,
      status: 'PENDING',
      providerName: 'MOCK_PROVIDER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.dteRequests.push(dteRequest);

    // Simulate DTE emission after 2 seconds
    setTimeout(() => {
      const dte = mockState.dteRequests.find(d => d.id === dteRequest.id);
      const doc = mockState.salesDocuments.find(d => d.id === document.id);
      if (dte && doc) {
        dte.status = 'ACCEPTED';
        dte.folio = `${Date.now()}`;
        dte.providerExternalId = `EXT-${dte.folio}`;
        doc.status = 'ISSUED';
        doc.folio = dte.folio;
        dte.updatedAt = new Date().toISOString();
      }
    }, 500);

    return { document, dteRequest };
  }

  async getSales(branchId: string, sessionId?: string): Promise<SalesDocument[]> {
    await delay(200);
    let sales = mockState.salesDocuments.filter(d => d.branchId === branchId);
    if (sessionId) {
      sales = sales.filter(d => d.cashSessionId === sessionId);
    }
    return sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSaleDetail(saleId: string): Promise<{ document: SalesDocument; lines: SalesLine[]; payments: Payment[]; dte: DTERequest | null }> {
    await delay(200);
    const document = mockState.salesDocuments.find(d => d.id === saleId);
    if (!document) throw new Error('Venta no encontrada');

    return {
      document,
      lines: mockState.salesLines.filter(l => l.salesDocumentId === saleId),
      payments: mockState.payments.filter(p => p.salesDocumentId === saleId),
      dte: mockState.dteRequests.find(d => d.salesDocumentId === saleId) || null,
    };
  }

  async voidSaleInternal(saleId: string, reason: string): Promise<SalesDocument> {
    await delay(400);
    
    const doc = mockState.salesDocuments.find((d) => d.id === saleId);
    if (!doc) {
      throw new Error("Documento no encontrado");
    }

    // 2) Validar estado
    if (doc.status !== "ISSUED") {
      throw new Error("Solo se pueden anular documentos emitidos");
    }

    // 3) Cambiar estado a anulado interno
    const beforeStatus = doc.status;
    doc.status = "VOID_INTERNAL";

    // 4) Registrar en auditoría (opcional, pero útil)
    mockState.auditLogs.push({
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: mockState.users[0]?.id ?? "user-1",
      action: "VOID_SALE",
      entityType: "SalesDocument",
      entityId: doc.id,
      beforeData: { status: beforeStatus },
      afterData: { status: doc.status, reason },
      createdAt: new Date().toISOString(),
    });

    return doc;
  }

  async createCreditNote(
    originalSaleId: string,
    refType: RefType,
    lines: { variantId: string; quantity: number }[],
    refundMethod: PaymentMethod
  ): Promise<{ document: SalesDocument; dteRequest: DTERequest }> {
    await delay(500);

    const originalDoc = mockState.salesDocuments.find(d => d.id === originalSaleId);
    if (!originalDoc) throw new Error('Documento original no encontrado');
    if (originalDoc.status !== 'ISSUED') {
      throw new Error('Solo se puede crear NC para documentos emitidos');
    }

    const originalLines = mockState.salesLines.filter(l => l.salesDocumentId === originalSaleId);
    
    let subtotal = 0;
    const creditNoteLines: Omit<SalesLine, 'id' | 'salesDocumentId'>[] = [];

    for (const { variantId, quantity } of lines) {
      const origLine = originalLines.find(l => l.variantId === variantId);
      if (!origLine) continue;
      
      const lineSubtotal = origLine.unitPrice * quantity;
      subtotal += lineSubtotal;

      creditNoteLines.push({
        variantId,
        variantGroupId: origLine.variantGroupId,
        quantity,
        unitPrice: origLine.unitPrice,
        priceSource: origLine.priceSource,
        subtotal: lineSubtotal,
      });

      // Return stock
      const stockItem = mockState.stock.find(s => s.branchId === originalDoc.branchId && s.variantId === variantId);
      if (stockItem) {
        stockItem.quantity += quantity;
        stockItem.lastUpdated = new Date().toISOString();
      }
    }

    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + tax;

    // Get current session for cash refund
    const session = mockState.cashSessions.find(s => s.cashRegisterId && s.status === 'OPEN');

    const creditNote: SalesDocument = {
      id: generateId(),
      branchId: originalDoc.branchId,
      cashSessionId: session?.id || originalDoc.cashSessionId,
      customerId: originalDoc.customerId,
      docType: 'CREDIT_NOTE',
      status: 'PENDING_ISSUE',
      subtotal,
      tax,
      total,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserId || 'user-1',
    };
    mockState.salesDocuments.push(creditNote);

    // Add lines
    for (const line of creditNoteLines) {
      mockState.salesLines.push({
        ...line,
        id: generateId(),
        salesDocumentId: creditNote.id,
      });
    }

    // Create refund movement if cash and session is open
    if (refundMethod === 'CASH' && session) {
      const movement: CashMovement = {
        id: generateId(),
        cashSessionId: session.id,
        type: 'OUT',
        concept: 'REFUND_CUSTOMER',
        amount: total,
        reason: `Devolución NC ref. ${originalDoc.folio}`,
        createdAt: new Date().toISOString(),
      };
      mockState.cashMovements.push(movement);
      session.expectedCash -= total;
    }

    // Create DTE request
    const dteRequest: DTERequest = {
      id: generateId(),
      salesDocumentId: creditNote.id,
      status: 'PENDING',
      providerName: 'MOCK_PROVIDER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.dteRequests.push(dteRequest);

    // Simulate emission
    setTimeout(() => {
      const dte = mockState.dteRequests.find(d => d.id === dteRequest.id);
      const doc = mockState.salesDocuments.find(d => d.id === creditNote.id);
      if (dte && doc) {
        dte.status = 'ACCEPTED';
        dte.folio = `NC-${Date.now()}`;
        doc.status = 'ISSUED';
        doc.folio = dte.folio;
        dte.updatedAt = new Date().toISOString();
      }
    }, 2000);

    return { document: creditNote, dteRequest };
  }

  async retryDTE(dteRequestId: string): Promise<DTERequest> {
    await delay(500);
    
    const dte = mockState.dteRequests.find(d => d.id === dteRequestId);
    if (!dte) throw new Error('DTE no encontrado');

    dte.status = 'PENDING';
    dte.lastError = undefined;
    dte.updatedAt = new Date().toISOString();

    // Simulate retry
    setTimeout(() => {
      const dteRetry = mockState.dteRequests.find(d => d.id === dteRequestId);
      const doc = mockState.salesDocuments.find(d => d.id === dte.salesDocumentId);
      if (dteRetry && doc) {
        dteRetry.status = 'ACCEPTED';
        dteRetry.folio = `${Date.now()}`;
        doc.status = 'ISSUED';
        doc.folio = dteRetry.folio;
        dteRetry.updatedAt = new Date().toISOString();
      }
    }, 2000);

    return dte;
  }

  // ============ Suppliers & Purchases ============
  async getSuppliers(): Promise<Supplier[]> {
    await delay(200);
    return mockState.suppliers;
  }

  async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    await delay(300);
    const newSupplier: Supplier = { ...supplier, id: generateId() };
    mockState.suppliers.push(newSupplier);
    return newSupplier;
  }

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier> {
    await delay(300);
    const index = mockState.suppliers.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Proveedor no encontrado');
    mockState.suppliers[index] = { ...mockState.suppliers[index], ...supplier };
    return mockState.suppliers[index];
  }

  async getPurchases(branchId: string): Promise<PurchaseInvoice[]> {
    await delay(200);
    return mockState.purchaseInvoices.filter(p => p.branchId === branchId);
  }

  async createPurchase(
    branchId: string,
    supplierId: string,
    invoiceNumber: string,
    invoiceDate: string,
    notes: string,
    lines: { variantId: string; quantity: number; unitCost: number }[]
  ): Promise<PurchaseInvoice> {
    await delay(400);

    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + tax;

    const now = new Date().toISOString();

    const invoice: PurchaseInvoice = {
      id: generateId(),
      branchId,
      supplierId,
      invoiceNumber,

      // ✅ NUEVO
      invoiceDate: invoiceDate || now.slice(0, 10),
      notes: notes?.trim() || "",

      subtotal,
      tax,
      total,

      // ✅ NUEVO
      status: "DRAFT",
      siiTrackId: null,
      lastError: null,
      updatedAt: now,

      createdAt: now,
      createdBy: this.currentUserId || "user-1",
    };

    mockState.purchaseInvoices.push(invoice);

    // Add lines and update stock
    for (const line of lines) {
      mockState.purchaseLines.push({
        id: generateId(),
        purchaseInvoiceId: invoice.id,
        variantId: line.variantId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        subtotal: line.quantity * line.unitCost,
      });

      const stockItem = mockState.stock.find(
        s => s.branchId === branchId && s.variantId === line.variantId
      );
      if (stockItem) {
        stockItem.quantity += line.quantity;
        stockItem.lastUpdated = now;
      } else {
        mockState.stock.push({
          branchId,
          variantId: line.variantId,
          quantity: line.quantity,
          lastUpdated: now,
        });
      }

      // actualizar lastPurchaseCost
      const variant = mockState.variants.find(v => v.id === line.variantId);
      if (variant) {
        (variant as Variant).lastPurchaseCost = line.unitCost;
        (variant as any).lastPurchaseDate = now;
      }
    }

    // Inventory movement
    const movement: InventoryMovement = {
      id: generateId(),
      branchId,
      type: "PURCHASE",
      referenceId: invoice.id,
      referenceType: "purchase_invoice",
      createdAt: now,
      createdBy: this.currentUserId || "user-1",
    };
    mockState.inventoryMovements.push(movement);

    return invoice;
  }


  async getPurchaseLines(
    purchaseInvoiceId: string
  ): Promise<PurchaseLine[]> {
    await delay(200);
    return mockState.purchaseLines.filter(
      (l) => l.purchaseInvoiceId === purchaseInvoiceId
    );
  }

  async updatePurchaseInvoice(id: string, patch: Partial<PurchaseInvoice>) {
    await delay(300);

    const inv = mockState.purchaseInvoices.find((x: PurchaseInvoice) => x.id === id);
    if (!inv) throw new Error("Factura no encontrada");

    if (inv.status !== "DRAFT") {
      throw new Error("Esta factura ya fue enviada al SII y no se puede editar.");
    }

    Object.assign(inv, patch, { updatedAt: new Date().toISOString() });
    return inv;
  }

  async sendPurchaseInvoiceToSII(id: string) {
    await delay(600);

    const inv = mockState.purchaseInvoices.find((x: PurchaseInvoice) => x.id === id);
    if (!inv) throw new Error("Factura no encontrada");

    if (inv.status !== "DRAFT") return inv;

    inv.status = "SII_SENT";
    inv.siiTrackId = `trk-${Date.now()}`;
    inv.updatedAt = new Date().toISOString();
    return inv;
  }


  // ============ Employees ============
  async getEmployees(branchId: string): Promise<Employee[]> {
    await delay(200);
    return mockState.employees.filter(e => e.branchId === branchId);
  }

  async createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
    await delay(300);
    const newEmployee: Employee = { ...employee, id: generateId() };
    mockState.employees.push(newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    await delay(300);
    const index = mockState.employees.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Empleado no encontrado');
    mockState.employees[index] = { ...mockState.employees[index], ...employee };
    return mockState.employees[index];
  }

  async getEmployeeAdvances(employeeId: string): Promise<EmployeeAdvance[]> {
    await delay(200);
    return mockState.employeeAdvances.filter(a => a.employeeId === employeeId);
  }

  // ============ Users ============
  async getUsers(): Promise<User[]> {
    await delay(200);
    return mockState.users.map(({ password, ...user }) => user);
  }

  async createUser(user: Omit<User, 'id'> & { password: string }): Promise<User> {
    await delay(300);
    const newUser = { ...user, id: generateId() };
    mockState.users.push(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    await delay(300);
    const index = mockState.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('Usuario no encontrado');
    mockState.users[index] = { ...mockState.users[index], ...user };
    const { password, ...userWithoutPassword } = mockState.users[index];
    return userWithoutPassword;
  }

  // ============ Reports ============
  async getDailySalesReport(branchId: string, date: string): Promise<DailySalesReport> {
    await delay(300);
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = mockState.salesDocuments.filter(d => {
      const created = new Date(d.createdAt);
      return d.branchId === branchId && created >= startOfDay && created <= endOfDay;
    });

    const byPaymentMethod: Record<PaymentMethod, number> = { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0, OTHER: 0 };
    const byDocType: Record<DocumentType, number> = { BOLETA: 0, FACTURA: 0, CREDIT_NOTE: 0 };

    for (const sale of sales) {
      byDocType[sale.docType] += sale.total;
      const payments = mockState.payments.filter(p => p.salesDocumentId === sale.id);
      for (const p of payments) {
        byPaymentMethod[p.method] += p.amount;
      }
    }

    return {
      date,
      branchId,
      totalSales: sales.reduce((sum, s) => sum + s.total, 0),
      totalTransactions: sales.length,
      byPaymentMethod,
      byDocType,
    };
  }

  // ============ Audit ============
  async getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    await delay(200);
    let logs = mockState.auditLogs;
    if (entityType) logs = logs.filter(l => l.entityType === entityType);
    if (entityId) logs = logs.filter(l => l.entityId === entityId);
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

// Export singleton instance
export const mockApiClient = new MockApiClient();

