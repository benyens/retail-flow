import type { PrismaClient } from '@prisma/client';
export class LookupService {
  constructor(private readonly prisma: PrismaClient) {}
  branches(branchIds: string[]) { return this.prisma.branch.findMany({ where: { isActive: true, id: { in: branchIds } }, orderBy: { name: 'asc' } }); }
  registers(branchId: string) { return this.prisma.cashRegister.findMany({ where: { branchId, isActive: true }, orderBy: { name: 'asc' } }); }
  prices() { return this.prisma.priceList.findMany({ orderBy: { name: 'asc' } }); }
  categories() { return this.prisma.productCategory.findMany({ orderBy: { name: 'asc' } }); }
  createCategory(data: { name: string; description?: string; isActive: boolean }) { return this.prisma.productCategory.create({ data }); }
  updateCategory(id: string, data: Partial<{ name: string; description: string; isActive: boolean }>) { return this.prisma.productCategory.update({ where: { id }, data }); }
  deleteCategory(id: string) { return this.prisma.productCategory.delete({ where: { id } }); }
}
