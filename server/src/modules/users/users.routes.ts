import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserService, UserConflictError } from "./user.service.js";
import { passwordSchema } from "../auth/auth.routes.js";

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(1).max(120), rut: z.string().trim().min(1).max(20),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]), branchIds: z.array(z.string()).max(100).default([]),
  isActive: z.boolean().default(true), password: passwordSchema,
});
const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(), name: z.string().trim().min(1).max(120).optional(), rut: z.string().trim().min(1).max(20).optional(),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]).optional(), branchIds: z.array(z.string()).max(100).optional(), isActive: z.boolean().optional(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  const service = new UserService(fastify.prisma);
  const adminOnly = [fastify.authenticate, fastify.authorize(["ADMIN"])];

  fastify.get("/api/v1/users", { preHandler: adminOnly }, async () => service.listUsers());

  fastify.post("/api/v1/users", { preHandler: adminOnly }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      return reply.status(201).send(await service.createUser(parsed.data));
    } catch (err) {
      if (err instanceof UserConflictError) return reply.status(err.statusCode).send({ error: "USER_CONFLICT", message: err.message });
      request.log.error(err);
      return reply.status(500).send({ error: "INTERNAL_ERROR" });
    }
  });

  fastify.patch("/api/v1/users/:id", { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      return reply.status(200).send(await service.updateUser(id, parsed.data, request.user.sub));
    } catch (err) {
      if (err instanceof UserConflictError) return reply.status(err.statusCode).send({ error: "USER_CONFLICT", message: err.message });
      throw err;
    }
  });

  fastify.post("/api/v1/users/:id/password", { preHandler: adminOnly, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ newPassword: passwordSchema }).safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message, issues: parsed.error.flatten() });
    await service.resetPassword(id, parsed.data.newPassword, request.user.sub);
    return reply.status(204).send();
  });
}
