  var ce = (e) => U((e || []).map(([n, t]) => [w(n), w(t)])),
    K = (e) => String(e || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " "),
    Re = (e) => String(e).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "servicio",
    Y = (e) => String(e || "").trim().replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|facebook\.com)\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
