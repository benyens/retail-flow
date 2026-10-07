# Revisión de seguridad — 2026-09-14

Revisión del código y pruebas del entorno local PostgreSQL 16. No constituye una certificación ni una prueba de penetración completa.

## Cambios aplicados

- El backend verifica firma HS256 y consulta usuario activo, rol y sucursales actuales en cada petición. Una degradación de rol o desactivación surte efecto aunque exista un JWT anterior.
- Se verifica sucursal de recursos accedidos por ID, además de filtros del cliente. Un cajero opera su propia sesión de caja. La interfaz oculta acciones administrativas y el servidor las rechaza independientemente de ella.
- Precios y subtotales de venta se contrastan con catálogo y escalones por grupo. El cajero no puede forzar precio manual. Se rechazan variantes repetidas y valores numéricos no finitos.
- Devoluciones concurrentes bloquean la venta original, descuentan cantidades ya devueltas y evitan devolver dos veces. Anular después de una devolución se rechaza. Ventas, cierre y movimientos bloquean la sesión; stock mantiene operaciones atómicas y movimientos con cantidades anteriores/posteriores reales.
- Login limitado a 10 intentos/minuto por IP. CORS usa una lista explícita de orígenes y permite los métodos requeridos por el cliente. Producción rechaza secretos JWT débiles/de ejemplo.
- Auditoría transaccional ampliada a compras, precios individuales, stock, ventas, devoluciones, caja y cambios de acceso. Consulta y exportación exclusivas de ADMIN. Cache de consultas vaciada al cambiar de usuario.
- Dependencias actualizadas (Fastify 5, React Router 7, Vite 7). SheetJS procede del paquete oficial 0.20.3, según su [documentación de instalación](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Los lockfiles fijan la resolución verificada.
- Exportaciones CSV neutralizan fórmulas y escapan celdas. Importación de precios/mayoristas limita tamaño de archivo. Credenciales mock se muestran solamente en desarrollo con modo mock explícito.

## Alcance de permisos

| Operación | CAJERO | MANAGER | ADMIN |
| --- | --- | --- | --- |
| Venta y caja propia en sucursal asignada | Sí | Sí | Sí |
| Compras, precios, reportes, ajustes | No | Sí | Sí |
| Anulación y notas de crédito | No | Sí | Sí |
| Usuarios y auditoría | No | No | Sí |

Los recursos de sucursal respetan las asignaciones también para ADMIN. Catálogo, proveedores y precios siguen siendo globales a la empresa; este diseño no representa aislamiento entre empresas.

## Evidencia

- TypeScript frontend/backend y compilaciones.
- `npm run test:smoke`: compra, IVA, venta, devolución, stock y arqueo sobre PostgreSQL.
- `npm run test:security`: 42 comprobaciones más limitación de login, totales, auditoría y devolución simultánea (una petición aceptada y otra rechazada).
- Navegador: navegación mediante atajos, búsqueda de facturas por RUT, detalle, ingreso mediante F4, bloqueo de atajos dentro de diálogos, precio guardado con Enter, reporte mensual y detalle de productos/pagos, auditoría del precio con valores antes/después.
- Las pruebas conservan datos SMOKE/SECURITY; los usuarios SECURITY quedan inactivos. No ejecutar sobre producción.

## Límites y próximos trabajos

1. JWT permanece en localStorage; el token expira a las 12 horas. Desde 2026-10-05, logout revoca su hash SHA-256 en PostgreSQL y cada petición comprueba esa revocación, incluso entre instancias. Cada login tiene un identificador aleatorio independiente. Falta renovación y administración de todas las sesiones de un usuario. Cambios de rol, sucursal y desactivación sí se aplican en la siguiente petición.
2. Auditoría no registra todavía todas las mutaciones de catálogo, proveedores, empleados o precios masivos. No hay retención inmutable ni protección frente a administradores directos de PostgreSQL.
3. El limitador vive en memoria por proceso. Despliegues múltiples requieren almacenamiento compartido y configuración explícita del proxy. Configurar HTTPS, secretos únicos, CORS y cuentas reales antes de producción; el seed es para desarrollo.
4. Facturas se cargan por sucursal y los reportes por período; la paginación visual no reduce ese volumen. Falta paginación del servidor y medición de índices con datos reales a escala.
5. El formulario evita doble guardado simultáneo en el cliente, pero la creación de compras no tiene todavía clave de idempotencia ni restricción comercial de factura duplicada por proveedor.
6. La protección de borradores cubre enlaces, atajos y salida de página; falta cubrir el botón Atrás interno del navegador y verificar exhaustivamente accesibilidad y todos los flujos solo con teclado.
7. DTE continúa simulado con INTERNAL_STUB. No se conecta al SII.
8. Vite advierte del tamaño del bundle principal; queda pendiente dividirlo por rutas.

## Migración de sesiones — 2026-10-05

Aplicar `npx prisma migrate deploy` desde server antes de arrancar esta versión. La tabla revoked_tokens guarda hashes y vencimientos, nunca tokens reutilizables. Los registros expirados se limpian al cerrar sesión. Una petición ya autorizada antes de logout puede terminar; logout bloquea nuevas autenticaciones. Verificar con `npm run test:sessions` sobre desarrollo con seed.
