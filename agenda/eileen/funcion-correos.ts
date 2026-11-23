// Supabase Edge Function "correos" · Agenda online Solís Media
// Envía con Resend: confirmación a la paciente (con opción de cancelar), aviso
// de nueva hora y de cancelación a la profesional, recordatorio 24 h antes y
// solicitud de reseña 3 h después de la atención.
// Cada correo se envía una sola vez (columnas *_sent_at), así que llamar la
// función de más no duplica nada.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITE = "https://solismedia.cl/agenda/eileen/";
const FROM = "Agenda Matrona Eileen Cartes <agenda@solismedia.cl>";
const TZ = "America/Santiago";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
// Clave de servidor: el formato nuevo (sb_secret_...) o el antiguo (service_role)
function claveServidor() {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const v = k.default ?? Object.values(k)[0];
    if (v) return String(v);
  } catch (_) { /* sin claves nuevas */ }
  return Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const db = createClient(Deno.env.get("SUPABASE_URL")!, claveServidor(), { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fecha(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
  return `${DIAS[wd]} ${dd} de ${MESES[m - 1]}`;
}
// Minutos absolutos en hora de Chile, para comparar sin líos de zona horaria
function absMin(date: string, min: number) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + min;
}
function ahoraChile(t = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(t).map((x) => [x.type, x.value]));
  return absMin(`${p.year}-${p.month}-${p.day}`, Number(p.hour) * 60 + Number(p.minute));
}

async function negocio() {
  const { data } = await db.from("ajustes").select("perfil, servicios").eq("id", 1).maybeSingle();
  const perfil = data?.perfil ?? {};
  return {
    name: perfil.name || "Matrona Eileen Cartes",
    address: perfil.address || "Edificio Futuro Center · O'Higgins Poniente 77, Concepción",
    phone: perfil.phone || "+56 9 7481 3574",
    whatsapp: String(perfil.whatsapp || "").replace(/\D/g, ""),
    servicios: (data?.servicios ?? []) as { id: string; name: string }[],
  };
}
async function admins(): Promise<string[]> {
  const { data } = await db.from("administradoras").select("email");
  return (data ?? []).map((r: { email: string }) => r.email);
}

function plantilla(n: { name: string; address: string; phone: string }, titulo: string, cuerpo: string, boton?: { texto: string; url: string }, pie = "") {
  return `<!doctype html><html><body style="margin:0;background:#FFF8EC;font-family:Arial,Helvetica,sans-serif;color:#1A1217">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#4E2145;color:#fff;padding:16px 22px;font-weight:bold;font-size:15px">${esc(n.name)}</td></tr>
<tr><td style="padding:22px">
<h1 style="font-size:20px;margin:0 0 10px;color:#4E2145">${titulo}</h1>
${cuerpo}
${boton ? `<p style="margin:22px 0 6px"><a href="${boton.url}" style="background:#F6BDE0;color:#4E2145;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px;display:inline-block">${esc(boton.texto)}</a></p>` : ""}
${pie}
</td></tr>
<tr><td style="padding:14px 22px;background:#F7F6F2;color:#6E6A6C;font-size:12px">${esc([n.address, n.phone].filter(Boolean).join(" · "))}</td></tr>
</table></td></tr></table></body></html>`;
}
const resumen = (svc: string, b: { date: string; start_min: number }) =>
  `<p style="background:#F7F6F2;border-radius:12px;padding:12px 14px;margin:14px 0;line-height:1.6"><b>${esc(svc)}</b><br>${esc(fecha(b.date))}, ${hhmm(b.start_min)} hrs</p>`;

async function enviar(to: string | string[], subject: string, html: string) {
  if (!RESEND) throw new Error("Falta RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

type Reserva = { id: string; token: string; service_id: string; date: string; start_min: number; end_min: number; name: string; email: string | null; phone: string | null; note: string | null; status: string; source: string; created_at: string; confirm_sent_at: string | null; reminder_sent_at: string | null; review_sent_at: string | null; cancel_notified_at: string | null };

async function nueva(token: string) {
  const { data: b, error } = await db.from("reservas").select("*").eq("token", token).maybeSingle<Reserva>();
  if (error) throw new Error("DB: " + error.message);
  if (!b || b.status !== "confirmed" || b.confirm_sent_at) return { skipped: true };
  // Marcar primero, así dos llamadas seguidas no mandan dos correos
  const { data: lock } = await db.from("reservas").update({ confirm_sent_at: new Date().toISOString() }).eq("id", b.id).is("confirm_sent_at", null).select("id");
  if (!lock?.length) return { skipped: true };
  const n = await negocio(), svc = n.servicios.find((s) => s.id === b.service_id)?.name ?? b.service_id;
  const nombre = b.name.split(" ")[0];
  if (b.email) {
    await enviar(b.email, `Tu hora está reservada · ${fecha(b.date)} ${hhmm(b.start_min)}`, plantilla(n,
      `¡Listo, ${esc(nombre)}! Tu hora está reservada`,
      `<p style="margin:0;color:#6E6A6C">Te esperamos. Un día antes te enviaremos un recordatorio.</p>${resumen(svc, b)}${n.address ? `<p style="margin:0;color:#6E6A6C">📍 ${esc(n.address)}</p>` : ""}`,
      undefined,
      `<p style="margin:18px 0 0;font-size:13px;color:#6E6A6C">¿No puedes asistir? <a href="${SITE}?cancelar=${b.token}" style="color:#4E2145">Cancela tu hora aquí</a> para que otra paciente pueda usarla.</p>`));
  }
  const to = await admins();
  if (to.length) {
    await enviar(to, `Nueva hora: ${b.name} · ${fecha(b.date)} ${hhmm(b.start_min)}`, plantilla(n, "Nueva hora agendada",
      `${resumen(svc, b)}<p style="margin:0;line-height:1.6"><b>${esc(b.name)}</b><br>${esc(b.email ?? "")}${b.phone ? `<br>${esc(b.phone)}` : ""}${b.note ? `<br><i>“${esc(b.note)}”</i>` : ""}</p>`,
      { texto: "Ver mi agenda", url: SITE + "#panel" }));
  }
  return { ok: true };
}

async function cancelada(token: string) {
  const { data: b } = await db.from("reservas").select("*").eq("token", token).maybeSingle<Reserva>();
  if (!b || b.status !== "cancelled" || b.cancel_notified_at) return { skipped: true };
  const { data: lock } = await db.from("reservas").update({ cancel_notified_at: new Date().toISOString() }).eq("id", b.id).is("cancel_notified_at", null).select("id");
  if (!lock?.length) return { skipped: true };
  const n = await negocio(), svc = n.servicios.find((s) => s.id === b.service_id)?.name ?? b.service_id;
  const to = await admins();
  if (to.length) await enviar(to, `Hora cancelada: ${b.name} · ${fecha(b.date)} ${hhmm(b.start_min)}`, plantilla(n, "Una paciente canceló su hora",
    `${resumen(svc, b)}<p style="margin:0">${esc(b.name)} canceló desde el enlace de su correo. La hora quedó libre en la agenda.</p>`,
    { texto: "Ver mi agenda", url: SITE + "#panel" }));
  if (b.email) await enviar(b.email, "Tu hora fue cancelada", plantilla(n, "Tu hora fue cancelada",
    `${resumen(svc, b)}<p style="margin:0;color:#6E6A6C">Cuando quieras, puedes reservar una nueva hora.</p>`, { texto: "Reservar otra hora", url: SITE }));
  return { ok: true };
}

async function programados() {
  const ahora = ahoraChile();
  const hoy = new Date(); const desde = new Date(hoy.getTime() - 4 * 864e5).toISOString().slice(0, 10), hasta = new Date(hoy.getTime() + 3 * 864e5).toISOString().slice(0, 10);
  const { data } = await db.from("reservas").select("*").eq("status", "confirmed").gte("date", desde).lte("date", hasta);
  const { data: hechas } = await db.from("resenas").select("booking_id");
  const conResena = new Set((hechas ?? []).map((r: { booking_id: string }) => r.booking_id));
  const n = await negocio();
  let recordatorios = 0, resenas = 0;
  for (const b of (data ?? []) as Reserva[]) {
    if (!b.email) continue;
    const ini = absMin(b.date, b.start_min), fin = absMin(b.date, b.end_min), creada = ahoraChile(new Date(b.created_at));
    const svc = n.servicios.find((s) => s.id === b.service_id)?.name ?? b.service_id, nombre = b.name.split(" ")[0];
    // Recordatorio: entre 24 h y 2 h antes, solo si reservó con más de un día de anticipación
    if (!b.reminder_sent_at && ini - ahora <= 1440 && ini - ahora > 120 && ini - creada > 1440) {
      const { data: lock } = await db.from("reservas").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id).is("reminder_sent_at", null).select("id");
      if (lock?.length) {
        await enviar(b.email, `Recordatorio: tu hora es mañana a las ${hhmm(b.start_min)}`, plantilla(n, `Hola ${esc(nombre)}, te recordamos tu hora`,
          `${resumen(svc, b)}${n.address ? `<p style="margin:0;color:#6E6A6C">📍 ${esc(n.address)}</p>` : ""}`, undefined,
          `<p style="margin:18px 0 0;font-size:13px;color:#6E6A6C">¿No puedes asistir? <a href="${SITE}?cancelar=${b.token}" style="color:#4E2145">Cancela tu hora aquí</a>.</p>`));
        recordatorios++;
      }
    }
    // Reseña: 3 h después de terminar, hasta 3 días después
    if (!b.review_sent_at && !conResena.has(b.id) && ahora - fin >= 180 && ahora - fin <= 3 * 1440) {
      const { data: lock } = await db.from("reservas").update({ review_sent_at: new Date().toISOString() }).eq("id", b.id).is("review_sent_at", null).select("id");
      if (lock?.length) {
        const yo = n.name.replace(/^(matrona|matr[oó]n|dra?\.?|doctora?|lic\.?|klgo\.?|kine)\s+/i, "").split(" ")[0];
        await enviar(b.email, `¿Qué te pareció mi atención, ${nombre}?`, plantilla(n, `Hola ${esc(nombre)}, ¿qué te pareció mi atención?`,
          `<p style="margin:0 0 10px;line-height:1.6">Gracias por venir a tu hora. Me encantaría saber cómo te sentiste.</p><p style="margin:0;line-height:1.6;color:#6E6A6C">Tu opinión me ayuda mucho a mejorar y orienta a otras pacientes que buscan atención. Te toma un minuto.</p>${resumen(svc, b)}<p style="margin:0;line-height:1.6">Un abrazo,<br><b>${esc(yo)}</b></p>`,
          { texto: "Dejar mi opinión ★★★★★", url: `${SITE}?resena=${b.token}` }));
        resenas++;
      }
    }
  }
  return { ok: true, recordatorios, resenas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const tok = /^[0-9a-f-]{36}$/i.test(body.token ?? "") ? body.token : null;
    if (body.tipo === "nueva" && tok) return json(await nueva(tok));
    if (body.tipo === "cancelada" && tok) return json(await cancelada(tok));
    if (body.tipo === "programados") return json(await programados());
    if (body.tipo === "diagnostico") {
      const { count, error } = await db.from("reservas").select("id", { count: "exact", head: true });
      return json({ claves: ["SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"].filter((k) => !!Deno.env.get(k)), reservas: count, error: error?.message ?? null });
    }
    return json({ error: "Solicitud no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
