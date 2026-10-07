import { randomUUID } from 'node:crypto';
import { SessionService } from './session.service.js';
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { branches: true },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const branchIds = user.branches.map((b) => b.branchId);

    const token = fastify.jwt.sign(
      { jti: randomUUID(), sub: user.id, email: user.email, name: user.name, rut: user.rut, role: user.role, branchIds },
      { expiresIn: "12h" },
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

  fastify.post("/api/v1/auth/logout", { preHandler: [fastify.authenticate] }, async (request) => {
    const token = request.headers.authorization!.replace(/^Bearer\s+/i, '');
    // Login tokens always expire; legacy externally signed tokens are retained indefinitely.
    const expiresAt = request.user.exp ? new Date(request.user.exp * 1000) : new Date('9999-12-31');
    await new SessionService(fastify.prisma).revoke(token, expiresAt);
    return {};
  });
}
