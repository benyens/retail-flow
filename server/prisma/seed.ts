import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || 'admin@retailflow.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin1234';
  if (process.env.NODE_ENV === 'production' &&
      (!process.env.SEED_ADMIN_EMAIL || !email.includes('@') || !process.env.SEED_ADMIN_PASSWORD || password.length < 16 || password === 'admin1234')) {
    throw new Error('Configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 16 caracteres) para inicializar la demo publicada.');
  }

  const company = await prisma.company.upsert({
    where: { rut: "76.000.000-0" },
    update: {},
    create: { name: "Empresa de Ejemplo", rut: "76.000.000-0", address: "Sin dirección" },
  });

  const branch = await prisma.branch.upsert({
    where: { id: "seed-branch-matriz" },
    update: {},
    create: { id: "seed-branch-matriz", companyId: company.id, name: "Casa Matriz", address: "Sin dirección" },
  });

  await prisma.cashRegister.upsert({
    where: { branchId_code: { branchId: branch.id, code: "CAJA-1" } },
    update: {},
    create: { branchId: branch.id, name: "Caja 1", code: "CAJA-1" },
  });

  await prisma.priceList.upsert({ where: { type: "NORMAL" }, update: {}, create: { type: "NORMAL", name: "Precio Normal" } });
  await prisma.priceList.upsert({ where: { type: "MAYORISTA" }, update: {}, create: { type: "MAYORISTA", name: "Precio Mayorista" } });

  await prisma.productCategory.upsert({ where: { name: "General" }, update: {}, create: { name: "General" } });

  await prisma.supplier.upsert({
    where: { rut: "77.000.000-0" },
    update: {},
    create: { name: "Proveedor de Ejemplo", rut: "77.000.000-0", isActive: true },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: "Administrador", rut: "11.111.111-1", role: "ADMIN" },
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
    update: {},
    create: { userId: admin.id, branchId: branch.id },
  });

  console.log(
    "Seed completado: Company, Branch (MATRIZ), CashRegister (CAJA-1), PriceLists (NORMAL, MAYORISTA), " +
      "ProductCategory (General), Supplier de ejemplo, User ADMIN (credenciales configuradas; usuarios existentes no se modifican)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
