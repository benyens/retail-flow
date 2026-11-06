import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { StockService } from "./stock.service.js";

const adjustmentSchema = z.object({
  branchId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().finite(),
  notes: z.string().min(1),
});

export async function stockRoutes(fastify: FastifyInstance) {
  const service = new StockService(fastify.prisma);
  const ro = [fastify.authenticate];
  const rw = [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])];

  fastify.get("/api/v1/stock", { preHandler: ro }, async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.getStock(branchId);
  });
  fastify.get("/api/v1/stock/by-variant/:variantId", { preHandler: ro }, async (request) => {
    const { variantId } = request.params as { variantId: string };
    return service.getStockByVariant(variantId, request.user.branchIds);
  });
  fastify.get("/api/v1/inventory-movements", { preHandler: ro }, async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.getInventoryMovements(branchId);
  });
  fastify.get("/api/v1/inventory-lines/:movementId", { preHandler: ro }, async (request) => {
    const { movementId } = request.params as { movementId: string };
    return service.getInventoryLines(movementId);
  });
  const minSchema = z.object({ branchId: z.string().min(1), variantId: z.string().min(1),
    minQuantity: z.number().finite().min(0).max(1_000_000).nullable() });
  fastify.put("/api/v1/stock/minimum", { preHandler: rw }, async (request, reply) => {
    const parsed = minSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    const { branchId, variantId, minQuantity } = parsed.data;
    return service.setMinStock(branchId, variantId, minQuantity, request.user.sub);
  });
  fastify.post("/api/v1/stock/adjustments", { preHandler: rw }, async (request, reply) => {
    const parsed = adjustmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    const { branchId, variantId, quantity, notes } = parsed.data;
    const movement = await service.createAdjustment(branchId, variantId, quantity, notes, request.user.sub);
    return reply.status(201).send(movement);
  });
}
