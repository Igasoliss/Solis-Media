
  /* ------------------------------------------------------------------ */
  var BASE = window.AGENDA_BASE;                 // configuración fija del negocio (colores, foto, zona horaria…)
  var SB = window.AGENDA_SUPABASE;               // { url, key }
  var sb = window.supabase.createClient(SB.url, SB.key, { auth: { persistSession: true, detectSessionInUrl: true } });
  var EMAIL_KEY = "agenda-admin-email";
  var BASE_URL = location.origin + location.pathname;
  // Correos automáticos (Supabase Edge Function "correos" + Resend). Si falla, la reserva igual queda.
  function correos(body) {
    try {
      fetch(SB.url + "/functions/v1/correos", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: SB.key }, body: JSON.stringify(body) }).catch(function () {});
    } catch (_) {}
  }

  // Enlaces de correo (invitación o recuperar clave) abren el panel en "crear clave"
  var h = location.hash, qs = new URLSearchParams(location.search);
  if (/type=(recovery|invite|signup|magiclink)/.test(h) || qs.get("modo") === "clave") window.__AGENDA_RESET__ = true;
  var ready = sb.auth.getSession().then(function () {
    if (window.__AGENDA_RESET__) { try { history.replaceState(null, "", location.pathname + "#panel"); } catch (e) {} }
  });

  function k(msg, status) { var e = new Error(msg); e.status = status || 400; throw e; }
  function q(tz, d) {
    d = d || new Date();
    var t = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((a) => [a.type, a.value]));
    return { date: `${t.year}-${t.month}-${t.day}`, min: Number(t.hour) * 60 + Number(t.minute) };
  }
  function weeklyFromBase() { var o = {}; for (var i = 0; i < 7; i++) o[i] = (BASE.hours[i] || []).map(([a, s]) => [w(a), w(s)]); return o; }
  function cfg(perfil, servicios) {
    return fe(BASE, { profile: perfil && Object.keys(perfil).length ? perfil : null, services: servicios && servicios.length ? servicios : null });
  }
  var E = (e) => e.map(([n, t]) => [C(n), C(t)]);

  /* ---------- datos ---------- */
  async function publico() {
    var { data, error } = await sb.rpc("agenda_publica");
    if (error || !data) k("No pudimos cargar la agenda. Intenta de nuevo en un momento.", 500);
    var st = {
      weekly: data.weekly && Object.keys(data.weekly).length ? data.weekly : weeklyFromBase(),
      overrides: data.overrides || {}, extras: data.extras || [], blocks: data.blocks || [],
      bookings: (data.ocupadas || []).map((o) => ({ date: o.date, start_min: o.start_min, end_min: o.end_min, status: "confirmed" })),
    };
    return { st: st, config: cfg(data.perfil, data.servicios) };
  }
  async function sesion() {
    await ready;
    var { data } = await sb.auth.getSession();
    if (!data.session) k("Tu sesión expiró. Vuelve a entrar.", 401);
    return data.session;
  }
  async function admin() {
    await sesion();
    var [a, b, c] = await Promise.all([
      sb.from("ajustes").select("*").eq("id", 1).maybeSingle(),
      sb.from("reservas").select("*").order("date").order("start_min"),
      sb.from("resenas").select("*"),
    ]);
    if (a.error || b.error || c.error) {
      var err = a.error || b.error || c.error;
      if (/permission|JWT|rls|row-level/i.test(err.message)) k("Tu sesión expiró. Vuelve a entrar.", 401);
      k("No pudimos cargar los datos. Intenta de nuevo.", 500);
    }
    var row = a.data || { perfil: {}, servicios: [], agenda: {} };
    var ag = row.agenda || {};
    var st = {
      weekly: ag.weekly && Object.keys(ag.weekly).length ? ag.weekly : weeklyFromBase(),
      overrides: ag.overrides || {}, extras: ag.extras || [], blocks: ag.blocks || [], seq: ag.seq || 1,
      bookings: b.data, reviews: c.data, perfil: row.perfil || {}, servicios: row.servicios || [],
    };
    st.config = cfg(st.perfil, st.servicios);
    return st;
  }
  async function guardarAjustes(cambios) {
    cambios.id = 1; cambios.actualizado = new Date().toISOString();
    var { error } = await sb.from("ajustes").upsert(cambios);
    if (error) k("No se pudo guardar. Intenta de nuevo.", 500);
  }
  var activas = (st) => st.bookings.filter((b) => b.status === "confirmed");
  var dataDe = (st) => ({ weekly: st.weekly, overrides: st.overrides, extras: st.extras, blocks: st.blocks, bookings: activas(st) });

  function L(st) {
    return function (e) {
      var svc = st.config.services.find((s) => s.id === e.service_id);
      var tel = String(e.phone || "").replace(/\D/g, ""); if (tel.length === 9) tel = "56" + tel;
      var link = BASE_URL + "?resena=" + e.token;
      var nombre = String(e.name || "").split(" ")[0];
      return {
        id: e.id, date: e.date, start: C(e.start_min), end: C(e.end_min), start_min: e.start_min, end_min: e.end_min,
        service: svc ? svc.name : e.service_id, name: e.name, email: e.email, phone: e.phone, note: e.note,
        status: e.status, source: e.source,
        review_link: tel.length >= 10 && e.status === "confirmed"
          ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${nombre}, gracias por venir a tu atención con ${st.config.business.name}. ¿Nos cuentas cómo te fue? Te toma un minuto: ${link}`)}`
          : null,
      };
    };
  }

  /* ---------- rutas ---------- */
  async function handle(path, opts) {
    opts = opts || {};
    var n = opts.method || "GET", t = opts.body || {};
    var s = new URL(path, "https://agenda.local"), l = s.pathname;

    if (l === "/api/config") {
      var P = await publico(), c = P.config;
      return { business: c.business, services: c.services.filter((i) => i.active !== false), daysAhead: c.daysAhead,
               timezone: c.timezone, holdMinutes: c.holdMinutes, dates: J(c, P.st) };
    }
    if (l === "/api/slots") {
      var P2 = await publico(), svc = P2.config.services.find((x) => x.id === s.searchParams.get("service") && x.active !== false);
      if (!svc) k("Servicio no disponible");
      var fecha = s.searchParams.get("date");
      return { date: fecha, slots: B({ config: P2.config, date: fecha, service: svc, data: P2.st }).map(C) };
    }
    if (l === "/api/bookings" && n === "POST") {
      if (t.website) k("No se pudo reservar");                       // trampa anti-spam del formulario
      var r = await sb.rpc("reservar_web", { p_service: t.service, p_date: t.date, p_start: w(t.time),
        p_name: t.name || "", p_email: (t.email || "").trim(), p_phone: t.phone || "", p_note: t.note || "",
        p_consent: t.consent === "1" });
      if (r.error) {
        var m = r.error.message || "";
        if (/OCUPADA/.test(m)) k("Ese horario ya no está disponible. Elige otro.", 409);
        if (/SERVICIO/.test(m)) k("Ese servicio ya no está disponible", 409);
        if (/NOMBRE/.test(m)) k("Escribe tu nombre");
        if (/CORREO/.test(m)) k("Revisa tu correo");
        if (/CONSENTIMIENTO/.test(m)) k("Para reservar, marca la casilla aceptando el uso de tus datos.");
        k("No pudimos reservar. Intenta de nuevo.", 500);
      }
      correos({ tipo: "nueva", token: r.data.token });
      return { ok: true, status: "confirmed", token: r.data.token };
    }
    if (l === "/api/cancel-info") {
      var ci = await sb.rpc("cancelar_info", { p_token: t.token });
      if (ci.error || !ci.data) k("No encontramos esta hora. Revisa el enlace.", 404);
      return ci.data;
    }
    if (l === "/api/cancel" && n === "POST") {
      var cw = await sb.rpc("cancelar_web", { p_token: t.token });
      if (cw.error) k(/PASADA/.test(cw.error.message || "") ? "Esta hora ya pasó, no se puede cancelar." : "No pudimos cancelar. Intenta de nuevo o escríbenos.", 409);
      if (!cw.data.ya) correos({ tipo: "cancelada", token: t.token });
      return { ok: true };
    }
    if (l === "/api/opiniones") {
      var op = await sb.rpc("resenas_publicas");
      if (op.error || !op.data) return { total: 0, items: [] };
      // Sin el servicio: mostrar qué examen se hizo alguien sería un dato de salud
      op.data.items = (op.data.items || []).map(function (o) {
        return { nombre: o.nombre, rating: o.rating, comment: o.comment };
      });
      return op.data;
    }
    if (l === "/api/review-info") {
      var ri = await sb.rpc("resena_info", { p_token: t.token });
      if (ri.error || !ri.data) k("No encontramos esta atención. Revisa el enlace.", 404);
      return ri.data;
    }
    if (l === "/api/review" && n === "POST") {
      var rv = await sb.rpc("enviar_resena", { p_token: t.token, p_rating: t.rating, p_comment: t.comment || "" });
      if (rv.error) k("No pudimos guardar tu reseña. Intenta de nuevo.");
      return { ok: true };
    }

    if (!l.startsWith("/api/admin")) k("No encontrado", 404);
    var d = l.replace("/api/admin", "");

    if (d === "/login") {
      var email = String(t.email || "").trim();
      if (!email) k("Escribe tu correo");
      var li = await sb.auth.signInWithPassword({ email: email, password: t.password || "" });
      if (li.error) k("Correo o clave incorrectos", 401);
      var ad = await sb.rpc("es_admin");
      if (ad.data !== true) { await sb.auth.signOut(); k("Este correo no tiene acceso al panel", 403); }
      try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
      return { token: "sb" };
    }
    if (d === "/forgot") {
      var fe_ = String(t.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fe_)) k("Escribe el correo con que entras al panel");
      var fr = await sb.auth.resetPasswordForEmail(fe_, { redirectTo: BASE_URL + "?modo=clave" });
      if (fr.error) k(/rate|limit|seconds/i.test(fr.error.message) ? "Ya te enviamos un enlace hace poco. Espera un minuto e intenta de nuevo." : "No pudimos enviar el enlace. Intenta de nuevo.");
      return { ok: true, sentTo: fe_, minutes: 60 };
    }
    if (d === "/reset-check") { await ready; var g = await sb.auth.getSession(); return { valid: !!g.data.session }; }
    if (d === "/reset") {
      if (String(t.password || "").length < 8) k("La clave debe tener al menos 8 caracteres");
      await sesion();
      var up = await sb.auth.updateUser({ password: t.password });
      if (up.error) k(/different|same/i.test(up.error.message) ? "La clave nueva debe ser distinta a la actual" : "No pudimos guardar la clave. Pide un enlace nuevo.");
      var ad2 = await sb.rpc("es_admin");
      if (ad2.data !== true) { await sb.auth.signOut(); k("Este correo no tiene acceso al panel", 403); }
      window.__AGENDA_RESET__ = false;
      return { token: "sb" };
    }
    if (d === "/logout") { await sb.auth.signOut({ scope: "local" }); return { ok: true }; }
    if (d === "/logout-all") { await sb.auth.signOut({ scope: "global" }); return { ok: true }; }

    var ses = await sesion();
    if (d === "/password") {
      if (String(t.password || "").length < 8) k("La clave debe tener al menos 8 caracteres");
      if (t.password === t.current) k("La clave nueva debe ser distinta a la actual");
      var chk = await sb.auth.signInWithPassword({ email: ses.user.email, password: t.current || "" });
      if (chk.error) k("Tu clave actual no es correcta");
      var up2 = await sb.auth.updateUser({ password: t.password });
      if (up2.error) k("No pudimos cambiar la clave. Intenta de nuevo.");
      return { ok: true };
    }
    if (d === "/account") return { email: ses.user.email, sessions: 1 };
    if (d === "/plan") {
      var sp = await sb.from("suscripcion").select("plan,estado,desde,proximo_cobro,monto,link_pago,nota").eq("id", 1).maybeSingle();
      return { plan: sp.error ? null : sp.data };
    }

    var st = await admin(), u = q(st.config.timezone).date, LL = L(st), data = dataDe(st);

    if (d === "/month") {
      var mo = s.searchParams.get("month") || u.slice(0, 7), i0 = `${mo}-01`, fin = D(D(i0, 32).slice(0, 7) + "-01", -1), days = [];
      for (var T = i0; T <= fin; T = D(T, 1)) { var M = z(T, data, data.bookings); days.push({ date: T, kind: M.kind, open: E(M.open), confirmed: M.confirmed, pending: M.pending }); }
      return { month: mo, today: u, days: days };
    }
    if (d === "/day") {
      var o = s.searchParams.get("date"), cz = z(o, data, data.bookings);
      return { date: o, today: u, kind: cz.kind, custom: cz.custom, closed: cz.closed, open: E(cz.open), base: E(cz.base),
        weekly: E(st.weekly[F(o)] || []), override: st.overrides[o] ? E(st.overrides[o]) : null,
        extras: cz.extras.map((m) => ({ id: m.id, start: C(m.start_min), end: C(m.end_min) })),
        blocks: cz.partialBlocks.map((m) => ({ id: m.id, start: C(m.start_min), end: C(m.end_min), reason: m.reason })),
        bookings: st.bookings.filter((m) => m.date === o).map(LL).sort((m, x) => m.start_min - x.start_min) };
    }
    if (d === "/week") {
      var ws = s.searchParams.get("start"), wd = [];
      for (var m2 = ws; m2 <= D(ws, 6); m2 = D(m2, 1)) {
        var x2 = z(m2, data, data.bookings);
        wd.push({ date: m2, kind: x2.kind, open: E(x2.open),
          bookings: activas(st).filter((b) => b.date === m2).sort((a, b) => a.start_min - b.start_min).map(LL) });
      }
      return { start: ws, today: u, days: wd };
    }
    if (d === "/clients") {
      return { today: u, clients: ue(st.bookings, u).map((i) => ({ ...i, last: i.last && LL(i.last), next: i.next && LL(i.next), history: i.history.map(LL) })) };
    }
    if (d === "/settings") return { services: st.config.services, profile: st.config.business };
    if (d === "/services" && n === "PUT") {
      var sv = me(t.services); if (sv.error) k(sv.error);
      await guardarAjustes({ servicios: sv.services });
      return { ok: true, services: sv.services };
    }
    if (d === "/profile" && n === "PUT") {
      var pr = pe(t.profile); if (pr.error) k(pr.error);
      await guardarAjustes({ perfil: pr.profile });
      return { ok: true, profile: fe(BASE, { profile: pr.profile }).business };
    }
    if (d === "/reviews") {
      var rs = (st.reviews || []).map((i) => {
        var c2 = st.bookings.find((m) => m.id === i.booking_id) || {}, sv2 = st.config.services.find((x) => x.id === c2.service_id);
        return { rating: i.rating, comment: i.comment || "", name: c2.name, date: c2.date, service: sv2 && sv2.name, created_at: i.created_at };
      }).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { average: rs.length ? rs.reduce((a, b) => a + b.rating, 0) / rs.length : null, count: rs.length, reviews: rs };
    }
    if (d === "/weekly") { var hw = {}; for (var i = 0; i < 7; i++) hw[i] = E(st.weekly[i] || []); return { hours: hw }; }
    if (d === "/change") {
      var ch = t.change, err = le(ch); if (err) k(err);
      if (ch.date && ch.date < u) k("No se pueden cambiar días que ya pasaron");
      var conf = de(data, ch, u);
      if (t.dryRun) return { conflicts: conf.map(LL) };
      var seq = st.seq;
      var nx = Q({ weekly: st.weekly, overrides: st.overrides, extras: st.extras, blocks: st.blocks, bookings: [] }, ch, () => seq++);
      await guardarAjustes({ agenda: { weekly: nx.weekly, overrides: nx.overrides, extras: nx.extras, blocks: nx.blocks, seq: seq } });
      if (conf.length) {
        var cr = await sb.from("reservas").update({ status: "cancelled" }).in("id", conf.map((b) => b.id));
        if (cr.error) k("Se guardó el horario, pero no se pudieron cancelar las horas que chocan.", 500);
      }
      return { ok: true, cancelled: conf.length };
    }
    if (d === "/bookings" && n === "POST") {
      var sv3 = st.config.services.find((x) => x.id === t.service);
      if (!sv3 || !t.name || !N(t.time) || !O(t.date)) k("Faltan datos");
      var a3 = w(t.time), c3 = a3 + sv3.duration;
      if (activas(st).some((m) => m.date === t.date && m.start_min < c3 && a3 < m.end_min)) k("Ese horario choca con otra reserva", 409);
      var ins = await sb.from("reservas").insert({ service_id: sv3.id, date: t.date, start_min: a3, end_min: c3, name: String(t.name).trim(),
        email: t.email || null, phone: t.phone || null, note: null, status: "confirmed", source: "panel" });
      if (ins.error) k("No se pudo guardar la hora. Revisa los datos.", 400);
      return { ok: true };
    }
    var y = d.match(/^\/bookings\/(.+)\/cancel$/);
    if (y) {
      var cc = await sb.from("reservas").update({ status: "cancelled" }).eq("id", y[1]);
      if (cc.error) k("No se pudo cancelar. Intenta de nuevo.", 500);
      return { ok: true };
    }
    k("No encontrado", 404);
  }

  window.AGENDA_API = handle;
  window.AGENDA_SB = sb;
})();
