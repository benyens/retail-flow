import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuditService } from "../modules/reports/audit.service.js";

/**
 * Auditoría de mantenedores (catálogo, mayoristas, categorías, proveedores, empleados,
 * clientes). Ventas, caja, stock, compras, precios y usuarios ya se auditan dentro de
 * sus servicios, en la misma transacción; aquí se cubre el resto sin tocar cada servicio.
 *
 * - Antes del handler se guarda el estado previo (PATCH/DELETE).
 * - Al responder con éxito se registra la acción con el estado posterior.
 * Un fallo al auditar se registra en el log y no rompe la operación ya hecha.
 */
type Model = "company" | "branch" | "cashRegister" | "product" | "variantGroup" | "variant" | "wholesaleTier" | "productCategory" | "supplier" | "employee" | "customer";
type Rule = { action: string; entityType: string; model: Model };

const RULES: Record<string, Rule> = {
  "PATCH /api/v1/company": { action: "UPDATE_COMPANY", entityType: "Company", model: "company" },
  "POST /api/v1/organization/branches": { action: "CREATE_BRANCH", entityType: "Branch", model: "branch" },
  "PATCH /api/v1/organization/branches/:id": { action: "UPDATE_BRANCH", entityType: "Branch", model: "branch" },
  "POST /api/v1/organization/branches/:id/registers": { action: "CREATE_CASH_REGISTER", entityType: "CashRegister", model: "cashRegister" },
  "PATCH /api/v1/organization/registers/:id": { action: "UPDATE_CASH_REGISTER", entityType: "CashRegister", model: "cashRegister" },
  "POST /api/v1/products": { action: "CREATE_PRODUCT", entityType: "Product", model: "product" },
  "POST /api/v1/products/quick": { action: "CREATE_QUICK_PRODUCT", entityType: "Variant", model: "variant" },
  "PATCH /api/v1/products/:id": { action: "UPDATE_PRODUCT", entityType: "Product", model: "product" },
  "DELETE /api/v1/products/:id": { action: "DELETE_PRODUCT", entityType: "Product", model: "product" },
  "POST /api/v1/variant-groups": { action: "CREATE_VARIANT_GROUP", entityType: "VariantGroup", model: "variantGroup" },
  "PATCH /api/v1/variant-groups/:id": { action: "UPDATE_VARIANT_GROUP", entityType: "VariantGroup", model: "variantGroup" },
  "DELETE /api/v1/variant-groups/:id": { action: "DELETE_VARIANT_GROUP", entityType: "VariantGroup", model: "variantGroup" },
  "POST /api/v1/variants": { action: "CREATE_VARIANT", entityType: "Variant", model: "variant" },
  "PATCH /api/v1/variants/:id": { action: "UPDATE_VARIANT", entityType: "Variant", model: "variant" },
  "DELETE /api/v1/variants/:id": { action: "DELETE_VARIANT", entityType: "Variant", model: "variant" },
  "POST /api/v1/wholesale-tiers": { action: "CREATE_WHOLESALE_TIER", entityType: "WholesaleTier", model: "wholesaleTier" },
  "PATCH /api/v1/wholesale-tiers/:id": { action: "UPDATE_WHOLESALE_TIER", entityType: "WholesaleTier", model: "wholesaleTier" },
  "DELETE /api/v1/wholesale-tiers/:id": { action: "DELETE_WHOLESALE_TIER", entityType: "WholesaleTier", model: "wholesaleTier" },
  "POST /api/v1/product-categories": { action: "CREATE_CATEGORY", entityType: "ProductCategory", model: "productCategory" },
  "PATCH /api/v1/product-categories/:id": { action: "UPDATE_CATEGORY", entityType: "ProductCategory", model: "productCategory" },
  "DELETE /api/v1/product-categories/:id": { action: "DELETE_CATEGORY", entityType: "ProductCategory", model: "productCategory" },
  "POST /api/v1/suppliers": { action: "CREATE_SUPPLIER", entityType: "Supplier", model: "supplier" },
  "PATCH /api/v1/suppliers/:id": { action: "UPDATE_SUPPLIER", entityType: "Supplier", model: "supplier" },
  "POST /api/v1/employees": { action: "CREATE_EMPLOYEE", entityType: "Employee", model: "employee" },
  "PATCH /api/v1/employees/:id": { action: "UPDATE_EMPLOYEE", entityType: "Employee", model: "employee" },
  "POST /api/v1/customers": { action: "CREATE_CUSTOMER", entityType: "Customer", model: "customer" },
  "PATCH /api/v1/customers/:id": { action: "UPDATE_CUSTOMER", entityType: "Customer", model: "customer" },
};

declare module "fastify" {
  interface FastifyRequest {
    auditBefore?: unknown;
  }
}

/** Convierte Decimal/Date a JSON plano para guardarlo en la auditoría. */
function plain(value: unknown): unknown {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export default fp(async (fastify: FastifyInstance) => {
  const ruleFor = (req: FastifyRequest) => RULES[`${req.method} ${req.routeOptions.url ?? ""}`];

  const findById = (model: Model, id: string): Promise<unknown> =>
    // Todos los modelos auditados usan `id` como clave primaria.
    (fastify.prisma[model] as unknown as { findUnique(a: { where: { id: string } }): Promise<unknown> })
      .findUnique({ where: { id } });

  // Se agrega al final de los preHandler de cada ruta auditada: corre después de la
  // autenticación y los permisos, así una petición rechazada no consulta nada.
  fastify.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (!methods.some((m) => RULES[`${m} ${route.url}`])) return;
    const capture = async (req: FastifyRequest) => {
      const rule = ruleFor(req);
      const id = (req.params as { id?: string } | undefined)?.id;
      if (rule && id && req.method !== "POST") req.auditBefore = plain(await findById(rule.model, id));
    };
    const existing = route.preHandler ? (Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler]) : [];
    route.preHandler = [...existing, capture];
  });

  fastify.addHook("onSend", async (req, reply, payload) => {
    const rule = ruleFor(req);
    if (!rule || reply.statusCode >= 400 || !req.user?.sub) return payload;
    let after: unknown;
    if (typeof payload === "string" && payload) {
      try { after = JSON.parse(payload); } catch { after = undefined; }
    }
    // En un POST el registro creado es la respuesta (el :id de la URL puede ser el padre).
    const createdId = (after as { id?: string } | undefined)?.id;
    const paramId = (req.params as { id?: string } | undefined)?.id;
    const id = req.method === "POST" ? createdId ?? paramId : paramId ?? createdId;
    if (!id) return payload;
    await AuditService.log(fastify.prisma, {
      userId: req.user.sub, action: rule.action, entityType: rule.entityType, entityId: id,
      beforeData: req.auditBefore ?? undefined,
      afterData: req.method === "DELETE" ? undefined : after,
    }).catch((err) => req.log.error({ err }, "No se pudo registrar la auditoría"));
    return payload;
  });
});
