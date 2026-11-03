import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ReportService } from "./report.service.js";
import { AuditService } from "./audit.service.js";

const dailySalesQuerySchema = z.object({
  branchId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});

const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Fecha inválida');
const reportQuery = z.object({ branchId: z.string().min(1), from: day, to: day,
  docType: z.enum(['BOLETA', 'FACTURA', 'CREDIT_NOTE']).optional(),
  status: z.enum(['ISSUED', 'PENDING_ISSUE', 'REJECTED', 'VOID_INTERNAL']).optional(),
  query: z.string().max(200).optional(),
}).refine(v => v.from <= v.to && +new Date(v.to) - +new Date(v.from) <= 366 * 86400000,
  'El rango debe estar ordenado y abarcar como máximo 366 días');

export async function reportsRoutes(fastify: FastifyInstance) {
  const reportService = new ReportService(fastify.prisma);
  const auditService = new AuditService(fastify.prisma);
  fastify.get('/api/v1/reports/sales', { preHandler: [fastify.authenticate, fastify.authorize(['ADMIN', 'MANAGER'])] }, async (request, reply) => {
    const parsed = reportQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(422).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten() });
    return reportService.getSalesReport(parsed.data.branchId, parsed.data);
  });

  fastify.get(
    "/api/v1/reports/daily-sales",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN", "MANAGER"])] },
    async (request, reply) => {
      const parsed = dailySalesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      }
      if (!day.safeParse(parsed.data.date).success) return reply.status(422).send({ error: "VALIDATION_ERROR", message: "Fecha inválida" });
      return reportService.getDailySalesReport(parsed.data.branchId, parsed.data.date);
    },
  );

  fastify.get(
    "/api/v1/audit-logs",
    { preHandler: [fastify.authenticate, fastify.authorize(["ADMIN"])] },
    async (request, reply) => {
      const parsed = auditQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(422).send({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
      }
      return auditService.getAuditLogs(parsed.data.entityType, parsed.data.entityId, parsed.data);
    },
  );
}
