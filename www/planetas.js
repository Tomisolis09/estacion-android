// ============================================================
// PLANETAS: cuándo se ven desde tu ubicación (cálculo local, funciona sin internet)
// Elementos orbitales aproximados de JPL (Standish, válidos 1800-2050). Precisión de posición: unos pocos
// minutos de arco, suficiente para saber si un planeta se ve y a qué hora (los horarios pueden diferir unos minutos).
// Se considera "visible" si está a más de 5° sobre el horizonte con el cielo oscuro (Sol a más de 4° bajo el horizonte).
// ============================================================
const PLANETAS = (() => {
  const RAD = Math.PI / 180;
  // [a, da, e, de, I, dI, L, dL, perihelio, dPerihelio, nodo, dNodo]  (UA y grados; las derivadas son por siglo)
  const EL = {
    mercurio: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    venus:    [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    tierra:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
    marte:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    jupiter:  [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    saturno:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  };
  const LISTA = [
    { id: "venus", nombre: "Venus", color: "#f5e6a8" },
    { id: "jupiter", nombre: "Júpiter", color: "#e8c9a0" },
    { id: "marte", nombre: "Marte", color: "#e0684a" },
    { id: "saturno", nombre: "Saturno", color: "#d9b46a" },
    { id: "mercurio", nombre: "Mercurio", color: "#b7bcc6" },
  ];
  const ALT_MIN = 5, SOL_MAX = -4, PASO_MS = 10 * 60000;

  const norm = g => ((g % 360) + 360) % 360;
  function kepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 15; i++) { const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E)); E += dE; if (Math.abs(dE) < 1e-12) break; }
    return E;
  }
  // Posición heliocéntrica (eclíptica J2000, UA)
  function helio(c, T) {
    const p = EL[c], a = p[0] + p[1] * T, e = p[2] + p[3] * T, I = (p[4] + p[5] * T) * RAD;
    const L = p[6] + p[7] * T, w = p[8] + p[9] * T, O = (p[10] + p[11] * T) * RAD;
    let M = norm(L - w); if (M > 180) M -= 360;
    const om = (w * RAD) - O, E = kepler(M * RAD, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [
      (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      (so * sI) * xp + (co * sI) * yp,
    ];
  }
  // Vector eclíptico J2000 -> ascensión recta y declinación de la fecha
  function ecuatorial(v, T) {
    const pre = 1.396971 * T * RAD, c = Math.cos(pre), s = Math.sin(pre);
    const x = v[0] * c - v[1] * s, y = v[0] * s + v[1] * c, z = v[2];
    const eps = (23.439291 - 0.0130042 * T) * RAD, r = Math.hypot(x, y, z);
    return { ra: Math.atan2(y * Math.cos(eps) - z * Math.sin(eps), x), dec: Math.asin((y * Math.sin(eps) + z * Math.cos(eps)) / r), dist: r };
  }
  // Altura (grados) y azimut (grados desde el Norte hacia el Este) para un lugar y momento
  function horizontal(eq, jd, lat, lon) {
    const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545);
    const H = (norm(gmst + lon) * RAD) - eq.ra, phi = lat * RAD;
    const alt = Math.asin(Math.sin(phi) * Math.sin(eq.dec) + Math.cos(phi) * Math.cos(eq.dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(eq.dec) * Math.cos(phi)) / RAD + 180;
    return { alt: alt / RAD, az: norm(az) };
  }
  // Brillo aparente (magnitud): menor número = más brillante
  function magnitud(id, r, d, R, T, lonEcl, latEcl) {
    const i = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - R * R) / (2 * r * d)))) / RAD, base = 5 * Math.log10(r * d);
    if (id === "mercurio") return -0.42 + base + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i;
    if (id === "venus") return -4.40 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    if (id === "marte") return -1.52 + base + 0.016 * i;
    if (id === "jupiter") return -9.40 + base + 0.005 * i;
    // Saturno: incluye el efecto de la inclinación de los anillos
    const ip = 28.06 * RAD, Op = (169.51 + 3.82 * T) * RAD;
    const sinB = Math.sin(ip) * Math.cos(latEcl) * Math.sin(lonEcl - Op) - Math.cos(ip) * Math.sin(latEcl);
    return -8.88 + base + 0.044 * i - 2.60 * Math.abs(sinB) + 1.25 * sinB * sinB;
  }
  const jdDe = ms => ms / 86400000 + 2440587.5;

  // Estado de todos los cuerpos en un instante
  function estadoEn(ms, lat, lon) {
    const jd = jdDe(ms), T = (jd - 2451545) / 36525;
    const tierra = helio("tierra", T), R = Math.hypot(...tierra);
    const sol = horizontal(ecuatorial([-tierra[0], -tierra[1], -tierra[2]], T), jd, lat, lon);
    const pl = {};
    for (const p of LISTA) {
      const h = helio(p.id, T), g = [h[0] - tierra[0], h[1] - tierra[1], h[2] - tierra[2]];
      const eq = ecuatorial(g, T), pos = horizontal(eq, jd, lat, lon);
      pl[p.id] = { alt: pos.alt, az: pos.az, g, h, r: Math.hypot(...h), d: Math.hypot(...g), R, T };
    }
    return { solAlt: sol.alt, pl, T };
  }
  const elongacion = (e, id) => {
    const p = e.pl[id]; // ley de cosenos: ángulo Sol-Tierra-planeta
    const c = (p.d * p.d + p.R * p.R - p.r * p.r) / (2 * p.d * p.R);
    return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  };

  // Todos los planetas para la noche que empieza el día local "fechaISO" (de 12:00 a 12:00 del día siguiente).
  function noche(fechaISO, lat, lon, offSeg) {
    const [y, m, d] = fechaISO.slice(0, 10).split("-").map(Number);
    const ini = Date.UTC(y, m - 1, d, 12) - offSeg * 1000;
    const acc = {};
    for (const p of LISTA) acc[p.id] = { id: p.id, nombre: p.nombre, color: p.color, desde: null, hasta: null, maxAlt: -90, maxMs: null, maxAz: 0, azDesde: 0, azHasta: 0, diaSobre: 0, elong: null, mag: null };
    for (let t = ini; t <= ini + 24 * 3600000; t += PASO_MS) {
      const e = estadoEn(t, lat, lon), oscuro = e.solAlt < SOL_MAX;
      for (const p of LISTA) {
        const x = e.pl[p.id], a = acc[p.id];
        if (a.elong === null) { a.elong = elongacion(e, p.id); }
        if (x.alt > ALT_MIN && oscuro) {
          if (a.desde === null) { a.desde = t; a.azDesde = x.az; }
          a.hasta = t; a.azHasta = x.az;
          if (x.alt > a.maxAlt) { a.maxAlt = x.alt; a.maxMs = t; a.maxAz = x.az; }
        } else if (x.alt > ALT_MIN) a.diaSobre++;
      }
    }
    const eMed = estadoEn(ini + 12 * 3600000, lat, lon);
    return LISTA.map(p => {
      const a = acc[p.id], x = eMed.pl[p.id];
      const lon_ = Math.atan2(x.g[1], x.g[0]), lat_ = Math.asin(x.g[2] / x.d);
      a.mag = magnitud(p.id, x.r, x.d, x.R, eMed.T, lon_, lat_);
      a.visible = a.desde !== null && a.hasta - a.desde >= 20 * 60000;
      if (!a.visible) a.motivo = a.elong < 15 ? "cerca-sol" : (a.diaSobre > 0 ? "solo-dia" : "bajo-horizonte");
      return a;
    });
  }
  const puntos = az => ["Norte", "Noreste", "Este", "Sudeste", "Sur", "Sudoeste", "Oeste", "Noroeste"][Math.floor(norm(az) / 45 + 0.5) % 8];
  return { noche, estadoEn, LISTA, puntos };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PLANETAS;
