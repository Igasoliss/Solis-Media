# Plantilla · Agenda online Solís Media (v1)

Prototipo fijo de la agenda, igual a `agenda/eileen/` (versión aprobada el 25-11-2026).
No se edita para un cliente: se copia.

## Qué incluye

**Paciente:** servicios con precio o botón **Consultar** (abre WhatsApp), opiniones,
reserva en 3 pasos con consentimiento de datos, cancelar desde el correo y dejar reseña.

**Panel:** Hoy (módulos de 1 h o 30 min), Semana, Mes, Clientes, Reseñas, Servicios,
Mi horario, Perfil y redes, Mi plan.

**Correos (Resend):** confirmación, aviso de nueva hora, recordatorio el día antes,
cancelación y pedido de reseña 3 horas después.

## Archivos

| Archivo | Para qué |
|---|---|
| `construir.py` | Arma el `index.html` final desde `fuente/` |
| `fuente/diseno-original.html` | Diseño original (no tocar) |
| `fuente/*.js` | Supabase, opiniones, Mi plan, módulos de Hoy |
| `supabase/*.sql` | Base de datos (en orden, ver abajo) |
| `supabase/funcion-correos.ts` | Edge Function `correos` |

## Cliente nuevo

1. **Supabase:** en SQL Editor corre en orden `supabase.sql`, `supabase-correos.sql`
   (cambia antes la URL y key del cron), `supabase-consentimiento.sql`,
   `supabase-opiniones.sql`, `supabase-plan.sql`.
2. **Correos:** crea la Edge Function `correos` con `funcion-correos.ts`. Cambia antes
   `SITE`, `FROM` y los datos por defecto (nombre, teléfono). Agrega el secreto `RESEND_API_KEY`.
3. **Construir:**
   ```
   python3 construir.py https://<ref>.supabase.co <publishable_key> ../<cliente>/index.html
   ```
   Cambia el `<title>` del `index.html` generado.
4. **Datos:** en el panel (`#panel`) completa Perfil y redes (incluye WhatsApp),
   Servicios (si no tiene precio fijo escribe "Consultar") y Mi horario.
5. **Accesos:** agrega su correo en `administradoras`, configura Auth > URL Configuration
   y crea su fila en `suscripcion`.
6. Copia y adapta `privacidad.html` desde `agenda/eileen/`.

Etiqueta git de esta versión: `plantilla-agenda-v1`.
