# retail-flow — backend (contrato ApiClient completo)

Backend real para el frontend `retail-flow` (generado con Lovable), que hoy
corre 100% contra `MockApiClient` (datos en memoria). Este backend implementa
**el 100% de la interfaz `ApiClient`** definida en `src/api/client.ts` -- solo
falta cambiar `VITE_USE_MOCK=false` y todo sigue funcionando sin tocar las
páginas.

Stack: Node.js + TypeScript + Fastify + Prisma + PostgreSQL.

## Setup

1. **Base de datos**:
   ```bash
   docker run --name retail-flow-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=retail_flow -p 5432:5432 -d postgres:16
   ```
2. **Variables de entorno**: `cd server && cp .env.example .env`
3. **Instalar y migrar**:
   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   npm run prisma:seed
   ```
   El seed crea: Company + Branch (`MATRIZ`), CashRegister (`CAJA-1`),
   PriceLists (`NORMAL`, `MAYORISTA`), ProductCategory (`General`), un
   Supplier de ejemplo, y `admin@retailflow.local` / `admin1234` (ADMIN).
4. **Levantar**: `npm run dev` (puerto 3000)
5. **Conectar el frontend**: en la raíz del repo, `.env.local`:
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=http://localhost:3000
   ```

## Qué está implementado (contrato completo)

Auth, Branches/Cash Registers, Cash Sessions completo (abrir/cerrar/resumen/
movimientos), Catálogo completo (products, variant groups, variants,
`createQuickProduct`, categorías, precios, escalones mayoristas), Stock
completo, Customers, Sales/POS (`createSale`, `getSales`, `getSaleDetail`,
`voidSaleInternal`, **`createCreditNote`**, **`retryDTE`**), Compras completo,
Empleados, Usuarios, **Reportes** (`getDailySalesReport`), y **Auditoría**
(`getAuditLogs`).

### Notas sobre las últimas piezas agregadas

- **`createCreditNote`**: emite un `SalesDocument` nuevo tipo `CREDIT_NOTE`
  que referencia al original vía `SalesDocumentReference`. Valida que la
  cantidad acreditada no exceda lo vendido por variante. Restaura stock
  (increment atómico). Si `refundMethod === CASH` y la sesión de caja
  **original sigue abierta**, descuenta `expectedCash`; si ya se cerró, no
  se toca retroactivamente (no se puede reabrir un arqueo ya hecho).
- **`retryDTE`**: como nunca hay un envío real al SII, un `DTERequest` solo
  llega a `REJECTED` si alguien lo fuerza manualmente (ej. Prisma Studio,
  para probar el flujo). Reintentar simplemente lo vuelve a marcar `ACCEPTED`.
- **`getAuditLogs`**: consulta de administradores con filtros y paginación. Registra ventas, anulaciones, notas de crédito, compras, precios individuales, ajustes, caja y cambios de acceso. No cubre automáticamente toda mutación. Ver `../SECURITY_REVIEW.md`.

## Pasada de hardening (concurrencia)

Se revisó el código escrito buscando específicamente problemas de
concurrencia (no solo errores de tipos), porque nunca corrió contra una DB
real durante su escritura. 5 problemas reales corregidos:

1. **`createSale`**: el patrón era leer-comparar-escribir, con ventana de
   carrera real (dos cajeros vendiendo la última unidad al mismo tiempo).
   Ahora es un `updateMany` con `WHERE quantity >= cantidad` -- atómico y
   condicional en una sola sentencia SQL.
2. **`createPurchase`**: mismo tipo de problema al revés (podía perder
   unidades). Fix: `increment` atómico de Prisma en vez de leer-sumar-escribir.
3. **`createAdjustment`** (stock) -- mismo fix.
4. **`voidSaleInternal`** y **`createCreditNote`** (restaurar stock) --
   mismo fix.
5. **`openCashSession`**: podía abrir dos sesiones para la misma caja
   registradora en simultáneo. Se envolvió en una transacción `Serializable`
   -- Postgres rechaza una de las dos con error `40001`, traducido al mismo
   `CashConflictError` de siempre.

Además: `deleteVariant` ya no es un hard delete sin protección (chequea
ventas históricas asociadas), y se corrigió que `AppContext.tsx` no
rehidrataba la sesión al recargar la página (el JWT ahora incluye
`name`/`rut` para poder reconstruir el `User` decodificando el token en el
cliente -- sin verificar su firma, eso lo sigue haciendo el backend en cada
request).

### Revisado y dejado como está (a propósito)

- Cierre, movimientos y ventas bloquean la fila de sesión en una transacción, evitando que un cierre compita con una venta. Apertura conserva aislamiento `Serializable`.
- `createAdjustment` puede crear un `Stock` con cantidad negativa si es el
  primer ajuste registrado y la cantidad es negativa. Edge case pre-existente.

## Decisiones de diseño

- **`WholesaleTier` es por `variantGroupId`**, no por variante individual.
  `createQuickProduct` le da a cada producto nuevo su propio `VariantGroup`.
- **IVA asimétrico**: ventas asumen precio con IVA incluido (19%); compras
  asumen costo neto y suman IVA encima -- así llegan las facturas reales.
- **DTE es un stub**: acepta al instante, `providerName: "INTERNAL_STUB"`.
  No hay conexión real al SII.
- **`createPurchase` aplica stock de inmediato** (no hay endpoint de
  "recepción" separado en este contrato de API).
- **`deleteProduct`/`deleteVariant`** son hard deletes condicionales: fallan
  con 409 si hay variantes o ventas asociadas, sugiriendo desactivar.

## Qué falta

- CRUD de `Employee` con más campos (sueldo, fecha de ingreso, etc. -- hoy
  solo nombre/RUT/cargo/estado, lo mínimo que pedía el tipo `Employee`).
- Refresh tokens (el JWT expira a las 12h sin renovación).
- Emisión real de DTE contra el SII (proveedor real, firma electrónica).
- Auditoría automática de más acciones (ver nota arriba).

## Verificación de tipos

Actualización 2026-09-13: ya se generó el cliente Prisma y se aplicó la
migración inicial en PostgreSQL 16 local. El seed y `npm run test:smoke`
pasaron contra esa base. La prueba cubre login, catálogo, compra, venta,
nota de crédito, stock y cierre de caja; conserva datos SMOKE para inspección.
No cubre navegador ni concurrencia. Los comandos de desarrollo, arranque y
seed ahora cargan `.env` explícitamente (Node >=20.19).

Contexto histórico de la implementación original:

Este backend se escribió y verificó con `tsc --noEmit --strict` en un
entorno sin salida de red hacia los binarios de Prisma, así que nunca
corrió contra una base de datos real durante su escritura. El primer
`npx prisma generate` / `migrate dev` que corras es la primera validación
real contra un motor de verdad.

## Actualización 2026-09-14

Fastify 5; autenticación valida usuario activo, rol y sucursales actuales en base de datos. Los recursos se autorizan por su sucursal, y el cajero opera su propia sesión. Compras y administración requieren ADMIN/MANAGER; usuarios y auditoría, ADMIN. El servidor recalcula precios y valida subtotales; las devoluciones concurrentes bloquean el documento original y comprueban cantidades ya devueltas.

`npm run test:security` incorpora pruebas contra PostgreSQL de permisos, CORS, limitación de login, totales, auditoría y devolución concurrente. Crea datos SECURITY persistentes con usuarios desactivados al finalizar. `npm run test:smoke` sigue disponible.

Configurar `CORS_ORIGINS` con orígenes separados por comas y un `JWT_SECRET` fuerte para producción. El limitador de login es de 10 intentos/minuto por IP en memoria. Los riesgos y límites restantes se describen en `../SECURITY_REVIEW.md`.

## Revocación de sesiones — 2026-10-05

Logout autenticado persiste el hash del token en `revoked_tokens`; authenticate lo consulta en cada petición. Aplicar la migración `20261005120000_token_revocation` antes del arranque. Cada login incorpora un jti aleatorio. `npm run test:sessions` valida rechazo posterior a logout, sesiones independientes y persistencia entre instancias; verificado sobre PostgreSQL local.
