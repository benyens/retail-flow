import type { PrismaClient } from "@prisma/client";

function toAdvanceDTO(a: { id: string; employeeId: string; cashSessionId: string; cashMovementId: string; type: string; amount: unknown; reason: string; createdAt: Date }) {
  return { id: a.id, employeeId: a.employeeId, cashSessionId: a.cashSessionId, cashMovementId: a.cashMovementId, type: a.type, amount: Number(a.amount), reason: a.reason, createdAt: a.createdAt.toISOString() };
}

export class EmployeeService {
  constructor(private readonly prisma: PrismaClient) {}

  async listEmployees(branchId: string) {
    return this.prisma.employee.findMany({ where: { branchId }, orderBy: { name: "asc" } });
  }

  async createEmployee(input: { branchId: string; name: string; rut: string; position: string; isActive: boolean }) {
    return this.prisma.employee.create({ data: input });
  }

  async updateEmployee(id: string, patch: Record<string, unknown>) {
    return this.prisma.employee.update({ where: { id }, data: patch });
  }

  async getEmployeeAdvances(employeeId: string) {
    const advances = await this.prisma.employeeAdvance.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });
    return advances.map(toAdvanceDTO);
  }
}
