# Guía de prueba con usuario: demo Retail Flow

Una sesión de unos 40 minutos con una persona que atiende un local (tu papá). El objetivo es **ver dónde se traba**, no enseñarle el sistema. Mientras prueba, no lo ayudes. Si se queda pegado más de un minuto, anota el punto y recién ahí le das una pista.

## Antes (10 min, sin él)

- Abre `https://TU-API.onrender.com/health` 5 minutos antes, para que la API ya esté despierta.
- Crea su usuario (rol **Encargado**, sucursal Casa Matriz) con una contraseña temporal de 10 o más caracteres.
- Deja 3 o 4 productos con stock y precio, y la caja **cerrada**. Abrirla es parte de la prueba.
- Ten a mano una hoja para anotar: tarea, si la completó (sí/con ayuda/no), tiempo aproximado y frases textuales.

## Inicio (5 min)

- "Estoy probando el sistema, no a ti. Si algo te confunde, es culpa del sistema."
- "Piensa en voz alta: dime qué buscas y qué esperas que pase."
- Pregunta de contexto: "¿Cómo registras hoy una venta y cómo sabes cuánto stock queda?"

## Tareas

Léele cada tarea tal cual, sin nombrar botones ni menús.

| # | Dispositivo | Tarea | Qué observar |
|---|---|---|---|
| 1 | Celular | "Entra con este correo y esta clave." | ¿Escribe el correo sin problemas? ¿Entiende la elección de sucursal y caja? |
| 2 | Celular | "Cámbiala por una clave que tú recuerdes." | ¿Encuentra el menú ☰? ¿Entiende el mínimo de 10 caracteres? |
| 3 | PC | "Abre la caja con $50.000 de sencillo." | ¿Entiende "fondo inicial"? |
| 4 | PC | "Un cliente lleva 2 de [producto] y paga con $5.000 en efectivo." | Búsqueda, cantidad, pantalla de pago y vuelto. |
| 5 | Celular | "Vende 1 [producto] desde el celular." | ¿Descubre la barra Productos/Carrito? ¿Encuentra **Pagar**? |
| 6 | PC | "El cliente devolvió uno. Regístralo." | ¿Llega a Devoluciones? ¿Entiende la nota de crédito? |
| 7 | Celular | "¿Cuánto stock queda de [producto]?" | ¿Va a Stock o lo busca en el POS? |
| 8 | PC | "Llegó esta factura del proveedor: ingrésala." (usa una real o inventada en papel) | Neto vs. IVA, proveedor nuevo, producto nuevo. |
| 9 | Celular | "¿Cuánto vendiste hoy?" | ¿Encuentra Reportes? ¿Le hacen sentido los números? |
| 10 | PC | "Cierra la caja." | El arqueo: ¿entiende la diferencia esperado/declarado? |

## Cierre (5 min)

- "¿Qué fue lo más difícil?" y "¿Qué te faltó que usas todos los días?"
- "Del 1 al 5, ¿qué tan fácil fue?" Después pregunta por qué no le puso un punto más.
- "¿Lo usarías mañana en el local? ¿Qué tendría que cambiar?"

## Después: ordenar lo que viste

1. Pasa cada traba a una nota corta, en sus palabras cuando puedas.
2. Agrupa por tema (navegación, vocabulario, pago, celular, facturas…).
3. Clasifica cada tema:
   - **Bloqueante**: no pudo terminar la tarea.
   - **Molesto**: terminó, pero con dudas o errores.
   - **Sugerencia**: idea suya.
4. Arregla primero lo bloqueante que aparezca en tareas diarias (3, 4, 5 y 10).

## Cuidado con

- Hacerle preguntas que guíen ("¿viste el botón Pagar?"). Mejor: "¿Qué harías ahora?"
- Defender el diseño. Solo anota.
- Probar todo en un solo dispositivo. El uso real mezcla PC en el mesón y celular fuera del local.
