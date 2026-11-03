# retail-flow

ERP/POS para comercio minorista chileno: React + Vite + TypeScript en `src/`, Fastify + Prisma + PostgreSQL en `server/`.

El contrato de API está en `src/api/client.ts`; las reglas del proyecto están en `AGENTS.md`. Consulta `server/README.md` para detalles del backend y pendientes funcionales.

## Desarrollo local

Requisitos: Node.js 20.19+ (rama 20) o 22.12+, npm y Docker Desktop iniciado.

Desde la raíz:

```powershell
npm ci
docker compose up -d db
Copy-Item server/.env.example server/.env
cd server
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

La copia de `.env` solo es necesaria la primera vez. El servidor carga ese archivo al iniciar. PostgreSQL queda en localhost:5432, con almacenamiento persistente en el volumen de Compose.

En otra terminal, desde la raíz, crea `.env.local`:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:3000
```

Luego ejecuta `npm run dev` y abre http://localhost:8080. Backend: http://localhost:3000/health.

Usuario local de ejemplo: `admin@retailflow.local` / `admin1234`.

Para usar datos en memoria, configura `VITE_USE_MOCK=true`. `docker compose up frontend` conserva el frontend en modo mock en el puerto 5173.

## Verificación

Desde la raíz:

```powershell
npx tsc -p tsconfig.app.json --noEmit
npm run build
cd server
npx tsc --noEmit
npm run test:smoke
npm run test:security
```

La prueba de integración requiere PostgreSQL migrado y seed aplicado. Usa las rutas Fastify contra la base real y comprueba login, producto, compra con IVA, venta, devolución, stock y arqueo. Crea registros identificados con `SMOKE-` y los conserva para inspección; úsala en una base de desarrollo. No sustituye pruebas de navegador ni de concurrencia.

## Estado verificado — 14 de septiembre de 2026

- Cliente Prisma generado y migración inicial aplicada en PostgreSQL 16.
- Seed y prueba de integración completados.
- TypeScript del frontend/backend y build del frontend correctos.
- Vite advierte que el bundle principal supera 500 kB; la compilación finaliza.

Próximos trabajos funcionales documentados: ampliar empleados, renovación de sesión y ampliar auditoría. La emisión DTE continúa como `INTERNAL_STUB`, sin conexión real al SII.

## Facturas, reportes y teclado

- **Facturas** (`/admin/facturas`): buscar por número, proveedor o RUT; filtrar proveedor, fechas y estado; ordenar, paginar, exportar CSV y consultar detalle. El botón **Ingresar factura** abre el formulario existente. La edición de cabecera no vuelve a aplicar stock.
- **Reportes**: períodos de hasta 366 días, folio/cliente/RUT, tipo y estado del documento, detalle y CSV. Totales por fecha de Chile, notas de crédito descontadas y documentos anulados excluidos de los importes.
- **Auditoría**: exclusiva de administradores, filtros por acción, usuario, entidad y fechas, páginas de 100 eventos y comparación de datos anteriores/posteriores.

Atajos globales: `Alt+P` venta, `Alt+F` facturas, `Alt+N` ingresar factura, `Alt+R` precios y `Ctrl+/` ayuda. `F1` enfoca la búsqueda. En ingreso de facturas: `F4` guarda, `F6` proveedores, `F7` producto rápido. En precios, `Enter` guarda la fila. Los atajos de navegación respetan los diálogos abiertos y la confirmación de cambios pendientes en enlaces/atajos. Esto amplía el manejo por teclado; aún no certifica todos los flujos del POS sin ratón.

`test:security` comprueba autorización vertical y por sucursal, cambios de rol/estado con JWT existente, precios y totales manipulados, devolución concurrente, auditoría, CORS y límite de login. Conserva registros SECURITY y desactiva sus usuarios de prueba. Ejecutar solo sobre desarrollo. Ver [revisión de seguridad](SECURITY_REVIEW.md) para cobertura y pendientes.

## Sesiones — 5 de octubre de 2026

Cerrar sesión revoca el token en PostgreSQL; no basta con copiarlo para reutilizarlo después. Logins simultáneos son independientes. Antes de arrancar una instalación existente, ejecutar `npx prisma migrate deploy` desde `server`. Verificación adicional: `npm run test:sessions` (requiere seed de desarrollo). Migración y prueba verificadas localmente, incluidos rechazo del token revocado y persistencia entre instancias. JWT conserva duración de 12 horas, sin renovación automática.
