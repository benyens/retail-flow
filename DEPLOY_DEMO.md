# Demo personal: Vercel + Render + Neon

## 1. GitHub
Crea un repositorio privado vacío y sube este proyecto. No subir node_modules, dist ni archivos .env. El .gitignore ya excluye esas rutas. Nunca pegues contraseñas o conexiones PostgreSQL en el chat ni en el repositorio.

## 2. Neon
Crea una base nueva exclusiva para la demo. En Connect, copia la URL PostgreSQL directa (sin pooling), conservando sslmode=require. Pégala solo como DATABASE_URL en Render. No reemplaces la conexión local.

## 3. Vercel
Importa el repositorio, raíz del proyecto, preset Vite y Node 22.x. vercel.json configura compilación y rutas React. Añade VITE_USE_MOCK=false. Cuando exista el backend, añade VITE_API_BASE_URL=https://NOMBRE.onrender.com (sin /api/v1) y vuelve a desplegar. Copia el dominio estable de producción de Vercel; no uses una URL temporal de preview para CORS.

## 4. Render
New > Blueprint, selecciona el repositorio: render.yaml configura un servicio Free. Revisa que no se seleccione un plan pagado. Completa DATABASE_URL y CORS_ORIGINS=https://NOMBRE.vercel.app (sin barra final). JWT_SECRET se genera automáticamente. El arranque aplica migraciones antes de escuchar conexiones; no requiere Shell de pago.

Para la primera inicialización, añade en Environment:
- SEED_ON_START=true
- SEED_ADMIN_EMAIL: el correo que usarás para entrar
- SEED_ADMIN_PASSWORD: contraseña propia de al menos 16 caracteres

Reinicia/despliega y espera el mensaje Seed completado. Luego cambia SEED_ON_START=false y elimina SEED_ADMIN_PASSWORD de Environment. El seed conserva usuarios existentes: no cambia contraseñas en posteriores ejecuciones. No incluye ventas locales ni registros SMOKE/SECURITY.

## 5. Comprobar y compartir
Abre https://NOMBRE.onrender.com/health: debe responder status ok. Completa VITE_API_BASE_URL en Vercel y redeploy. Entra con el usuario creado, selecciona Casa Matriz y Caja 1. Comprueba que recargar /admin/facturas funciona. Crea un usuario separado para tu papá desde Usuarios y asígnale la sucursal y el rol adecuado para revisar. Comparte el enlace y la contraseña por un canal privado.

El backend gratuito puede tardar en despertar tras inactividad. Esta instalación es una demo, con DTE simulado y datos ficticios.

Fuentes: https://render.com/docs/blueprint-spec y https://vercel.com/docs/rewrites
