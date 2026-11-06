import type { PrismaClient } from "@prisma/client";

export class OrganizationConflictError extends Error {
  readonly statusCode = 409;
}

/** Empresa, sucursales y cajas. Solo ADMIN (ver organization.routes.ts). */
export class OrganizationService {
  constructor(private readonly prisma: PrismaClient) {}

  /** La app maneja una sola empresa (la del seed). */
  async getCompany() {
    return this.prisma.company.findFirstOrThrow({ orderBy: { id: "asc" } });
  }

  async updateCompany(patch: Partial<{ name: string; rut: string; address: string }>) {
    const company = await this.getCompany();
    return this.prisma.company.update({ where: { id: company.id }, data: patch });
  }

  /** Todas las sucursales (también inactivas) con sus cajas, para administrarlas. */
  async listBranches() {
    return this.prisma.branch.findMany({
      orderBy: { name: "asc" },
      include: { cashRegisters: { orderBy: { name: "asc" } } },
    });
  }

  /**
   * Crea la sucursal con una "Caja 1" y la asigna a todos los ADMIN activos, para que
   * aparezca de inmediato en sus selectores. Encargados y cajeros se asignan en Usuarios.
   */
  async createBranch(input: { name: string; address: string }) {
    const company = await this.getCompany();
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { companyId: company.id, name: input.name, address: input.address } });
      await tx.cashRegister.create({ data: { branchId: branch.id, name: "Caja 1", code: "C1" } });
      const admins = await tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await tx.userBranch.createMany({ data: admins.map((a) => ({ userId: a.id, branchId: branch.id })), skipDuplicates: true });
      return tx.branch.findUniqueOrThrow({ where: { id: branch.id }, include: { cashRegisters: true } });
    });
  }

  async updateBranch(id: string, patch: Partial<{ name: string; address: string; isActive: boolean }>) {
    if (patch.isActive === false) {
      const open = await this.prisma.cashSession.count({ where: { status: "OPEN", cashRegister: { branchId: id } } });
      if (open) throw new OrganizationConflictError("La sucursal tiene cajas abiertas. Ciérralas antes de desactivarla.");
      const remaining = await this.prisma.branch.count({ where: { isActive: true, id: { not: id } } });
      if (!remaining) throw new OrganizationConflictError("Debe quedar al menos una sucursal activa.");
    }
    return this.prisma.branch.update({ where: { id }, data: patch, include: { cashRegisters: true } });
  }

  async createRegister(branchId: string, input: { name: string; code: string }) {
    await this.prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
    return this.prisma.cashRegister.create({ data: { branchId, name: input.name, code: input.code } });
  }

  async updateRegister(id: string, patch: Partial<{ name: string; code: string; isActive: boolean }>) {
    if (patch.isActive === false) {
      const open = await this.prisma.cashSession.count({ where: { status: "OPEN", cashRegisterId: id } });
      if (open) throw new OrganizationConflictError("La caja está abierta. Ciérrala antes de desactivarla.");
    }
    return this.prisma.cashRegister.update({ where: { id }, data: patch });
  }
}
