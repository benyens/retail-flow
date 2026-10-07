# AGENTS.md

Contexto para agentes de código (Codex, Claude Code, Cursor, etc.) trabajando en este repo. Leer esto antes de tocar nada.

## Qué es esto

`retail-flow`: un ERP/POS para comercio minorista chileno. Dos partes:

- **`/` (raíz)** — Frontend: React + Vite + TypeScript + shadcn/ui + TanStack Query. Generado originalmente con Lovable.
- **`/server`** — Backend: Node.js + Fastify + Prisma + PostgreSQL. Construido desde cero para implementar exactamente el contrato que el frontend ya esperaba.

## La regla que nunca se rompe

**`src/api/client.ts` es el contrato. Todo lo demás se adapta a él, nunca al revés.**

El frontend fue diseñado primero contra `MockApiClient` (datos en memoria, `src/api/mockApiClient.ts`). El backend (`server/`) implementa la interfaz `ApiClient` de `src/api/client.ts` exactamente — mismos nombres de método, mismas firmas, mismos shapes de retorno (definidos en `src/types/index.ts`). `src/api/httpApiClient.ts` es la implementación HTTP de esa interfaz.

Si necesitas agregar o cambiar un endpoint:
1. Cambia primero la interfaz en `src/api/client.ts` y los tipos en `src/types/index.ts`.
2. Implementa el método correspondiente en `server/src/modules/.../*.routes.ts` + `*.service.ts`.
3. Implementa el método en `src/api/httpApiClient.ts` llamando a ese endpoint.
4. Si quieres que `MockApiClient` siga funcionando en paralelo, actualízalo también (no es obligatorio, pero evita romper el modo mock).

Nunca agregues un método a `HttpApiClient` que no esté en `ApiClient`. Nunca lo dejes fuera si está en `ApiClient` — usa `notImplemented("nombreDelMetodo")` (ver el patrón ya usado ahí) si de verdad no está implementado todavía, nunca lo omitas silenciosamente.

## Cómo correr esto

```bash
# Backend
cd server
cp .env.example .env          # editar DATABASE_URL si hace falta
npm install
npm run prisma:generate
npm run prisma:migrate -- --name <algo>
npm run prisma:seed
npm run dev                    # puerto 3000

# Frontend (otra terminal, desde la raíz)
npm install
# .env.local con VITE_USE_MOCK=false y VITE_API_BASE_URL=http://localhost:3000
npm run dev                    # puerto 8080
```

Usuario de seed: `admin@retailflow.local` / `admin1234`.

Para volver al modo mock (sin backend): `VITE_USE_MOCK=true` o borrar `.env.local`.

## Estructura del backend (`server/src/modules/`)

Cada módulo sigue el mismo patrón: `X.service.ts` (lógica de negocio + Prisma) + `X.routes.ts` (Fastify + Zod + wiring de permisos). Los servicios nunca importan Fastify; las rutas nunca hacen queries directas a Prisma.

- `auth/` — login/logout, JWT (12h, sin refresh todavía).
- `lookups/` — branches, cash registers, product categories (listas simples).
- `catalog/` — products, variant groups, variants, `createQuickProduct`, precios, escalones mayoristas.
- `stock/` — inventario, movimientos, ajustes.
- `cash/` — sesiones de caja, cierre con arqueo, movimientos.
- `sales/` — checkout del POS, anulación, notas de crédito, DTE stub.
- `purchases/` — proveedores, facturas de compra (aplica stock al crear, no hay paso de "recepción" separado).
- `employees/` — CRUD básico.
- `users/` — CRUD, solo ADMIN.
- `reports/` — reporte de ventas diario + `AuditService` (log de acciones sensibles) + auditoría.

`prisma/schema.prisma` es la fuente de verdad del modelo de datos. Cada modelo está mapeado 1:1 contra los tipos de `src/types/index.ts` (mismos nombres de campo) — si un DTO no calza exacto con el tipo del frontend, es un bug.

## Cosas específicas de este dominio que hay que respetar

- **`WholesaleTier` (escalón mayorista) es por `variantGroupId`, no por variante individual.** Comprar 6+ unidades combinando distintas variantes del mismo grupo activa el precio mayorista. No lo cambies a "por SKU" sin entender esto.
- **IVA asimétrico a propósito**: en ventas, `unitPrice` ya incluye IVA (19%, se calcula el neto hacia atrás). En compras, `unitCost` es neto y el IVA se suma encima. Es como llegan las boletas/facturas reales en Chile — no es un bug.
- **DTE (documentos tributarios) es un stub**: `providerName: "INTERNAL_STUB"`, se acepta al instante, sin conexión real al SII. No asumas que hay integración real.
- **`createPurchase` aplica stock inmediatamente** al crear la factura — no hay un paso de "recepción" separado en el contrato actual de `ApiClient`.
- **Nunca hagas `delete` directo sobre `Product` o `Variant`** sin pasar por el servicio — `deleteProduct`/`deleteVariant` chequean si hay variantes/ventas asociadas y rechazan con 409 sugiriendo desactivar (`isActive: false`) en su lugar.

## Concurrencia — no reintroduzcas estos bugs

Ya se encontraron y corrigieron 5 race conditions reales (documentadas en `server/README.md`, sección "Pasada de hardening"). Si tocas código de stock o caja:

- **Nunca hagas `findUnique` → calcular → `update`** para modificar `Stock.quantity` o `CashSession.expectedCash`. Usa siempre los operadores atómicos de Prisma: `{ increment: N }` / `{ decrement: N }`.
- Para descuentos que deben poder **fallar si no alcanza** (ej. vender más stock del disponible), usa `updateMany` con la condición en el `WHERE` (`quantity: { gte: N }`) y revisa `result.count === 0` — no valides con una lectura previa separada.
- `openCashSession` usa una transacción `Serializable` a propósito (evita abrir dos sesiones de caja simultáneas para la misma caja registradora). No la bajes a un nivel de aislamiento menor sin entender por qué está ahí.

## Verificación

Además de tipos, existe una prueba de integración: desde `server`,
`npm run test:smoke` sobre una base de desarrollo migrada y con seed.
Crea registros SMOKE y los conserva. Fue ejecutada en PostgreSQL 16 el
2026-09-13; no cubre navegador ni concurrencia.

```bash
cd server && npx tsc --noEmit    # backend
npx tsc -p tsconfig.app.json --noEmit   # frontend, desde la raíz
```

Corre ambos después de cualquier cambio. La generación Prisma, migración inicial y seed ya se verificaron contra PostgreSQL 16 local el 2026-09-13. Reporta cualquier fallo de migración o runtime aunque TypeScript pase.

## Qué NO hacer

- No cambies el nombre de un campo en `src/types/index.ts` sin propagar el cambio al schema de Prisma, los DTOs de los servicios, y `httpApiClient.ts`. Los tres tienen que decir lo mismo.
- No agregues autenticación/autorización distinta a los dos niveles que ya existen: `fastify.authenticate` (cualquier rol logueado) y `fastify.authorize(['ADMIN', ...])` (roles específicos). No inventes un tercer mecanismo.
- No toques `AppContext.tsx` para "simplificar" el manejo del token — ya tiene un fix específico (rehidratación desde JWT decodificado al montar) que soluciona un bug real; no lo reviertas sin leer el comentario que lo explica ahí mismo.
- No conectes un proveedor real de DTE/SII sin que te lo pidan explícitamente — hoy es un stub a propósito y punto de extensión documentado, no una tarea pendiente implícita.
