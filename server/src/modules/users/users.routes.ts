import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserService, UserConflictError } from "./user.service.js";

const createUserSchema = z.object({
  email: z.string().email(), name: z.string().min(1), rut: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]), branchIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true), password: z.string().min(8, "Mínimo 8 caracteres"),
});
const updateUserSchema = z.object({
  email: z.string().email().optional(), name: z.string().min(1).optional(), rut: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]).optional(), branchIds: z.array(z.string()).optional(), isActive: z.boolean().optional(),
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
    return reply.status(200).send(await service.updateUser(id, parsed.data, request.user.sub));
  });
}
