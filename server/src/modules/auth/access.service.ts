import type { PrismaClient } from '@prisma/client';
import type { JwtUserPayload } from '../../plugins/auth.js';

/** Resource checks run inside authenticate, alongside authorize's role checks. */
export class AccessService {
  constructor(private readonly prisma: PrismaClient) {}

  async currentUser(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { branches: { include: { branch: true } } } });
  }

  async canAccess(user: JwtUserPayload, route: string, params: Record<string, unknown>,
    query: Record<string, unknown>, body: Record<string, unknown>) {
    const allowed = (id: unknown) => typeof id === 'string' && user.branchIds.includes(id);
    for (const source of [query, body]) {
      if (source.branchId !== undefined && !allowed(source.branchId)) return false;
    }
    const checkSession = async (id: unknown) => {
      if (typeof id !== 'string') return false;
      const session = await this.prisma.cashSession.findUnique({ where: { id }, include: { cashRegister: true } });
      return !!session && allowed(session.cashRegister.branchId) &&
        (user.role !== 'CASHIER' || session.userId === user.sub);
    };
    for (const source of [query, body]) {
      if (source.sessionId !== undefined && !await checkSession(source.sessionId)) return false;
      if (source.cashRegisterId !== undefined) {
        if (typeof source.cashRegisterId !== 'string') return false;
        const register = await this.prisma.cashRegister.findUnique({ where: { id: source.cashRegisterId } });
        if (!register?.isActive || !allowed(register.branchId)) return false;
      }
    }
    if (route.startsWith('/api/v1/cash-sessions/:id') && !await checkSession(params.id)) return false;
    const id = typeof params.id === 'string' ? params.id : '';
    if (route.startsWith('/api/v1/purchases/:id')) {
      const resource = await this.prisma.purchaseInvoice.findUnique({ where: { id } });
      if (!resource || !allowed(resource.branchId)) return false;
    }
    if (route.startsWith('/api/v1/sales/:id') || body.originalSaleId !== undefined) {
      const saleId = body.originalSaleId ?? id;
      if (typeof saleId !== 'string') return false;
      const resource = await this.prisma.salesDocument.findUnique({ where: { id: saleId } });
      if (!resource || !allowed(resource.branchId)) return false;
    }
    if (route.startsWith('/api/v1/dte-requests/:id')) {
      const resource = await this.prisma.dTERequest.findUnique({ where: { id }, include: { salesDocument: true } });
      if (!resource || !allowed(resource.salesDocument.branchId)) return false;
    }
    if (route.startsWith('/api/v1/inventory-lines/')) {
      if (typeof params.movementId !== 'string') return false;
      const resource = await this.prisma.inventoryMovement.findUnique({ where: { id: params.movementId } });
      if (!resource || !allowed(resource.branchId)) return false;
    }
    if (route.startsWith('/api/v1/employees/:id') || body.employeeId !== undefined) {
      const employeeId = body.employeeId ?? id;
      if (typeof employeeId !== 'string') return false;
      const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee || !allowed(employee.branchId)) return false;
      if (route.startsWith('/api/v1/cash-sessions/:id')) {
        const session = await this.prisma.cashSession.findUnique({ where: { id }, include: { cashRegister: true } });
        if (session?.cashRegister.branchId !== employee.branchId) return false;
      }
    }
    return true;
  }
}
