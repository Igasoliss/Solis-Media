    function le(e) {
      let n = (t) =>
        !Array.isArray(t) ||
        t.some(
          (a) =>
            !Array.isArray(a) || !N(a[0]) || !N(a[1]) || w(a[1]) <= w(a[0]),
        );
      switch (e?.type) {
        case "day":
          return !O(e.date) ||
            !["normal", "custom", "closed"].includes(e.action)
            ? "Datos del d\xEDa inv\xE1lidos"
            : e.action === "custom" && (n(e.ranges) || !e.ranges.length)
              ? "Revisa los horarios: la hora de t\xE9rmino debe ser despu\xE9s de la de inicio"
              : null;
        case "extra-add":
        case "block-add":
          return !O(e.date) || n([[e.start, e.end]])
            ? "Revisa el rango de horas"
            : null;
        case "extra-del":
        case "block-del":
          return e.id == null ? "Falta el elemento a quitar" : null;
        case "weekly":
          for (let t = 0; t < 7; t++)
            if (n(e.hours?.[t] || []))
              return "Revisa los horarios: la hora de t\xE9rmino debe ser despu\xE9s de la de inicio";
          return null;
        default:
          return "Cambio desconocido";
      }
    }
    function Q(e, n, t = () => `tmp-${Math.random()}`) {
      let a = structuredClone(e);
      if (
        (n.type === "day" &&
          (delete a.overrides[n.date],
          (a.blocks = a.blocks.filter(
            (s) => !(s.date === n.date && s.start_min == null),
          )),
          n.action === "custom" && (a.overrides[n.date] = ce(n.ranges)),
          n.action === "closed" &&
            a.blocks.push({
              id: t(),
              date: n.date,
              start_min: null,
              end_min: null,
              reason: n.reason || "",
            })),
        n.type === "extra-add" &&
          a.extras.push({
            id: t(),
            date: n.date,
            start_min: w(n.start),
            end_min: w(n.end),
          }),
        n.type === "extra-del" &&
          (a.extras = a.extras.filter((s) => String(s.id) !== String(n.id))),
        n.type === "block-add" &&
          a.blocks.push({
            id: t(),
            date: n.date,
            start_min: w(n.start),
            end_min: w(n.end),
            reason: n.reason || "",
          }),
        n.type === "block-del" &&
          (a.blocks = a.blocks.filter((s) => String(s.id) !== String(n.id))),
        n.type === "weekly")
      )
        for (let s = 0; s < 7; s++) a.weekly[s] = ce(n.hours[s]);
      return a;
    }
    function Ie(e, n) {
      return n.date
        ? [n.date]
        : n.type === "extra-del"
          ? e.extras
              .filter((t) => String(t.id) === String(n.id))
              .map((t) => t.date)
          : n.type === "block-del"
            ? e.blocks
                .filter((t) => String(t.id) === String(n.id))
                .map((t) => t.date)
            : null;
    }
    function de(e, n, t) {
      let a = Q(e, n),
        s = Ie(e, n);
      return e.bookings.filter(
        (l) =>
          l.date >= t && (!s || s.includes(l.date)) && !re(l, A(l.date, a)),
      );
    }
    function W(e) {
      let n = [];
      e.email && n.push("e:" + String(e.email).trim().toLowerCase());
      let t = String(e.phone || "").replace(/\D/g, "");
      return (t.length >= 8 && n.push("p:" + t.slice(-8)), n);
    }
    function ue(e, n) {
      let t = new Map(),
        a = (o) => {
          for (; t.get(o) !== o; ) (t.set(o, t.get(t.get(o))), (o = t.get(o)));
          return o;
        },
        s = (o) => {
          t.has(o) || t.set(o, o);
        },
        l = (o, i) => {
          (s(o), s(i));
          let c = a(o),
            m = a(i);
          c !== m && t.set(m, c);
        },
        u = new Map();
      e.forEach((o, i) => {
        let c = W(o);
        (c.length || c.push("n:" + K(o.name) + "#" + i), c.forEach(s));
        for (let m = 1; m < c.length; m++) l(c[0], c[m]);
        u.set(o, c[0]);
      });
      let d = new Map();
      e.forEach((o) => {
        if (W(o).length) {
          let i = K(o.name),
            c = a(u.get(o));
          (d.has(i) || d.set(i, new Set()), d.get(i).add(c));
        }
      });
      let f = new Map();
      e.forEach((o) => {
        if (W(o).length) return;
        let i = K(o.name),
          c = d.get(i);
        c && c.size === 1
          ? l([...c][0], u.get(o))
          : f.has(i)
            ? l(f.get(i), u.get(o))
            : f.set(i, u.get(o));
      });
      let g = new Map(),
        h = [...e].sort((o, i) =>
          (o.date + String(o.start_min).padStart(4, "0")).localeCompare(
            i.date + String(i.start_min).padStart(4, "0"),
          ),
        );
      for (let o of h) {
        let i = a(u.get(o)),
          c = g.get(i);
        (c ||
          g.set(
            i,
            (c = {
              key: i,
              name: o.name,
              email: "",
              phone: "",
              visits: 0,
              cancelled: 0,
              last: null,
              next: null,
              history: [],
            }),
          ),
          (c.name = o.name || c.name),
          o.email && (c.email = o.email),
          o.phone && (c.phone = o.phone),
          o.status === "cancelled"
            ? c.cancelled++
            : o.date < n
              ? (c.visits++, (c.last = o))
              : c.next || (c.next = o),
          c.history.push(o));
      }
      let y = (o) => o.date + String(o.start_min).padStart(4, "0");
      return [...g.values()]
        .map((o) => ({ ...o, history: o.history.reverse().slice(0, 15) }))
        .sort((o, i) =>
          o.next && i.next
            ? y(o.next).localeCompare(y(i.next))
            : o.next
              ? -1
              : i.next
                ? 1
                : (i.last?.date || "").localeCompare(o.last?.date || ""),
        );
    }
    function z(e, n, t) {
      let a = t.filter((h) => h.date === e && h.status !== "cancelled"),
        s = V(e, n),
        l = n.extras.filter((h) => h.date === e),
        u = n.blocks.filter((h) => h.date === e && h.start_min != null),
        d = e in n.overrides,
        f = !(n.weekly[F(e)] || []).length,
        g = "normal";
      return (
        s
          ? (g = "closed")
          : A(e, n).length
            ? d
              ? (g = "custom")
              : l.length
                ? (g = "extra")
                : u.length && (g = "partial")
            : (g = "off"),
        {
          date: e,
          kind: g,
          custom: d,
          closed: s,
          weeklyEmpty: f,
          open: A(e, n),
          base: G(e, n),
          extras: l,
          partialBlocks: u,
          confirmed: a.filter((h) => h.status === "confirmed").length,
          pending: a.filter((h) => h.status === "pending").length,
        }
      );
    }
    function me(e) {
      if (!Array.isArray(e) || !e.length)
        return { error: "Agrega al menos un servicio" };
      if (e.length > 40) return { error: "M\xE1ximo 40 servicios" };
      let n = new Set(),
        t = [];
      for (let [a, s] of e.entries()) {
        let l = String(s?.name || "")
            .trim()
            .slice(0, 60),
          u = Math.round(Number(s?.duration)),
          d = String(s?.price ?? "")
            .trim()
            .slice(0, 24),
          f = String(s?.description ?? "")
            .trim()
            .slice(0, 220);
        if (l.length < 2) return { error: `Ponle nombre al servicio ${a + 1}` };
        if (!(u >= 5 && u <= 480))
          return {
            error: `La duraci\xF3n de "${l}" debe ser entre 5 y 480 minutos`,
          };
        let g = /^[a-z0-9-]{1,40}$/.test(s?.id || "") ? s.id : Re(l),
          h = g,
          y = 2;
        for (; n.has(g); ) g = `${h}-${y++}`;
        (n.add(g),
          t.push({
            id: g,
            name: l,
            duration: u,
            price: d,
            description: f,
            active: s?.active !== !1,
          }));
      }
      return t.some((a) => a.active)
        ? { services: t }
        : { error: "Deja al menos un servicio visible en la agenda" };
    }
    function pe(e) {
      let n = (a, s) =>
          String(a ?? "")
            .trim()
            .slice(0, s),
        t = {
          name: n(e?.name, 60),
          tagline: n(e?.tagline, 140),
          address: n(e?.address, 120),
          phone: n(e?.phone, 30),
          whatsapp: String(e?.whatsapp || "")
            .replace(/\D/g, "")
            .slice(0, 15),
          instagram: Y(e?.instagram).slice(0, 30),
          tiktok: Y(e?.tiktok).slice(0, 30),
          facebook: Y(e?.facebook).slice(0, 80),
          website: n(e?.website, 120),
        };
      return t.name.length < 2
        ? { error: "Escribe el nombre del negocio" }
        : t.whatsapp && t.whatsapp.length < 8
          ? { error: "Revisa el n\xFAmero de WhatsApp" }
          : t.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(t.instagram)
            ? { error: "Revisa tu usuario de Instagram" }
            : t.tiktok && !/^[A-Za-z0-9._]{1,30}$/.test(t.tiktok)
              ? { error: "Revisa tu usuario de TikTok" }
              : t.facebook && !/^[A-Za-z0-9.\-]{1,80}$/.test(t.facebook)
                ? { error: "Revisa tu p\xE1gina de Facebook" }
                : t.website &&
                    (/^https?:\/\//i.test(t.website) ||
                      (t.website = "https://" + t.website),
                    !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(t.website))
                  ? { error: "Revisa la direcci\xF3n de tu web" }
                  : { profile: t };
    }
    function fe(e, n = {}) {
      let t = n.services || e.services.map((s) => ({ active: !0, ...s })),
        a = { ...e.business, ...(n.profile || {}) };
      return { ...e, business: a, services: t };
    }
