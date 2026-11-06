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

- `auth/` — login/logout/change-password, JWT (12h, sin refresh). Login: límite 10/min por IP y 5/min por cuenta, correo sin distinguir mayúsculas, tiempo constante exista o no la cuenta. `users.tokensValidAfter` invalida los JWT emitidos antes de un cambio o reset de contraseña (lo revisa `plugins/auth.ts`).
- `lookups/` — branches, cash registers, product categories (listas simples).
- `catalog/` — products, variant groups, variants, `createQuickProduct`, precios, escalones mayoristas.
- `stock/` — inventario, movimientos, ajustes.
- `cash/` — sesiones de caja, cierre con arqueo, movimientos.
- `sales/` — checkout del POS, anulación, notas de crédito, DTE stub.
- `purchases/` — proveedores, facturas de compra (aplica stock al crear, no hay paso de "recepción" separado).
- `employees/` — CRUD básico.
- `users/` — CRUD y reset de contraseña (`POST /users/:id/password`), solo ADMIN. Un ADMIN no puede quitarse el rol ni desactivarse, y siempre queda al menos un ADMIN activo (409).
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

## Interfaz en celular

- `MainLayout`: en `md` y más el `Sidebar` va fijo; en celular hay una barra superior con ☰ que abre el mismo `Sidebar` dentro de un `Sheet`. No vuelvas a poner un ancho fijo visible siempre.
- `POSPage`: en celular muestra un panel a la vez (`mobilePanel`: productos/carrito) con barra inferior; en escritorio ambos lado a lado. Totales y **Pagar** quedan fijos al fondo del carrito.
- Las páginas secundarias se cargan con `React.lazy` (ver `App.tsx`); `main.tsx` recarga una vez si tras un deploy falta un fragmento.
- Diálogos (`components/ui/dialog.tsx`) limitan alto y ancho al viewport y hacen scroll interno.
- Verificación visual: `/home/claude/qa/shots.py` (no versionado) o cualquier Playwright con `devices['iPhone 13']` y 1366×800.

## Qué NO hacer

- No cambies el nombre de un campo en `src/types/index.ts` sin propagar el cambio al schema de Prisma, los DTOs de los servicios, y `httpApiClient.ts`. Los tres tienen que decir lo mismo.
- No agregues autenticación/autorización distinta a los dos niveles que ya existen: `fastify.authenticate` (cualquier rol logueado) y `fastify.authorize(['ADMIN', ...])` (roles específicos). No inventes un tercer mecanismo.
- No toques `AppContext.tsx` para "simplificar" el manejo del token: la sesión se lee de localStorage **antes del primer render** (`readStoredAuth` como inicializador de `useState`). Si se mueve a un `useEffect`, al recargar cualquier ruta protegida la app redirige a /login y pierde la página. El evento `auth:expired` (lo emite `httpApiClient` ante un 401 con sesión) limpia la sesión y muestra un aviso.
- No conectes un proveedor real de DTE/SII sin que te lo pidan explícitamente — hoy es un stub a propósito y punto de extensión documentado, no una tarea pendiente implícita.

## Deploy (demo)

- `server/scripts/start-cloud.mjs` valida env, normaliza `DATABASE_URL` de Neon, reintenta `migrate deploy` y opcionalmente corre el seed (`SEED_ON_START=true`). No lo simplifiques: cada paso cubre una falla real de Neon/Render.
- `CORS_ORIGINS` es obligatorio en producción (la app no arranca sin él). `trustProxy` confía solo en `TRUST_PROXY_HOPS` proxies (por defecto 1, Render); no lo cambies a `true`, porque permitiría falsear la IP con `X-Forwarded-For` y saltarse el límite de login.
- Contraseñas: mínimo 10 caracteres (`passwordSchema` en `auth.routes.ts`), bcrypt costo 12. El frontend usa el mismo mínimo.
- El frontend usa `VITE_API_BASE_URL` (sin `/api/v1`); en build de producción sin ella falla con mensaje explícito, nunca cae a localhost.
- Credenciales `admin@pos.cl`/`admin123` son solo del modo mock.
