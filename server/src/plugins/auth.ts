import { SessionService } from '../modules/auth/session.service.js';
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { AccessService } from '../modules/auth/access.service.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface JwtUserPayload {
  sub: string;
  jti?: string;
  exp?: number;
  email: string;
  name: string;
  rut: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  branchIds: string[];
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles: JwtUserPayload["role"][]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado en las variables de entorno");
  if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret.includes('cambia-esto'))) {
    throw new Error('JWT_SECRET de producción debe ser aleatorio y tener al menos 32 caracteres');
  }

  await fastify.register(jwt, { secret, sign: { algorithm: 'HS256' }, verify: { algorithms: ['HS256'] } });
  const sessions = new SessionService(fastify.prisma);
  const access = new AccessService(fastify.prisma);

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "UNAUTHENTICATED", message: "Token inválido o ausente" });
    }
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    if (await sessions.isRevoked(token)) return reply.status(401).send({ error: 'UNAUTHENTICATED', message: 'Sesión cerrada' });
    const current = await access.currentUser(request.user.sub);
    if (!current?.isActive) return reply.status(401).send({ error: 'UNAUTHENTICATED', message: 'Usuario inactivo o inexistente' });
    request.user = { ...request.user, role: current.role,
      branchIds: current.branches.filter(b => b.branch.isActive).map(b => b.branchId) };
    if (!await access.canAccess(request.user, request.routeOptions.url ?? '',
      (request.params ?? {}) as Record<string, unknown>, (request.query ?? {}) as Record<string, unknown>,
      (request.body ?? {}) as Record<string, unknown>)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Sin acceso a la sucursal o recurso solicitado' });
    }
  });

  fastify.decorate(
    "authorize",
    (roles: JwtUserPayload["role"][]) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!roles.includes(request.user.role)) {
          return reply.status(403).send({ error: "FORBIDDEN", message: "No tienes permisos para esta acción" });
        }
      },
  );
});
