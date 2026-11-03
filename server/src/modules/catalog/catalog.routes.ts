import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CatalogService, CatalogConflictError, CatalogNotFoundError } from "./catalog.service.js";

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  isActive: z.boolean(),
  allowedBranchIds: z.array(z.string()).nullable().optional(),
});
const productPatchSchema = productSchema.partial();
const variantGroupSchema = z.object({ name: z.string().min(1), description: z.string().optional() });
const variantGroupPatchSchema = variantGroupSchema.partial();
const variantSchema = z.object({
  productId: z.string().min(1),
  variantGroupId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  attributes: z.record(z.string(), z.string()),
  unit: z.string().min(1),
  barcode: z.string().optional(),
  isActive: z.boolean(),
  lastPurchaseCost: z.number().finite().nullable().optional(),
  lastPurchaseDate: z.string().nullable().optional(),
});
const variantPatchSchema = variantSchema.partial();
const quickProductSchema = z.object({
  mode: z.enum(["NEW_PRODUCT", "ADD_VARIANT"]),
  productName: z.string().optional(),
  existingProductId: z.string().optional(),
  variantName: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  salePrice: z.number().finite().positive(),
  lastPurchaseCost: z.number().finite().optional(),
  unit: z.string().optional(),
  categoryId: z.string().nullable().optional(),
});
const setVariantPriceSchema = z.object({ variantId: z.string().min(1), priceListId: z.string().min(1), price: z.number().finite().positive() });
const wholesaleTierSchema = z.object({ variantGroupId: z.string().min(1), priceListId: z.string().min(1), minQty: z.number().finite().int().positive(), unitPrice: z.number().finite().positive() });
const wholesaleTierPatchSchema = wholesaleTierSchema.partial();

export async function catalogRoutes(fastify: FastifyInstance) {
  const service = new CatalogService(fastify.prisma);

  function handleError(err: unknown, reply: import("fastify").FastifyReply, request: import("fastify").FastifyRequest) {
    if (err instanceof CatalogConflictError) return reply.status(err.statusCode).send({ error: "CATALOG_CONFLICT", message: err.message });
    if (err instanceof CatalogNotFoundError) return reply.status(err.statusCode).send({ error: "CATALOG_NOT_FOUND", message: err.message });
    request.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_ERROR" });
  }

  const rw = [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])];
  const ro = [fastify.authenticate];

  fastify.get("/api/v1/products", { preHandler: ro }, async () => service.listProducts());
  fastify.post("/api/v1/products", { preHandler: rw }, async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(201).send(await service.createProduct(parsed.data)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.patch("/api/v1/products/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = productPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(200).send(await service.updateProduct(id, parsed.data)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.delete("/api/v1/products/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try { await service.deleteProduct(id); return reply.status(204).send(); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.post("/api/v1/products/quick", { preHandler: rw }, async (request, reply) => {
    const parsed = quickProductSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(201).send(await service.createQuickProduct(parsed.data)); } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/variant-groups", { preHandler: ro }, async () => service.listVariantGroups());
  fastify.post("/api/v1/variant-groups", { preHandler: rw }, async (request, reply) => {
    const parsed = variantGroupSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(201).send(await service.createVariantGroup(parsed.data));
  });
  fastify.patch("/api/v1/variant-groups/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = variantGroupPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(200).send(await service.updateVariantGroup(id, parsed.data));
  });
  fastify.delete("/api/v1/variant-groups/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try { await service.deleteVariantGroup(id); return reply.status(204).send(); } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/variants", { preHandler: ro }, async (request) => {
    const { branchId } = request.query as { branchId?: string };
    return service.listVariants(branchId);
  });
  fastify.get("/api/v1/variants/search", { preHandler: ro }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 1) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "q es requerido" });
    return service.searchVariants(q);
  });
  fastify.post("/api/v1/variants", { preHandler: rw }, async (request, reply) => {
    const parsed = variantSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(201).send(await service.createVariant(parsed.data)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.patch("/api/v1/variants/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = variantPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try { return reply.status(200).send(await service.updateVariant(id, parsed.data)); } catch (err) { return handleError(err, reply, request); }
  });
  fastify.delete("/api/v1/variants/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try { await service.deleteVariant(id); return reply.status(204).send(); } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/variant-prices", { preHandler: ro }, async () => service.listVariantPrices());
  fastify.put("/api/v1/variant-prices", { preHandler: rw }, async (request, reply) => {
    const parsed = setVariantPriceSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    const { variantId, priceListId, price } = parsed.data;
    return reply.status(200).send(await service.setVariantPrice(variantId, priceListId, price, request.user.sub));
  });

  fastify.get("/api/v1/wholesale-tiers", { preHandler: ro }, async () => service.listWholesaleTiers());
  fastify.post("/api/v1/wholesale-tiers", { preHandler: rw }, async (request, reply) => {
    const parsed = wholesaleTierSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(201).send(await service.createWholesaleTier(parsed.data));
  });
  fastify.patch("/api/v1/wholesale-tiers/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = wholesaleTierPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(200).send(await service.updateWholesaleTier(id, parsed.data));
  });
  fastify.delete("/api/v1/wholesale-tiers/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteWholesaleTier(id);
    return reply.status(204).send();
  });
}
