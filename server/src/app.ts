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

// Número de proxies propios delante de la API. Solo se confía en las entradas de
// X-Forwarded-For que agregaron ellos (las de la derecha): con `true` se usaría la
// primera entrada, que el cliente puede escribir a mano y así saltarse el límite
// de intentos de login. Si te sobra un proxy, varios usuarios comparten IP (más
// estricto, nunca falsificable); por eso el valor por defecto es 1.
function trustProxyHops(): number {
  const n = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}

type PrismaLikeError = { code?: string; statusCode?: number; validation?: unknown; message?: string; meta?: { target?: unknown } };

export async function buildApp() {
  const hops = trustProxyHops();
  const app = Fastify({ logger: true, trustProxy: (_address: string, hop: number) => hop < hops, bodyLimit: 1024 * 1024 });

  // Headers de seguridad para respuestas de la API (JSON). El frontend tiene los
  // suyos en vercel.json.
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    // Datos de negocio: que ni el navegador ni proxies intermedios los guarden.
    if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  // Errores: nunca devolver mensajes internos (Prisma, SQL, stack) al cliente.
  app.setErrorHandler((error: PrismaLikeError, request, reply) => {
    if (error.code === "P2002") {
      return reply.status(409).send({ error: "CONFLICT", message: "Ya existe un registro con ese valor" });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Registro no encontrado" });
    }
    if (error.code === "P2003") {
      return reply.status(409).send({ error: "CONFLICT", message: "El registro está relacionado con otros datos" });
    }
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    if (status < 500) {
      return reply.status(status).send({ error: error.code ?? "BAD_REQUEST", message: error.message });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Error interno del servidor" });
  });

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
