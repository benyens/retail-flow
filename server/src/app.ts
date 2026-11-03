import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from '@fastify/rate-limit';
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { lookupsRoutes } from "./modules/lookups/lookups.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { stockRoutes } from "./modules/stock/stock.routes.js";
import { cashRoutes } from "./modules/cash/cash.routes.js";
import { customersRoutes } from "./modules/sales/customers.routes.js";
import { salesRoutes } from "./modules/sales/sales.routes.js";
import { purchasesRoutes } from "./modules/purchases/purchases.routes.js";
import { employeesRoutes } from "./modules/employees/employees.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";

function parseCorsOrigins(): string[] {
  const isProd = process.env.NODE_ENV === "production";
  const raw = process.env.CORS_ORIGINS ?? (isProd ? "" : "http://localhost:8080,http://localhost:5173");
  // Normaliza: sin espacios, sin barra final, sin entradas vacías.
  const origins = raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (isProd && origins.length === 0) {
    throw new Error("CORS_ORIGINS vacío: define la URL de Vercel (https://NOMBRE.vercel.app, sin barra final).");
  }
  return origins;
}

export async function buildApp() {
  // trustProxy: detrás de Render el IP real viene en X-Forwarded-For; sin esto
  // el rate-limit cuenta a todos los usuarios como una sola IP.
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin: parseCorsOrigins(),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.register(rateLimit, { global: false, max: 10, timeWindow: '1 minute' });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(lookupsRoutes);
  await app.register(catalogRoutes);
  await app.register(stockRoutes);
  await app.register(cashRoutes);
  await app.register(customersRoutes);
  await app.register(salesRoutes);
  await app.register(purchasesRoutes);
  await app.register(employeesRoutes);
  await app.register(usersRoutes);
  await app.register(reportsRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
