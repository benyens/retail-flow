import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SaleService, SaleConflictError, InsufficientStockError } from "./sale.service.js";

const saleLineSchema = z.object({
  variantId: z.string().min(1),
  variantGroupId: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative(),
  priceSource: z.enum(["NORMAL", "WHOLESALE", "MANUAL"]),
  wholesaleMinQtyApplied: z.number().finite().int().positive().optional(),
  wholesaleUnitPriceApplied: z.number().finite().nonnegative().optional(),
  subtotal: z.number().finite().nonnegative(),
});
const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"]),
  amount: z.number().finite().positive(),
  reference: z.string().optional(),
});
const createSaleSchema = z.object({
  branchId: z.string().min(1),
  sessionId: z.string().min(1),
  customerId: z.string().nullable(),
  docType: z.enum(["BOLETA", "FACTURA"]),
  lines: z.array(saleLineSchema).min(1),
  payments: z.array(paymentSchema).min(1),
});
const voidSaleSchema = z.object({ reason: z.string().min(1) });
const creditNoteSchema = z.object({
  originalSaleId: z.string().min(1),
  refType: z.enum(["ANULACION_TOTAL", "DEVOLUCION_PARCIAL", "CORRECCION_MONTO"]),
  lines: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().finite().positive() })).min(1),
  refundMethod: z.enum(["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"]),
});

export async function salesRoutes(fastify: FastifyInstance) {
  const service = new SaleService(fastify.prisma);
  const ro = [fastify.authenticate];

  function handleError(err: unknown, reply: import("fastify").FastifyReply, request: import("fastify").FastifyRequest) {
    if (err instanceof SaleConflictError) return reply.status(err.statusCode).send({ error: "SALE_CONFLICT", message: err.message });
    if (err instanceof InsufficientStockError) return reply.status(err.statusCode).send({ error: "INSUFFICIENT_STOCK", message: err.message });
    request.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_ERROR" });
  }

  fastify.post("/api/v1/sales", { preHandler: ro }, async (request, reply) => {
    const parsed = createSaleSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const { branchId, sessionId, customerId, docType, lines, payments } = parsed.data;
      const result = await service.createSale(branchId, sessionId, customerId, docType, lines, payments, request.user.sub);
      return reply.status(201).send(result);
    } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/sales", { preHandler: ro }, async (request, reply) => {
    const { branchId, sessionId } = request.query as { branchId?: string; sessionId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.getSales(branchId, sessionId);
  });

  fastify.get("/api/v1/sales/:id", { preHandler: ro }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getSaleDetail(id);
  });

  fastify.post("/api/v1/sales/:id/void", { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = voidSaleSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const result = await service.voidSaleInternal(id, parsed.data.reason, request.user.sub);
      return reply.status(200).send(result);
    } catch (err) { return handleError(err, reply, request); }
  });

  fastify.post(
    "/api/v1/sales/credit-notes",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const parsed = creditNoteSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      try {
        const { originalSaleId, refType, lines, refundMethod } = parsed.data;
        const result = await service.createCreditNote(originalSaleId, refType, lines, refundMethod, request.user.sub);
        return reply.status(201).send(result);
      } catch (err) { return handleError(err, reply, request); }
    },
  );

  fastify.post(
    "/api/v1/dte-requests/:id/retry",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return reply.status(200).send(await service.retryDTE(id));
      } catch (err) { return handleError(err, reply, request); }
    },
  );
}
