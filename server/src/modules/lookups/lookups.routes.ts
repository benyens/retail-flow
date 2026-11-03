import { LookupService } from "./lookup.service.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
const updateCategorySchema = createCategorySchema.partial();

export async function lookupsRoutes(fastify: FastifyInstance) {
  const service = new LookupService(fastify.prisma);
  fastify.get("/api/v1/price-lists", { preHandler: [fastify.authenticate] }, async () => service.prices());
  fastify.get("/api/v1/branches", { preHandler: [fastify.authenticate] }, async (request) => {
    return service.branches(request.user.branchIds);
  });

  fastify.get("/api/v1/cash-registers", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.registers(branchId);
  });

  fastify.get("/api/v1/product-categories", { preHandler: [fastify.authenticate] }, async () => {
    return service.categories();
  });

  fastify.post(
    "/api/v1/product-categories",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const parsed = createCategorySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      const category = await service.createCategory(parsed.data);
      return reply.status(201).send(category);
    },
  );

  fastify.patch(
    "/api/v1/product-categories/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateCategorySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      const category = await service.updateCategory(id, parsed.data);
      return reply.status(200).send(category);
    },
  );

  fastify.delete(
    "/api/v1/product-categories/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await service.deleteCategory(id);
      return reply.status(204).send();
    },
  );
}
