/* ==========================================================================
   Conexión de la agenda con Supabase (Solis media).
   Implementa las mismas rutas /api/... que usa la interfaz, pero contra la
   base de datos real. Las reglas de horario son las mismas del diseño.
   ========================================================================== */
(function () {
  "use strict";
  var w = (e) => { let [n, t] = String(e).split(":").map(Number); return n * 60 + t; },
    C = (e) => `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`,
    O = (e) => typeof e == "string" && /^\d{4}-\d{2}-\d{2}$/.test(e),
    N = (e) => typeof e == "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(e),
    F = (e) => { let [n, t, a] = e.split("-").map(Number); return new Date(Date.UTC(n, t - 1, a)).getUTCDay(); },
    D = (e, n) => { let [t, a, s] = e.split("-").map(Number); return new Date(Date.UTC(t, a - 1, s + n)).toISOString().slice(0, 10); },
    V = (e, n) => n.blocks.some((t) => t.date === e && t.start_min == null),
    re = (e, n) => n.some(([t, a]) => e.start_min >= t && e.end_min <= a),
    Le = (e, n, t, a) => e < a && t < n;
