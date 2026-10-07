import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PurchaseService, PurchaseConflictError } from "./purchase.service.js";

const supplierSchema = z.object({
  name: z.string().min(1), rut: z.string().min(1), email: z.string().email().optional(),
  phone: z.string().optional(), address: z.string().optional(), isActive: z.boolean().default(true), businessLine: z.string().optional(),
});
const supplierPatchSchema = supplierSchema.partial();
const purchaseLineSchema = z.object({ variantId: z.string().min(1), quantity: z.number().finite().positive(), unitCost: z.number().finite().nonnegative() });
const createPurchaseSchema = z.object({
  branchId: z.string().min(1), supplierId: z.string().min(1), invoiceNumber: z.string().trim().min(1),
  invoiceDate: z.string().min(1).refine(v => !isNaN(new Date(v).getTime()), "Fecha inválida"), notes: z.string().optional().default(""), lines: z.array(purchaseLineSchema).min(1),
});
const updatePurchaseSchema = z.object({ invoiceNumber: z.string().optional(), invoiceDate: z.string().refine(v => !isNaN(new Date(v).getTime()), "Fecha inválida").optional(), notes: z.string().optional() });

export async function purchasesRoutes(fastify: FastifyInstance) {
  const service = new PurchaseService(fastify.prisma);
  const ro = [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])];
  const rw = [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])];

  function handleError(err: unknown, reply: import("fastify").FastifyReply, request: import("fastify").FastifyRequest) {
    if (err instanceof PurchaseConflictError) return reply.status(err.statusCode).send({ error: "PURCHASE_CONFLICT", message: err.message });
    request.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_ERROR" });
  }

  fastify.get("/api/v1/suppliers", { preHandler: ro }, async () => service.listSuppliers());
  fastify.post("/api/v1/suppliers", { preHandler: rw }, async (request, reply) => {
    const parsed = supplierSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(201).send(await service.createSupplier(parsed.data));
  });
  fastify.patch("/api/v1/suppliers/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = supplierPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(200).send(await service.updateSupplier(id, parsed.data));
  });

  fastify.get("/api/v1/purchases", { preHandler: ro }, async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.listPurchases(branchId);
  });
  fastify.post("/api/v1/purchases", { preHandler: rw }, async (request, reply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const { branchId, supplierId, invoiceNumber, invoiceDate, notes, lines } = parsed.data;
      const invoice = await service.createPurchase(branchId, supplierId, invoiceNumber, invoiceDate, notes, lines, request.user.sub);
      return reply.status(201).send(invoice);
    } catch (err) { return handleError(err, reply, request); }
  });
  fastify.patch("/api/v1/purchases/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePurchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(200).send(await service.updatePurchaseInvoice(id, parsed.data, request.user.sub)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.post("/api/v1/purchases/:id/send-sii", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try { return reply.status(200).send(await service.sendPurchaseInvoiceToSII(id, request.user.sub)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.get("/api/v1/purchases/:id/lines", { preHandler: ro }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getPurchaseLines(id);
  });
}
