import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CashService, CashConflictError } from "./cash.service.js";

const openSessionSchema = z.object({ cashRegisterId: z.string().min(1), initialFund: z.number().finite().nonnegative() });
const closeSessionSchema = z.object({ declaredCash: z.number().finite().nonnegative(), notes: z.string().optional() });
const createMovementSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  concept: z.enum(["WITHDRAW_TO_SAFE", "PETTY_CASH_EXPENSE", "ADVANCE_EMPLOYEE", "BONUS_AGUINALDO", "REFUND_CUSTOMER", "OTHER"]),
  amount: z.number().finite().positive(),
  reason: z.string().min(1),
  employeeId: z.string().optional(),
});

export async function cashRoutes(fastify: FastifyInstance) {
  const service = new CashService(fastify.prisma);
  const ro = [fastify.authenticate];

  function handleError(err: unknown, reply: import("fastify").FastifyReply, request: import("fastify").FastifyRequest) {
    if (err instanceof CashConflictError) return reply.status(err.statusCode).send({ error: "CASH_CONFLICT", message: err.message });
    request.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_ERROR" });
  }

  fastify.post("/api/v1/cash-sessions", { preHandler: ro }, async (request, reply) => {
    const parsed = openSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const session = await service.openSession(parsed.data.cashRegisterId, request.user.sub, parsed.data.initialFund);
      return reply.status(201).send(session);
    } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/cash-sessions/current", { preHandler: ro }, async (request, reply) => {
    const { cashRegisterId } = request.query as { cashRegisterId?: string };
    if (!cashRegisterId) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "cashRegisterId es requerido" });
    return service.getCurrentSession(cashRegisterId, request.user.role === "CASHIER" ? request.user.sub : undefined);
  });

  fastify.post("/api/v1/cash-sessions/:id/close", { preHandler: ro }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = closeSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const session = await service.closeSession(id, parsed.data.declaredCash, parsed.data.notes, request.user.sub);
      return reply.status(200).send(session);
    } catch (err) { return handleError(err, reply, request); }
  });

  fastify.get("/api/v1/cash-sessions/:id/summary", { preHandler: ro }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getSessionSummary(id);
  });

  fastify.post(
    "/api/v1/cash-sessions/:id/movements",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createMovementSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      try {
        const { type, concept, amount, reason, employeeId } = parsed.data;
        const movement = await service.createMovement(id, type, concept, amount, reason, request.user.sub, employeeId);
        return reply.status(201).send(movement);
      } catch (err) { return handleError(err, reply, request); }
    },
  );

  fastify.get("/api/v1/cash-sessions/:id/movements", { preHandler: ro }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getSessionMovements(id);
  });
}
