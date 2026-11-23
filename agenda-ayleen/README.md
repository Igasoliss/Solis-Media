# Agenda online · plantilla Solis media (v0.1, matrona)

Un solo archivo `index.html`, sin instalar nada. Se abre en el navegador o se sube a GitHub Pages / Netlify.

## Qué hace

**Paciente** (página principal)
1. Elige la atención (con duración y precio).
2. Elige día y hora: solo ve horas realmente libres según horario, citas ya tomadas, bloqueos y anticipación mínima.
3. Deja nombre, RUT (validado), teléfono, correo opcional y acepta el uso de sus datos.
4. Recibe confirmación, botón para avisar por WhatsApp y archivo para agregar la hora a su calendario.

**Matrona** (`index.html#admin`, link "Acceso profesional" al pie)
- Agenda por día con datos de contacto, marcar atendida, cancelar (libera la hora) o reabrir.
- Lista de próximas horas y total estimado del día.
- Bloquear un día completo o un tramo (vacaciones, trámites).
- Agendar manualmente pacientes que llaman por teléfono.
- Exportar todo a CSV (se abre en Excel).

## Cómo adaptarlo a otro cliente (barbería, kine, psicóloga…)

Edita solo el objeto `CONFIG` al inicio del archivo: nombre, colores, ícono, dirección, WhatsApp, horario semanal, servicios, intervalo entre horas, si pide RUT y el texto de consentimiento. Para una barbería, por ejemplo: `pedirRut:false`, servicios "Corte", "Corte + barba", etc.

## Supuestos de esta primera versión (importante)

| Tema | Cómo está hoy | Qué falta para producción |
|---|---|---|
| **Dónde se guardan las citas** | En el navegador (`localStorage`). Sirve para mostrar la demo, **pero la matrona no ve las reservas hechas desde el celular de una paciente**. | Conectar una base de datos. Todo el acceso está en el objeto `Store`, así que solo se reemplaza esa parte. |
| **Acceso de la matrona** | PIN escrito en el código. **No es seguridad real**: cualquiera que vea el código lo ve. | Login real (correo + contraseña o enlace mágico) en el backend. |
| **Avisos** | Botón de WhatsApp que abre el mensaje + archivo de calendario con alarma 2 h antes. | Correo de confirmación y recordatorio automático (ej. Resend/Brevo, o WhatsApp Business API). |
| **Pagos** | No cobra; muestra el precio. | Opcional: link de pago (Mercado Pago / Flow / Webpay) o abono para reservar. |
| **Datos de salud** | Solo pide datos de contacto; el comentario dice explícitamente no poner información médica. | En Chile la Ley 19.628 (y la nueva ley de datos personales, Ley 21.719) trata los datos de salud como sensibles: no guardar diagnósticos aquí, base de datos con acceso restringido, política de privacidad visible. |

## Opciones de base de datos recomendadas

1. **Supabase** (recomendada): gratis para empezar, login real para la matrona, reglas de acceso por fila para que las pacientes solo puedan crear reservas y no leer las de otras. Sirve para todos tus clientes (un proyecto por cliente o una tabla con `cliente_id`).
2. **Google Sheets + Apps Script**: lo más simple, la matrona ve sus citas en una planilla. Menos seguro y más lento; bien para clientes muy pequeños.
3. **Firebase**: similar a Supabase, de Google.
