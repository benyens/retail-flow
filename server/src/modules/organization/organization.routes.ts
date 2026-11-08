import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OrganizationService } from "./organization.service.js";

const text = (max: number) => z.string().trim().min(1, "Campo obligatorio").max(max);
const companySchema = z.object({ name: text(120), rut: text(20), address: text(200) }).partial();
const branchCreate = z.object({ name: text(80), address: text(200) });
const branchUpdate = branchCreate.extend({ isActive: z.boolean(), priceListId: z.string().min(1).nullable() }).partial();
const priceListCreate = z.object({ name: text(60), copyFromId: z.string().min(1).optional() });
const registerCreate = z.object({ name: text(60), code: text(20) });
const registerUpdate = registerCreate.extend({ isActive: z.boolean() }).partial();

export async function organizationRoutes(fastify: FastifyInstance) {
  const service = new OrganizationService(fastify.prisma);
  const admin = { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN"])] };
  const invalid = (issues: z.ZodError) => ({ error: "VALIDATION_ERROR", message: issues.issues[0]?.message, issues: issues.flatten() });

  fastify.get("/api/v1/company", admin, async () => service.getCompany());
  fastify.patch("/api/v1/company", admin, async (request, reply) => {
    const parsed = companySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return service.updateCompany(parsed.data);
  });

  fastify.post("/api/v1/price-lists", admin, async (request, reply) => {
    const parsed = priceListCreate.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return reply.status(201).send(await service.createPriceList(parsed.data));
  });
  fastify.patch("/api/v1/price-lists/:id", admin, async (request, reply) => {
    const parsed = z.object({ name: text(60) }).safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return service.renamePriceList((request.params as { id: string }).id, parsed.data.name);
  });

  fastify.get("/api/v1/organization/branches", admin, async () => service.listBranches());
  fastify.post("/api/v1/organization/branches", admin, async (request, reply) => {
    const parsed = branchCreate.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return reply.status(201).send(await service.createBranch(parsed.data));
  });
  fastify.patch("/api/v1/organization/branches/:id", admin, async (request, reply) => {
    const parsed = branchUpdate.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return service.updateBranch((request.params as { id: string }).id, parsed.data);
  });
  fastify.post("/api/v1/organization/branches/:id/registers", admin, async (request, reply) => {
    const parsed = registerCreate.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return reply.status(201).send(await service.createRegister((request.params as { id: string }).id, parsed.data));
  });
  fastify.patch("/api/v1/organization/registers/:id", admin, async (request, reply) => {
    const parsed = registerUpdate.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send(invalid(parsed.error));
    return service.updateRegister((request.params as { id: string }).id, parsed.data);
  });
}
