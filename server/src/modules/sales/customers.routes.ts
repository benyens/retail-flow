import type { FastifyInstance } from "fastify";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1),
  rut: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
const customerPatchSchema = customerSchema.partial();

export async function customersRoutes(fastify: FastifyInstance) {
  const ro = [fastify.authenticate];

  fastify.get("/api/v1/customers", { preHandler: ro }, async () => {
    return fastify.prisma.customer.findMany({ orderBy: { name: "asc" } });
  });

  fastify.get("/api/v1/customers/search", { preHandler: ro }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "q es requerido" });
    return fastify.prisma.customer.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { rut: { contains: q } }] },
      take: 20,
    });
  });

  fastify.post("/api/v1/customers", { preHandler: ro }, async (request, reply) => {
    const parsed = customerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    const customer = await fastify.prisma.customer.create({ data: parsed.data });
    return reply.status(201).send(customer);
  });

  fastify.patch("/api/v1/customers/:id", { preHandler: ro }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = customerPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    const customer = await fastify.prisma.customer.update({ where: { id }, data: parsed.data });
    return reply.status(200).send(customer);
  });
}
