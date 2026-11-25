    function q(e, n = new Date()) {
      let t = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: e,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(n)
          .map((a) => [a.type, a.value]),
      );
      return {
        date: `${t.year}-${t.month}-${t.day}`,
        min: Number(t.hour) * 60 + Number(t.minute),
      };
    }
    function ie(e) {
      let n = {};
      for (let t = 0; t < 7; t++)
        n[t] = (e.hours[t] || []).map(([a, s]) => [w(a), w(s)]);
      return n;
    }
    function U(e) {
      let n = e
          .filter(([a, s]) => s > a)
          .map((a) => [...a])
          .sort((a, s) => a[0] - s[0]),
        t = [];
      for (let a of n) {
        let s = t[t.length - 1];
        s && a[0] <= s[1] ? (s[1] = Math.max(s[1], a[1])) : t.push(a);
      }
      return t;
    }
    function Ae(e, n) {
      let t = e;
      for (let [a, s] of n) {
        let l = [];
        for (let [u, d] of t) {
          if (s <= u || a >= d) {
            l.push([u, d]);
            continue;
          }
          (a > u && l.push([u, a]), s < d && l.push([s, d]));
        }
        t = l;
      }
      return t;
    }
    function G(e, n) {
      let t = n.overrides[e] ?? n.weekly[F(e)] ?? [],
        a = n.extras
          .filter((s) => s.date === e)
          .map((s) => [s.start_min, s.end_min]);
      return U([...t, ...a]);
    }
    function A(e, n) {
      if (V(e, n)) return [];
      let t = n.blocks
        .filter((a) => a.date === e && a.start_min != null)
        .map((a) => [a.start_min, a.end_min]);
      return Ae(G(e, n), t);
    }
    function B({
      config: e,
      date: n,
      service: t,
      data: a,
      now: s = new Date(),
    }) {
      let l = q(e.timezone, s);
      if (!O(n) || n < l.date || n > D(l.date, e.daysAhead)) return [];
      let u = a.bookings.filter((f) => f.date === n),
        d = [];
      for (let [f, g] of A(n, a)) {
        let h = f + ((e.slotStep - (f % e.slotStep)) % e.slotStep);
        for (let y = h; y + t.duration <= g; y += e.slotStep)
          (n === l.date && y < l.min + e.minNoticeMinutes) ||
            u.some((o) => Le(y, y + t.duration, o.start_min, o.end_min)) ||
            d.push(y);
      }
      return d;
    }
    function J(e, n, t = new Date()) {
      let a = q(e.timezone, t).date,
        s = [];
      for (let l = 0; l <= e.daysAhead; l++) {
        let u = D(a, l);
        A(u, n).length && s.push(u);
      }
      return s;
    }
