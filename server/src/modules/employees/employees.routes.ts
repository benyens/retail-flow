import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EmployeeService } from "./employee.service.js";

const employeeSchema = z.object({
  branchId: z.string().min(1), name: z.string().min(1), rut: z.string().min(1),
  position: z.string().min(1), isActive: z.boolean().default(true),
});
const employeePatchSchema = employeeSchema.partial();

export async function employeesRoutes(fastify: FastifyInstance) {
  const service = new EmployeeService(fastify.prisma);
  const ro = [fastify.authenticate];
  const rw = [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])];

  fastify.get("/api/v1/employees", { preHandler: ro }, async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "branchId es requerido" });
    return service.listEmployees(branchId);
  });
  fastify.post("/api/v1/employees", { preHandler: rw }, async (request, reply) => {
    const parsed = employeeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(201).send(await service.createEmployee(parsed.data));
  });
  fastify.patch("/api/v1/employees/:id", { preHandler: rw }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = employeePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    return reply.status(200).send(await service.updateEmployee(id, parsed.data));
  });
  fastify.get("/api/v1/employees/:id/advances", { preHandler: rw }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getEmployeeAdvances(id);
  });
}
