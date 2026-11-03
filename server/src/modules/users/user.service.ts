import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuditService } from "../reports/audit.service.js";

function toUserDTO(u: { id: string; email: string; name: string; rut: string; role: string; isActive: boolean; branches: { branchId: string }[] }) {
  return { id: u.id, email: u.email, name: u.name, rut: u.rut, role: u.role, branchIds: u.branches.map((b) => b.branchId), isActive: u.isActive };
}

export class UserConflictError extends Error {
  readonly statusCode = 409;
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({ include: { branches: true }, orderBy: { name: "asc" } });
    return users.map(toUserDTO);
  }

  async createUser(input: { email: string; name: string; rut: string; role: "ADMIN" | "MANAGER" | "CASHIER"; branchIds: string[]; isActive: boolean; password: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new UserConflictError("Ya existe un usuario con ese email");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, rut: input.rut, role: input.role, isActive: input.isActive, passwordHash },
      });
      if (input.branchIds.length > 0) {
        await tx.userBranch.createMany({ data: input.branchIds.map((branchId) => ({ userId: created.id, branchId })) });
      }
      return tx.user.findUniqueOrThrow({ where: { id: created.id }, include: { branches: true } });
    });

    return toUserDTO(user);
  }

  async updateUser(
    id: string,
    patch: Partial<{ email: string; name: string; rut: string; role: "ADMIN" | "MANAGER" | "CASHIER"; branchIds: string[]; isActive: boolean }>,
    performedBy: string,
  ) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: { branches: true } });

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { email: patch.email, name: patch.name, rut: patch.rut, role: patch.role, isActive: patch.isActive },
      });
      if (patch.branchIds !== undefined) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        if (patch.branchIds.length > 0) {
          await tx.userBranch.createMany({ data: patch.branchIds.map((branchId) => ({ userId: id, branchId })) });
        }
      }

      // Auditoría solo cuando cambia el rol -- es la acción sensible acá,
      // no cualquier edición de datos de contacto.
      if (patch.role !== undefined || patch.isActive !== undefined || patch.branchIds !== undefined) {
        await AuditService.log(tx, {
          userId: performedBy, action: "CHANGE_USER_ACCESS", entityType: "User", entityId: id,
          beforeData: { role: before.role, isActive: before.isActive, branchIds: before.branches.map(b => b.branchId) }, afterData: { role: patch.role ?? before.role, isActive: patch.isActive ?? before.isActive, branchIds: patch.branchIds ?? before.branches.map(b => b.branchId) },
        });
      }

      return tx.user.findUniqueOrThrow({ where: { id }, include: { branches: true } });
    });
    return toUserDTO(user);
  }
}
