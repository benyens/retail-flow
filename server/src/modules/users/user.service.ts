import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "../auth/auth.routes.js";
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
    const existing = await this.prisma.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } } });
    if (existing) throw new UserConflictError("Ya existe un usuario con ese email");

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

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

    if (patch.email && patch.email !== before.email) {
      const taken = await this.prisma.user.findFirst({ where: { email: { equals: patch.email, mode: "insensitive" }, id: { not: id } } });
      if (taken) throw new UserConflictError("Ya existe un usuario con ese email");
    }
    // Evita quedar fuera del sistema: un admin no puede quitarse a sí mismo el rol
    // ni desactivarse, y siempre debe quedar al menos un ADMIN activo.
    const losesAdmin = before.role === "ADMIN" && before.isActive &&
      ((patch.role !== undefined && patch.role !== "ADMIN") || patch.isActive === false);
    if (losesAdmin) {
      if (id === performedBy) throw new UserConflictError("No puedes quitarte el rol de administrador ni desactivar tu propia cuenta");
      const activeAdmins = await this.prisma.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) throw new UserConflictError("Debe quedar al menos un administrador activo");
    }

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

  /** Reset de contraseña por un ADMIN: invalida todas las sesiones del usuario. */
  async resetPassword(id: string, newPassword: string, performedBy: string) {
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), tokensValidAfter: now } });
      await AuditService.log(tx, { userId: performedBy, action: "RESET_USER_PASSWORD", entityType: "User", entityId: id });
    });
  }
}
