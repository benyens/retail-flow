import { randomUUID } from 'node:crypto';
import { SessionService } from './session.service.js';
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuditService } from "../reports/audit.service.js";

export const PASSWORD_MIN = 10;
export const BCRYPT_COST = 12;
export const passwordSchema = z.string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(128, "La contraseña es demasiado larga");

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

// Hash fijo para comparar cuando el usuario no existe: el login tarda lo mismo
// exista o no la cuenta, y así no se pueden enumerar correos por tiempo de respuesta.
/** Duración de cada token. El cliente lo renueva antes de que venza mientras se usa. */
export const TOKEN_TTL = "12h";
/** Tope desde el login original: pasado esto hay que volver a ingresar la contraseña. */
export const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;

const DUMMY_HASH = bcrypt.hashSync("retail-flow-dummy-password", BCRYPT_COST);
const INVALID = { error: "INVALID_CREDENTIALS", message: "Correo o contraseña incorrectos" };

export async function authRoutes(fastify: FastifyInstance) {
  // Límite por cuenta: no depende de la IP, así que rotar o falsear X-Forwarded-For
  // no permite probar contraseñas sin límite contra un mismo usuario.
  const perAccountLimit = fastify.createRateLimit({
    max: 5,
    timeWindow: "1 minute",
    keyGenerator: (req) => `login-account:${String((req.body as { email?: unknown })?.email ?? "").trim().toLowerCase()}`,
  });

  fastify.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    }

    const limit = await perAccountLimit(request);
    if (!limit.isAllowed && limit.isExceeded) {
      return reply.status(429).send({ error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos para esta cuenta. Espera un minuto." });
    }

    const user = await fastify.prisma.user.findFirst({
      where: { email: { equals: parsed.data.email, mode: "insensitive" } },
      include: { branches: { include: { branch: true } } },
    });

    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || !valid) {
      return reply.status(401).send(INVALID);
    }

    const branchIds = user.branches.filter((b) => b.branch.isActive).map((b) => b.branchId);

    const token = fastify.jwt.sign(
      { jti: randomUUID(), sub: user.id, email: user.email, name: user.name, rut: user.rut, role: user.role, branchIds,
        authTime: Math.floor(Date.now() / 1000) },
      { expiresIn: TOKEN_TTL },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        rut: user.rut,
        role: user.role,
        branchIds,
        isActive: user.isActive,
      },
    };
  });

  // Renovación: entrega un token nuevo con rol y sucursales actuales, sin pedir la
  // contraseña, hasta MAX_SESSION_SECONDS desde el login. `authenticate` ya rechazó
  // tokens revocados, de usuarios inactivos o anteriores a un cambio de contraseña.
  // El token anterior no se revoca: así no fallan peticiones en curso, y vence solo.
  fastify.post("/api/v1/auth/refresh", {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const authTime = request.user.authTime ?? request.user.iat ?? 0;
    if (Date.now() / 1000 - authTime > MAX_SESSION_SECONDS) {
      return reply.status(401).send({ error: "SESSION_TOO_OLD", message: "Por seguridad, vuelve a ingresar tu contraseña" });
    }
    const user = await fastify.prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } });
    const { branchIds, role } = request.user; // ya actualizados desde la base en authenticate
    const token = fastify.jwt.sign(
      { jti: randomUUID(), sub: user.id, email: user.email, name: user.name, rut: user.rut, role, branchIds, authTime },
      { expiresIn: TOKEN_TTL },
    );
    return { token, user: { id: user.id, email: user.email, name: user.name, rut: user.rut, role, branchIds, isActive: user.isActive } };
  });

  fastify.post("/api/v1/auth/logout", { preHandler: [fastify.authenticate] }, async (request) => {
    const token = request.headers.authorization!.replace(/^Bearer\s+/i, '');
    // Login tokens always expire; legacy externally signed tokens are retained indefinitely.
    const expiresAt = request.user.exp ? new Date(request.user.exp * 1000) : new Date('9999-12-31');
    await new SessionService(fastify.prisma).revoke(token, expiresAt);
    return {};
  });

  // Cambio de contraseña propio: exige la actual. Cierra las demás sesiones del
  // usuario (tokensValidAfter) y devuelve un token nuevo para seguir conectado.
  fastify.post("/api/v1/auth/change-password", {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message, issues: parsed.error.flatten() });
    }
    const user = await fastify.prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } });
    if (!await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
      return reply.status(400).send({ error: "INVALID_CURRENT_PASSWORD", message: "La contraseña actual no es correcta" });
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return reply.status(400).send({ error: "SAME_PASSWORD", message: "La nueva contraseña debe ser distinta de la actual" });
    }
    // Segundo completo: el `iat` del JWT tiene resolución de segundos.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    await fastify.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST), tokensValidAfter: now },
      });
      await AuditService.log(tx, { userId: user.id, action: "CHANGE_OWN_PASSWORD", entityType: "User", entityId: user.id });
    });
    const { sub, email, name, rut, role, branchIds } = request.user;
    const authTime = request.user.authTime ?? request.user.iat;
    const token = fastify.jwt.sign({ jti: randomUUID(), sub, email, name, rut, role, branchIds, authTime }, { expiresIn: TOKEN_TTL });
    return { token };
  });
}
