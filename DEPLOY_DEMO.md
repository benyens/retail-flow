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
Usa **el correo y la contraseña del seed** (no `admin@pos.cl`/`admin123`: son del modo mock y no existen en la API real). Elige Casa Matriz y Caja 1 (el navegador las recuerda para la próxima vez). Crea un usuario para tu papá en Usuarios.

Contraseñas (mínimo 10 caracteres): cada usuario la cambia en el menú → **Cambiar contraseña**; un ADMIN puede asignar una nueva a otro usuario en Usuarios → **Contraseña**. En ambos casos se cierran las demás sesiones de ese usuario.

## Si falla
| Síntoma | Causa | Arreglo |
|---|---|---|
| Toast "Correo o contraseña incorrectos" | Credenciales mock o seed que no corrió | Usa las del seed; revisa que los logs digan "Seed completado". El correo no distingue mayúsculas |
| "Demasiados intentos para esta cuenta" | 5 intentos fallidos en 1 minuto | Espera un minuto |
| "Tu sesión expiró" | Pasaron 12 h, o se cambió la contraseña en otro equipo | Vuelve a entrar; la app regresa a la página donde estabas |
| Olvidaste la contraseña de un usuario | — | Otro ADMIN: Usuarios → Contraseña. Si no queda ningún ADMIN con acceso: Neon > SQL Editor `DELETE FROM users WHERE email='TU_CORREO';` y redeploy con `SEED_ON_START=true` (falla si el usuario ya tiene ventas; en ese caso pide ayuda) |
| "No se pudo conectar con el servidor" | API dormida o CORS | Espera ~1 min y reintenta; luego revisa `CORS_ORIGINS` (exacto, sin barra final) |
| "Falta VITE_API_BASE_URL" | Variable ausente en el build | Agrégala en Vercel y redeploya |
| Logs: `Falta la variable X` / `-pooler` / `migrate deploy falló` | Env o URL de Neon mal | Mensaje indica cuál; usa conexión directa |
| 404 al recargar una ruta | Root Directory distinto a la raíz | `vercel.json` ya reescribe a `index.html` |

## Notas
- Render Free duerme tras ~15 min: el primer acceso tarda hasta ~1 min (el login hace un ping de despertar). Para una presentación, abre `/health` unos minutos antes.
- Las migraciones nuevas (p. ej. `20261105120000_password_management`, `20261106090000_stock_minimum`) se aplican solas al desplegar en Render (`migrate deploy` en el arranque).
- `TRUST_PROXY_HOPS` (opcional, por defecto `1`): cuántos proxies hay delante de la API. Si en los logs todas las IPs de login aparecen iguales, el límite por IP estaría agrupando a todos; súbelo a `2`. El límite por cuenta funciona igual.
- El CSP de `vercel.json` permite llamar solo a `*.onrender.com`. Si mueves la API a otro dominio, agrégalo en `connect-src`.
- En celular el menú se abre con el botón ☰ arriba a la izquierda; en el POS se alterna entre **Productos** y **Carrito** con la barra inferior.
- El escáner de códigos usa la cámara: funciona solo en HTTPS (Vercel lo es) y el navegador pide permiso la primera vez. En iPhone usa una librería que se descarga al abrir el escáner.
- El comprobante (`/comprobante/:id`, botón **Comprobante** en Ventas o tras cobrar) se imprime en térmica de 58/80 mm o se guarda como PDF desde Imprimir. **No es un documento tributario.** Nombre, RUT y dirección se editan en **Empresa y locales** (solo ADMIN).
- Listas de precios por local (p. ej. Tecnología / Minimarket) en **Empresa y locales**; cada local ve y vende solo lo que tiene precio en su lista. Los precios se editan en **Precios** eligiendo la lista. Migración `20261108120000_branch_price_lists`.
- Sucursales y cajas se crean en **Empresa y locales**; después, en **Usuarios → Acceso**, asigna la sucursal a encargados y cajeros.
- Admin y encargado entran sin caja (a Inicio); la caja se elige solo para vender. Una caja abierta por otra persona se puede revisar y cerrar, no usar para vender.
- La sesión se renueva sola mientras se usa la app; a los 7 días desde el login pide la contraseña de nuevo.
- DTE simulado y datos ficticios: es una demo.
