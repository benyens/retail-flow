# Demo gratis: Neon + Render + Vercel

Orden que evita el círculo CORS ↔ URL del frontend. Nunca pegues contraseñas ni URLs de base de datos en chats o en el repo.

## 1. Neon (base de datos)
Proyecto nuevo → Connect → desactiva "Connection pooling" → copia la URL (`postgresql://...`). Sirve tal cual: el arranque quita `channel_binding`, agrega `sslmode`/`connect_timeout` y reintenta si Neon está dormida.

## 2. Render (API)
New > Blueprint → repo (`render.yaml`, plan Free). Variables:
- `DATABASE_URL`: la URL de Neon.
- `CORS_ORIGINS`: por ahora `https://placeholder.vercel.app` (se corrige en el paso 4).
- Primera vez: `SEED_ON_START=true`, `SEED_ADMIN_EMAIL=<tu correo>`, `SEED_ADMIN_PASSWORD=<16+ caracteres>`.

Espera "Seed completado" en los logs y abre `https://TU-API.onrender.com/health` → `{"status":"ok"}`.
Después: `SEED_ON_START=false` y borra `SEED_ADMIN_PASSWORD`.

## 3. Vercel (frontend)
Importa el repo (raíz, preset Vite, Node 22). Variables **antes** del primer deploy:
- `VITE_USE_MOCK=false`
- `VITE_API_BASE_URL=https://TU-API.onrender.com` (con o sin barra final, sin `/api/v1`)

## 4. Cerrar el círculo
Copia el dominio de producción de Vercel (`https://NOMBRE.vercel.app`, no el de preview) y ponlo en `CORS_ORIGINS` en Render (sin barra final). Render redeploya solo.

## 5. Entrar
Usa **el correo y la contraseña del seed** (no `admin@pos.cl`/`admin123`: son del modo mock y no existen en la API real). Elige Casa Matriz y Caja 1. Crea un usuario para tu papá en Usuarios.

## Si falla
| Síntoma | Causa | Arreglo |
|---|---|---|
| Toast "Correo o contraseña incorrectos" (antes "Error 401") | Credenciales mock o seed que no corrió | Usa las del seed; revisa que los logs digan "Seed completado" |
| Seed corrió con una clave equivocada | El seed no cambia usuarios existentes | Neon > SQL Editor: `DELETE FROM users WHERE email='TU_CORREO';` y redeploy con `SEED_ON_START=true` |
| "No se pudo conectar con el servidor" | API dormida o CORS | Espera ~1 min y reintenta; luego revisa `CORS_ORIGINS` (exacto, sin barra final) |
| "Falta VITE_API_BASE_URL" | Variable ausente en el build | Agrégala en Vercel y redeploya |
| Logs: `Falta la variable X` / `-pooler` / `migrate deploy falló` | Env o URL de Neon mal | Mensaje indica cuál; usa conexión directa |
| 404 al recargar una ruta | Root Directory distinto a la raíz | `vercel.json` ya reescribe a `index.html` |

## Notas
- Render Free duerme tras ~15 min: el primer acceso tarda hasta ~1 min (el login hace un ping de despertar). Para una presentación, abre `/health` unos minutos antes.
- DTE simulado y datos ficticios: es una demo.
