import type {
  Branch,
  CashRegister,
  CashSession,
  Product,
  Variant,
  VariantGroup,
  VariantWithProduct,
  VariantPrice,
  WholesaleTier,
  Stock,
  Customer,
  Supplier,
  Employee,
  User,
  PriceList,
  SalesDocument,
  SalesLine,
  Payment,
  DTERequest,
  CashMovement,
  InventoryMovement,
  InventoryLine,
  PurchaseInvoice,
  PurchaseLine,
  EmployeeAdvance,
  AuditLog,
  ProductCategory,
} from '@/types';

// ============ Seed Data ============

export const PRICE_LISTS: PriceList[] = [
  { id: 'pl-1', name: 'Normal', type: 'NORMAL' },
  { id: 'pl-2', name: 'Mayorista', type: 'MAYORISTA' },
];

export const BRANCHES: Branch[] = [
  { id: 'branch-1', companyId: 'company-1', name: 'Sucursal Centro', address: 'Av. Libertador 1234, Santiago', isActive: true },
  { id: 'branch-2', companyId: 'company-1', name: 'Sucursal Norte', address: 'Av. Independencia 567, Recoleta', isActive: true },
  { id: 'branch-3', companyId: 'company-1', name: 'Sucursal Sur', address: 'Gran Avenida 890, San Miguel', isActive: true },
];

export const CASH_REGISTERS: CashRegister[] = [
  { id: 'register-1', branchId: 'branch-1', name: 'Caja 1', code: 'C1-01', isActive: true },
  { id: 'register-2', branchId: 'branch-1', name: 'Caja 2', code: 'C1-02', isActive: true },
  { id: 'register-3', branchId: 'branch-1', name: 'Caja 3', code: 'C1-03', isActive: true },
  { id: 'register-4', branchId: 'branch-2', name: 'Caja 1', code: 'C2-01', isActive: true },
  { id: 'register-5', branchId: 'branch-2', name: 'Caja 2', code: 'C2-02', isActive: true },
  { id: 'register-6', branchId: 'branch-3', name: 'Caja 1', code: 'C3-01', isActive: true },
];

export const USERS: (User & { password: string })[] = [
  { 
    id: 'user-1', 
    email: 'admin@pos.cl', 
    password: 'admin123',
    name: 'Administrador', 
    rut: '12345678-9', 
    role: 'ADMIN', 
    branchIds: ['branch-1', 'branch-2', 'branch-3'], 
    isActive: true 
  },
  { 
    id: 'user-2', 
    email: 'cajero@pos.cl', 
    password: 'cajero123',
    name: 'Juan Pérez', 
    rut: '11222333-4', 
    role: 'CASHIER', 
    branchIds: ['branch-1'], 
    isActive: true 
  },
  { 
    id: 'user-3', 
    email: 'manager@pos.cl', 
    password: 'manager123',
    name: 'María González', 
    rut: '15666777-8', 
    role: 'MANAGER', 
    branchIds: ['branch-1', 'branch-2'], 
    isActive: true 
  },
];

export const VARIANT_GROUPS: VariantGroup[] = [
  { id: 'vg-1', name: 'Desodorante Spray 150ml', description: 'Desodorantes en spray 150ml - diferentes aromas' },
  { id: 'vg-2', name: 'Jabón Líquido 500ml', description: 'Jabón líquido 500ml - diferentes fragancias' },
  { id: 'vg-3', name: 'Shampoo 400ml', description: 'Shampoo 400ml - diferentes tipos' },
];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'cat-1',
    name: 'Higiene Personal',
    description: 'Desodorantes, shampoos, jabones, etc.',
    isActive: true,
  },
  {
    id: 'cat-2',
    name: 'Abarrotes',
    description: 'Alimentos, arroz, aceite, etc.',
    isActive: true,
  },
];

export const PRODUCTS: Product[] = [
  { id: 'prod-1', name: 'Desodorante Fresh', description: 'Desodorante en spray', category: 'Higiene Personal', isActive: true },
  { id: 'prod-2', name: 'Jabón Líquido Natural', description: 'Jabón líquido para manos', category: 'Higiene Personal', isActive: true },
  { id: 'prod-3', name: 'Shampoo Suave', description: 'Shampoo para todo tipo de cabello', category: 'Higiene Personal', isActive: true },
  { id: 'prod-4', name: 'Arroz Grado 1', description: 'Arroz premium', category: 'Abarrotes', isActive: true },
  { id: 'prod-5', name: 'Aceite Vegetal', description: 'Aceite vegetal 1L', category: 'Abarrotes', isActive: true },
];

export const VARIANTS: Variant[] = [
  // Desodorantes (mismo grupo de equivalencia)
  { id: 'var-1', productId: 'prod-1', variantGroupId: 'vg-1', sku: 'DEO-FRESH-001', name: 'Desodorante Fresh - Aroma Original', attributes: { aroma: 'Original' }, unit: 'UN', barcode: '7801234567890', isActive: true },
  { id: 'var-2', productId: 'prod-1', variantGroupId: 'vg-1', sku: 'DEO-FRESH-002', name: 'Desodorante Fresh - Aroma Sport', attributes: { aroma: 'Sport' }, unit: 'UN', barcode: '7801234567891', isActive: true },
  { id: 'var-3', productId: 'prod-1', variantGroupId: 'vg-1', sku: 'DEO-FRESH-003', name: 'Desodorante Fresh - Aroma Cool', attributes: { aroma: 'Cool' }, unit: 'UN', barcode: '7801234567892', isActive: true },
  
  // Jabones (mismo grupo)
  { id: 'var-4', productId: 'prod-2', variantGroupId: 'vg-2', sku: 'JAB-NAT-001', name: 'Jabón Líquido - Lavanda', attributes: { fragancia: 'Lavanda' }, unit: 'UN', barcode: '7801234567893', isActive: true },
  { id: 'var-5', productId: 'prod-2', variantGroupId: 'vg-2', sku: 'JAB-NAT-002', name: 'Jabón Líquido - Manzanilla', attributes: { fragancia: 'Manzanilla' }, unit: 'UN', barcode: '7801234567894', isActive: true },
  
  // Shampoos (mismo grupo)
  { id: 'var-6', productId: 'prod-3', variantGroupId: 'vg-3', sku: 'SHA-SUA-001', name: 'Shampoo - Cabello Normal', attributes: { tipo: 'Normal' }, unit: 'UN', barcode: '7801234567895', isActive: true },
  { id: 'var-7', productId: 'prod-3', variantGroupId: 'vg-3', sku: 'SHA-SUA-002', name: 'Shampoo - Cabello Graso', attributes: { tipo: 'Graso' }, unit: 'UN', barcode: '7801234567896', isActive: true },
  
  // Productos sin grupo mayorista
  { id: 'var-8', productId: 'prod-4', variantGroupId: 'vg-single-1', sku: 'ARR-G1-1KG', name: 'Arroz Grado 1 - 1kg', attributes: { peso: '1kg' }, unit: 'UN', barcode: '7801234567897', isActive: true },
  { id: 'var-9', productId: 'prod-5', variantGroupId: 'vg-single-2', sku: 'ACE-VEG-1L', name: 'Aceite Vegetal - 1L', attributes: { volumen: '1L' }, unit: 'UN', barcode: '7801234567898', isActive: true },
];

export const VARIANT_PRICES: VariantPrice[] = [
  // Precios normales
  { id: 'vp-1', variantId: 'var-1', priceListId: 'pl-1', price: 2990 },
  { id: 'vp-2', variantId: 'var-2', priceListId: 'pl-1', price: 2990 },
  { id: 'vp-3', variantId: 'var-3', priceListId: 'pl-1', price: 2990 },
  { id: 'vp-4', variantId: 'var-4', priceListId: 'pl-1', price: 1990 },
  { id: 'vp-5', variantId: 'var-5', priceListId: 'pl-1', price: 1990 },
  { id: 'vp-6', variantId: 'var-6', priceListId: 'pl-1', price: 3490 },
  { id: 'vp-7', variantId: 'var-7', priceListId: 'pl-1', price: 3490 },
  { id: 'vp-8', variantId: 'var-8', priceListId: 'pl-1', price: 1290 },
  { id: 'vp-9', variantId: 'var-9', priceListId: 'pl-1', price: 2490 },
];

export const WHOLESALE_TIERS: WholesaleTier[] = [
  // Desodorantes: 3+ = $2500, 6+ = $2200, 12+ = $1990
  { id: 'wt-1', variantGroupId: 'vg-1', priceListId: 'pl-2', minQty: 3, unitPrice: 2500 },
  { id: 'wt-2', variantGroupId: 'vg-1', priceListId: 'pl-2', minQty: 6, unitPrice: 2200 },
  { id: 'wt-3', variantGroupId: 'vg-1', priceListId: 'pl-2', minQty: 12, unitPrice: 1990 },
  
  // Jabones: 3+ = $1700, 6+ = $1500, 12+ = $1290
  { id: 'wt-4', variantGroupId: 'vg-2', priceListId: 'pl-2', minQty: 3, unitPrice: 1700 },
  { id: 'wt-5', variantGroupId: 'vg-2', priceListId: 'pl-2', minQty: 6, unitPrice: 1500 },
  { id: 'wt-6', variantGroupId: 'vg-2', priceListId: 'pl-2', minQty: 12, unitPrice: 1290 },
  
  // Shampoos: 3+ = $2990, 6+ = $2690, 9+ = $2390
  { id: 'wt-7', variantGroupId: 'vg-3', priceListId: 'pl-2', minQty: 3, unitPrice: 2990 },
  { id: 'wt-8', variantGroupId: 'vg-3', priceListId: 'pl-2', minQty: 6, unitPrice: 2690 },
  { id: 'wt-9', variantGroupId: 'vg-3', priceListId: 'pl-2', minQty: 9, unitPrice: 2390 },
];

// Add single variant groups for products without wholesale
export const ALL_VARIANT_GROUPS: VariantGroup[] = [
  ...VARIANT_GROUPS,
  { id: 'vg-single-1', name: 'Arroz Grado 1', description: 'Producto individual' },
  { id: 'vg-single-2', name: 'Aceite Vegetal', description: 'Producto individual' },
];

export const STOCK: Stock[] = [
  // Branch 1
  { branchId: 'branch-1', variantId: 'var-1', quantity: 50, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-2', quantity: 45, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-3', quantity: 30, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-4', quantity: 60, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-5', quantity: 55, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-6', quantity: 40, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-7', quantity: 35, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-8', quantity: 100, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-1', variantId: 'var-9', quantity: 80, lastUpdated: new Date().toISOString() },
  // Branch 2
  { branchId: 'branch-2', variantId: 'var-1', quantity: 30, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-2', variantId: 'var-2', quantity: 25, lastUpdated: new Date().toISOString() },
  { branchId: 'branch-2', variantId: 'var-8', quantity: 70, lastUpdated: new Date().toISOString() },
];

export const CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: 'Cliente General', rut: '66666666-6', email: 'general@example.com' },
  { id: 'cust-2', name: 'Comercial ABC Ltda.', rut: '76543210-K', email: 'compras@abc.cl', phone: '+56912345678', address: 'Calle Comercio 123' },
  { id: 'cust-3', name: 'Minimarket Don Juan', rut: '77889900-1', email: 'donjuan@minimarket.cl', phone: '+56987654321' },
];

export const SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Distribuidora Nacional', rut: '96111222-3', email: 'ventas@distnac.cl', phone: '+56223334455', isActive: true },
  { id: 'sup-2', name: 'Importadora del Sur', rut: '96222333-4', email: 'pedidos@impsur.cl', isActive: true },
];

export const EMPLOYEES: Employee[] = [
  { id: 'emp-1', branchId: 'branch-1', name: 'Carlos López', rut: '18765432-1', position: 'Reponedor', isActive: true },
  { id: 'emp-2', branchId: 'branch-1', name: 'Ana Muñoz', rut: '19876543-2', position: 'Cajera', isActive: true },
  { id: 'emp-3', branchId: 'branch-2', name: 'Pedro Soto', rut: '17654321-0', position: 'Bodeguero', isActive: true },
];

// Mutable state for mock
export const mockState = {
  cashSessions: [] as CashSession[],
  cashMovements: [] as CashMovement[],
  salesDocuments: [] as SalesDocument[],
  salesLines: [] as SalesLine[],
  payments: [] as Payment[],
  dteRequests: [] as DTERequest[],
  inventoryMovements: [] as InventoryMovement[],
  inventoryLines: [] as InventoryLine[],
  purchaseInvoices: [] as PurchaseInvoice[],
  purchaseLines: [] as PurchaseLine[],
  employeeAdvances: [] as EmployeeAdvance[],
  auditLogs: [] as AuditLog[],
  stock: [...STOCK],
  customers: [...CUSTOMERS],
  suppliers: [...SUPPLIERS],
  employees: [...EMPLOYEES],
  products: [...PRODUCTS],
  variants: [...VARIANTS],
  variantGroups: [...ALL_VARIANT_GROUPS],
  variantPrices: [...VARIANT_PRICES],
  wholesaleTiers: [...WHOLESALE_TIERS],
  users: [...USERS],
  categories: [...PRODUCT_CATEGORIES],
};

// Helper to get variant with product info
export function getVariantWithProduct(variantId: string): VariantWithProduct | null {
  const variant = mockState.variants.find(v => v.id === variantId);
  if (!variant) return null;
  
  const product = mockState.products.find(p => p.id === variant.productId);
  const variantGroup = mockState.variantGroups.find(vg => vg.id === variant.variantGroupId);
  
  if (!product || !variantGroup) return null;
  
  return { ...variant, product, variantGroup };
}

export function getAllVariantsWithProducts(): VariantWithProduct[] {
  return mockState.variants
    .map(v => getVariantWithProduct(v.id))
    .filter((v): v is VariantWithProduct => v !== null);
}

export function getVariantPrice(variantId: string, priceListId: string = 'pl-1'): number {
  const price = mockState.variantPrices.find(
    vp => vp.variantId === variantId && vp.priceListId === priceListId
  );
  return price?.price ?? 0;
}
