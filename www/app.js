"use strict";
// ============================================================
// APP: estado, ubicación (GPS), pantallas. La lógica pura está en nucleo.js.
// ============================================================
const cap = window.Capacitor;
// Detección tolerante: según la versión de Capacitor, alguna de estas funciones puede faltar
const esNativa = !!(cap && ((cap.isNativePlatform && cap.isNativePlatform()) ||
  (cap.getPlatform && cap.getPlatform() === "android") || /; wv\)/.test(navigator.userAgent)));
function plugin(nombre) {
  if (!esNativa) return null;
  if (cap.registerPlugin) { try { return cap.registerPlugin(nombre); } catch (e) { /* se prueba otra vía */ } }
  if (cap.Plugins && cap.Plugins[nombre]) return cap.Plugins[nombre];
  if (cap.nativePromise) return new Proxy({}, { get: (_, m) => (m === "then" ? undefined : o => cap.nativePromise(nombre, m, o || {})) });
  return null;
}
function infoNativo() {
  const c = window.Capacitor;
  return `Capacitor: ${c ? "sí" : "no"} · plataforma: ${c && c.getPlatform ? c.getPlatform() : "?"} · isNative: ${c && c.isNativePlatform ? c.isNativePlatform() : "?"} · registerPlugin: ${c && c.registerPlugin ? "sí" : "no"} · nativePromise: ${c && c.nativePromise ? "sí" : "no"}\nNavegador: ${navigator.userAgent.slice(0, 120)}`;
}
const NATIVO = plugin("EstacionNativo");
window.EST_NATIVO = NATIVO;
const GEO = plugin("Geolocation");

const AJUSTES_BASE = {
  listo: false, gps: true,
  notif: { diario: { on: true, hora: "07:30" }, semanal: { on: true, dia: 0, hora: "20:00" } },
  alertas: { clima: true, sismos: true, inundaciones: true, sens: "moderada" },
  actividades: [], propias: [],
};
const clonar = o => JSON.parse(JSON.stringify(o));
function cargarAjustes() {
  const g = leer("ajustes") || {}, b = clonar(AJUSTES_BASE);
  return {
    listo: !!g.listo, gps: g.gps !== false,
    notif: { diario: { ...b.notif.diario, ...((g.notif || {}).diario || {}) }, semanal: { ...b.notif.semanal, ...((g.notif || {}).semanal || {}) } },
    alertas: { ...b.alertas, ...(g.alertas || {}) },
    // Actividades que eligió la persona (vacío = todavía no eligió: se muestran todas) y las que agregó ella misma
    actividades: (Array.isArray(g.actividades) ? g.actividades : []).filter(id => ACTIVIDADES.some(x => x.id === id)),
    propias: (Array.isArray(g.propias) ? g.propias : []).filter(p => p && typeof p.id === "string" && typeof p.nombre === "string" && ACTIVIDADES.some(x => x.id === p.base)).slice(0, 8),
  };
}
const estado = {
  ubic: leer("ubicacion"), datos: leer("ultimoClima"), ajustes: cargarAjustes(), tab: leer("tab") || "hoy",
  metrica: "temp", diaAbierto: 0, cargando: false, error: "", rot: 0, lineas: [], ultima: 0,
  gpsEstado: "", // "", "buscando", "sin-permiso"
  actDia: 1, planDia: 0, seqClima: 0, gpsFallo: false, actAbierta: null, avAbierto: null, avisos: { smn: null, sismos: null, cargando: false, error: "", ultima: 0 },
  rio: { cargando: false, ts: 0, lat: null, lon: null, eval: null, u: null, error: "" },
};

// ---------- aviso a la parte nativa (widget, alarmas y notificaciones) ----------
async function sincronizar() {
  if (!NATIVO) return;
  try {
    // El pronóstico que ya bajó la app (solo lo necesario) se comparte con el widget y los avisos
    const d = estado.datos;
    const clima = estado.ubic && d && d.current && d.daily ? { current: d.current, daily: d.daily } : undefined;
    const r = await NATIVO.sincronizar({
      ajustes: { notif: estado.ajustes.notif, alertas: estado.ajustes.alertas },
      ubicacion: estado.ubic ? { lat: estado.ubic.lat, lon: estado.ubic.lon, nombre: estado.ubic.nombre } : undefined,
      clima, climaTs: estado.ultima || 0,
      crecida: crecidaParaNativo(),
      omClave: OPEN_METEO_CLAVE || "",
    });
    estado.notifOk = !!(r && r.notificaciones);
  } catch (e) { /* sin nativo: no pasa nada */ }
}
// Umbrales de crecida del río cercano (si hay uno), para que los avisos en segundo plano puedan compararlos
function crecidaParaNativo() {
  const r = estado.rio, u = ubicOk() && r.u && r.u.ok && r.lat === estado.ubic.lat && r.lon === estado.ubic.lon ? r.u : null;
  return u ? { q2: u.q2, q5: u.q5, q20: u.q20 } : undefined;
}
const ubicOk = () => !!(estado.ubic && estado.ubic.lat != null);
function guardarAjustes() { guardar("ajustes", estado.ajustes); sincronizar(); }

// ---------- clima ----------
// El pronóstico no se vuelve a bajar si el guardado es del mismo lugar y tiene menos de 30 minutos
// (el modelo se actualiza cada hora): así se gastan muchas menos llamadas. "forzar" = botón de actualizar (mínimo 2 min).
const CLIMA_TTL_MS = 30 * 60000, CLIMA_MIN_MANUAL_MS = 2 * 60000;
async function pedirClima(forzar = false) {
  if (!estado.ubic) return;
  const m = leer("climaMeta");
  const edadMax = forzar === true ? CLIMA_MIN_MANUAL_MS : CLIMA_TTL_MS;
  if (estado.datos && m && m.ts && m.lat != null && distanciaKm(m.lat, m.lon, estado.ubic.lat, estado.ubic.lon) < 2 && Date.now() - m.ts < edadMax) {
    estado.ultima = m.ts; estado.error = ""; render(); cargarRio(); cargarAvisos();
    return;
  }
  const seq = ++estado.seqClima, { lat, lon } = estado.ubic; // si el lugar cambia mientras baja, se descarta la respuesta vieja
  estado.cargando = true; estado.error = ""; pintarCarga();
  const p = new URLSearchParams({ ...PARAMS, latitude: lat, longitude: lon });
  try {
    let r = await fetch(`${URL_CLIMA}?${p}${omClave}`);
    if (!r.ok) { p.delete("minutely_15"); r = await fetch(`${URL_CLIMA}?${p}${omClave}`); }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const datos = await r.json();
    if (seq !== estado.seqClima) return;
    estado.datos = datos; estado.ultima = Date.now();
    guardar("ultimoClima", estado.datos);
    guardar("climaMeta", { ts: estado.ultima, lat, lon });
    sincronizar();
    cargarRio();
    cargarAvisos();
  } catch (e) {
    if (seq !== estado.seqClima) return;
    estado.error = estado.datos ? "Sin conexión. Mostrando el último pronóstico guardado." : "No se pudo obtener el clima. Revisá tu conexión.";
  }
  estado.cargando = false; pintarCarga(); armarLineas(); render();
  cargarAvisos();
}
function pintarCarga() { $("#btnRefrescar").classList.toggle("girando", estado.cargando || estado.avisos.cargando); }

function armarLineas() {
  const d = estado.datos; if (!d || !d.current) { estado.lineas = []; return; }
  const a = d.current, di = d.daily || {};
  const ra = analizarRadarSatelite(d);
  estado.lineas = [
    `🌡️ Ahora ${Math.round(a.temperature_2m)}° · sensación ${Math.round(a.apparent_temperature)}°`,
    `🔺 Máxima de hoy ${Math.round(dato(di, "temperature_2m_max", 0))}°`,
    `🔻 Mínima de hoy ${Math.round(dato(di, "temperature_2m_min", 0))}°`,
    `🌧️ Lluvia: ${dato(di, "precipitation_probability_max", 0).toFixed(0)}% de probabilidad`,
    ra.resumen,
  ];
}

// ---------- ubicación por GPS ----------
// Cualquier espera externa (GPS, internet) tiene un límite propio: así la app nunca se queda "buscando" para siempre.
const conLimite = (prom, ms) => new Promise((ok, mal) => {
  const t = setTimeout(() => mal(new Error("tiempo agotado")), ms);
  Promise.resolve(prom).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); mal(e); });
});
// El permiso se pide aparte y sin reloj: antes el tiempo corría mientras la persona leía el cartel de Android y la búsqueda fallaba.
async function permisoUbicacion() {
  if (!GEO || !GEO.checkPermissions) return true;
  const ok = x => !!x && (x.location === "granted" || x.coarseLocation === "granted");
  try {
    if (ok(await conLimite(GEO.checkPermissions(), 4000))) return true;
    return ok(await GEO.requestPermissions({ permissions: ["location", "coarseLocation"] }));
  } catch (e) { return true; } // si no se puede consultar, se intenta igual
}
async function posicionActual() {
  const intento = (precisa, espera) => {
    const opts = { enableHighAccuracy: precisa, timeout: espera, maximumAge: precisa ? 30000 : 120000 }; // la ubicación guardada por Android no puede tener más de 2 min
    const pedido = GEO
      ? GEO.getCurrentPosition(opts)
      : new Promise((ok, mal) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, mal, opts) : mal(new Error("sin gps")));
    return conLimite(pedido, espera + 3000).then(p => ({ lat: p.coords.latitude, lon: p.coords.longitude }));
  };
  if (!(await permisoUbicacion())) throw new Error("sin permiso");
  // Primero la ubicación rápida (red / última conocida, 8 s); si no alcanza, el GPS preciso (15 s)
  try { return await intento(false, 8000); } catch (e) { return await intento(true, 15000); }
}
async function nombreDeLugar(lat, lon) {
  try {
    const p = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "es" });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(`${URL_REVERSA}?${p}`, { signal: ctl.signal });
      if (r.ok) { const n = nombreDesdeReversa(await r.json()); if (n) return n; }
    } finally { clearTimeout(t); }
  } catch (e) { /* se usa el nombre sin conexión */ }
  return nombreOffline(lat, lon);
}
// El nombre exacto del lugar se busca después, sin demorar el pronóstico
async function mejorarNombre(lat, lon) {
  const n = await nombreDeLugar(lat, lon);
  const u = estado.ubic;
  if (u && u.gps && u.lat === lat && u.lon === lon && n && n !== u.nombre) {
    u.nombre = n; guardar("ubicacion", u); pintarUbic(); sincronizar();
  }
}
// Si el GPS está activado, la ubicación sigue al usuario. Solo se actualiza si se movió más de 2 km.
const GPS_MOVIMIENTO_KM = 2;
const registrarGps = (ok, msg) => guardar("gpsLog", { ts: Date.now(), ok, msg: msg || "" });
let gpsEnCurso = 0, ultimoGps = 0;
async function seguirGPS(forzar = false) {
  if (!estado.ajustes.gps && !forzar) return false;
  if (Date.now() - gpsEnCurso < 40000) return false;                  // ya hay una búsqueda en marcha
  if (!forzar && Date.now() - ultimoGps < 120000) return false;       // no más de una búsqueda cada 2 minutos
  gpsEnCurso = Date.now();
  const teniaUbic = !!estado.ubic;
  estado.gpsEstado = "buscando"; pintarUbic();
  try {
    const pos = await posicionActual();
    ultimoGps = Date.now();
    const lat = +pos.lat.toFixed(4), lon = +pos.lon.toFixed(4);
    const dist = estado.ubic ? distanciaKm(estado.ubic.lat, estado.ubic.lon, lat, lon) : Infinity;
    const movio = !estado.ubic || !estado.ubic.gps || dist > GPS_MOVIMIENTO_KM;
    registrarGps(true, `a ${isFinite(dist) ? dist.toFixed(1) + " km de la ubicación guardada" : "primera ubicación"}`);
    estado.gpsEstado = ""; estado.gpsFallo = false;
    if (movio || forzar) {
      const mismoLugar = estado.ubic && dist < 1;
      estado.ubic = { nombre: mismoLugar ? estado.ubic.nombre : nombreOffline(lat, lon), lat, lon, gps: true };
      guardar("ubicacion", estado.ubic);
      estado.ajustes.gps = true; guardar("ajustes", estado.ajustes);
      if (movio) { estado.datos = null; guardar("ultimoClima", null); guardar("climaMeta", null); estado.avisos.smn = null; estado.avisos.sismos = null; }
      render(); sincronizar(); pedirClima();
      if (!mismoLugar) mejorarNombre(lat, lon);
      return true;
    }
    pintarUbic();
    return false;
  } catch (e) {
    registrarGps(false, (e && e.message) || String(e));
    // Si ya había una ubicación guardada se sigue usando, sin mostrar errores; solo falla "en serio" la primera vez
    if (teniaUbic && !forzar) { estado.gpsEstado = ""; estado.gpsFallo = true; } else estado.gpsEstado = "sin-permiso";
    pintarUbic();
    return false;
  } finally { gpsEnCurso = 0; }
}
function pintarUbic() {
  $("#nomUbic").textContent = estado.ubic ? estado.ubic.nombre : "Elegí una ciudad";
  const s = estado.gpsEstado === "buscando" ? "📍 Buscando tu ubicación…"
    : estado.ubic && estado.ubic.gps && estado.gpsFallo ? "📍 Última ubicación conocida (no se pudo actualizar)"
    : estado.gpsEstado === "sin-permiso" ? "📍 No se pudo obtener la ubicación (revisá el GPS y el permiso)"
    : estado.ubic && estado.ubic.gps ? "📍 Ubicación por GPS" + (() => { const g = leer("gpsLog"); return g && g.ok ? " · actualizada " + new Date(g.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""; })()
    : estado.ubic ? "Ubicación elegida a mano" : "Ubicación";
  $("#subUbic").textContent = s;
}

// ============================================================
// AJUSTES y CONFIGURACIÓN INICIAL
// ============================================================
const SENS_TXT = { todos: "Todos los cercanos (desde M4.5)", moderada: "Moderados", fuerte: "Solo los fuertes" };
const DIAS_SEM = ["Domingos", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados"];
function interruptor(id, on) { return `<span class="sw"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><i></i></span>`; }
function formularioAjustes() {
  const a = estado.ajustes, n = a.notif;
  return `
  <div class="sec-tit">Notificaciones del clima</div>
  <div class="bloque">
    <div class="fila-aj"><div class="tx"><b>Resumen diario</b><small>Cómo está hoy y mañana</small></div>${interruptor("aj-diario-on", n.diario.on)}</div>
    <div class="fila-aj"><div class="tx">A las</div><input type="time" id="aj-diario-hora" value="${n.diario.hora}"></div>
    <div class="fila-aj"><div class="tx"><b>Resumen de la semana</b><small>Cómo va a estar la semana</small></div>${interruptor("aj-sem-on", n.semanal.on)}</div>
    <div class="fila-aj"><div class="tx">El día</div><select id="aj-sem-dia">${DIAS_SEM.map((d, i) => `<option value="${i}" ${i === n.semanal.dia ? "selected" : ""}>${d}</option>`).join("")}</select></div>
    <div class="fila-aj"><div class="tx">A las</div><input type="time" id="aj-sem-hora" value="${n.semanal.hora}"></div>
  </div>
  <div class="sec-tit">Alertas</div>
  <div class="bloque">
    <div class="fila-aj"><div class="tx"><b>Alertas meteorológicas</b><small>Avisos amarillos, naranjas y rojos del SMN para tu ubicación, con qué hacer</small></div>${interruptor("aj-al-clima", a.alertas.clima)}</div>
    <div class="fila-aj"><div class="tx"><b>Crecida de ríos e inundaciones</b><small>Si hay un río grande cerca tuyo, te avisamos cuando se espera una crecida (estimación del modelo, no oficial)</small></div>${interruptor("aj-al-rios", a.alertas.inundaciones)}</div>
    <div class="fila-aj"><div class="tx"><b>Sismos y tsunami</b><small>Sismos cerca tuyo y posible tsunami si estás en la costa</small></div>${interruptor("aj-al-sismos", a.alertas.sismos)}</div>
    <div class="fila-aj"><div class="tx">Sismos a avisar<small>Recomendado: moderados, desde M5.0 a 300 km, M5.5 a 700 km y M6.5 a 800 km</small></div><select id="aj-sens">${Object.entries(SENS_TXT).map(([k, t]) => `<option value="${k}" ${k === a.alertas.sens ? "selected" : ""}>${t}</option>`).join("")}</select></div>
  </div>
  <div class="nota" id="aj-permiso"></div>`;
}
function enlazarFormulario(raiz) {
  const g = id => raiz.querySelector("#" + id);
  const cambio = () => {
    const a = estado.ajustes;
    a.notif.diario.on = g("aj-diario-on").checked; a.notif.diario.hora = g("aj-diario-hora").value || "07:30";
    a.notif.semanal.on = g("aj-sem-on").checked; a.notif.semanal.dia = +g("aj-sem-dia").value; a.notif.semanal.hora = g("aj-sem-hora").value || "20:00";
    a.alertas.clima = g("aj-al-clima").checked; a.alertas.sismos = g("aj-al-sismos").checked; a.alertas.inundaciones = g("aj-al-rios").checked; a.alertas.sens = g("aj-sens").value;
    guardarAjustes();
    if (a.notif.diario.on || a.notif.semanal.on || a.alertas.clima || a.alertas.sismos || a.alertas.inundaciones) pedirPermisoNotif(raiz);
    if (estado.avisos.ultima) { estado.avisos.ultima = 0; cargarAvisos(true); }
  };
  raiz.querySelectorAll('input[id^="aj-"], select[id^="aj-"]').forEach(el => el.addEventListener("change", cambio));
}
async function pedirPermisoNotif(raiz) {
  const nota = raiz.querySelector("#aj-permiso"); if (!nota || !NATIVO) return;
  try {
    const r = await NATIVO.pedirPermisoNotificaciones();
    nota.innerHTML = r && r.concedido ? "" : `⚠️ Las notificaciones están bloqueadas para esta app. <span class="enlace" role="link" tabindex="0" id="abrirNotif">Abrir los ajustes de Android</span> y activalas para recibir avisos.`;
    const b = nota.querySelector("#abrirNotif"); if (b) b.onclick = () => NATIVO.abrirAjustesNotificaciones().catch(() => {});
  } catch (e) {}
}
// ============================================================
// ACTIVIDADES PERSONALIZADAS
// ============================================================
const actPorId = id => ACTIVIDADES.find(a => a.id === id);
// Las actividades de la persona (las elegidas + las que agregó). Vacío = todavía no eligió.
function actividadesDelUsuario() {
  const a = estado.ajustes;
  const elegidas = ACTIVIDADES.filter(x => a.actividades.includes(x.id));
  const propias = a.propias.map(p => { const b = actPorId(p.base) || ACTIVIDADES[0]; return { ...b, id: p.id, base: b.id, nombre: p.nombre, emoji: p.emoji || b.emoji }; });
  return elegidas.concat(propias);
}
function selectorActividades(sel) {
  return `<div class="sel-act">${ACTIVIDADES.map(a => `<button type="button" class="chip" data-sel="${a.id}" aria-pressed="${sel.includes(a.id)}">${a.emoji} ${esc(a.nombre)}</button>`).join("")}</div>`;
}
// Devuelve una función que lee cuáles quedaron marcadas
function enlazarSelector(raiz) {
  raiz.querySelectorAll("[data-sel]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")));
  return () => [...raiz.querySelectorAll("[data-sel]")].filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.sel);
}
function bloqueOtras() {
  return `<div id="otras-lista"></div>
    <div class="bloque" style="padding:10px;display:flex;flex-direction:column;gap:8px">
      <input type="text" id="otra-nombre" maxlength="30" placeholder="Ej.: Natación, Crossfit, Trekking…" aria-label="Nombre de la actividad">
      <div style="display:flex;gap:8px">
        <input type="text" id="otra-emoji" maxlength="4" placeholder="🏊" aria-label="Emoji (opcional)" style="width:64px;text-align:center">
        <select id="otra-base" aria-label="Se parece a" style="flex:1">${ACTIVIDADES.map(a => `<option value="${a.id}">Se parece a: ${esc(a.nombre)}</option>`).join("")}</select>
      </div>
      <div class="nota">“Se parece a” define cómo se calcula el mejor horario (temperatura, viento, lluvia y más).</div>
      <button type="button" class="btn sec chico" id="otra-agregar">➕ Agregar mi actividad</button>
    </div>`;
}
function enlazarOtras(raiz) {
  const lista = raiz.querySelector("#otras-lista");
  const pintar = () => {
    lista.innerHTML = estado.ajustes.propias.map(p => `<div class="fila-aj"><div class="tx">${esc(p.emoji || actPorId(p.base).emoji)} ${esc(p.nombre)}<small>Se parece a ${esc(actPorId(p.base).nombre)}</small></div><button type="button" class="btn sec chico" data-quitar="${esc(p.id)}" style="width:auto">Quitar</button></div>`).join("");
    lista.querySelectorAll("[data-quitar]").forEach(b => b.onclick = () => {
      estado.ajustes.propias = estado.ajustes.propias.filter(p => p.id !== b.dataset.quitar);
      guardar("ajustes", estado.ajustes); pintar();
    });
  };
  raiz.querySelector("#otra-agregar").onclick = () => {
    const nombre = raiz.querySelector("#otra-nombre").value.trim().slice(0, 30);
    if (nombre.length < 2 || estado.ajustes.propias.length >= 8) return;
    const e = [...raiz.querySelector("#otra-emoji").value.trim()][0] || "";
    estado.ajustes.propias.push({ id: "p" + Date.now().toString(36), nombre, emoji: /\p{Extended_Pictographic}/u.test(e) ? e : "", base: raiz.querySelector("#otra-base").value });
    guardar("ajustes", estado.ajustes);
    raiz.querySelector("#otra-nombre").value = ""; raiz.querySelector("#otra-emoji").value = "";
    pintar();
  };
  pintar();
}
function abrirActividades(volver) {
  const a = estado.ajustes;
  mostrarHoja2(`<h3>Tus deportes y actividades</h3>
    <p class="sutil" style="margin:0">Tocá las que hacés: la solapa Actividades te va a mostrar solo esas, con el mejor horario y las precauciones. Si no elegís ninguna, se muestran todas.</p>
    ${selectorActividades(a.actividades)}
    <div class="sec-tit">¿Hacés otra cosa?</div>
    ${bloqueOtras()}
    <button class="btn" id="actGuardar">Guardar</button>`);
  const h = $("#hoja2in");
  const leerSel = enlazarSelector(h); enlazarOtras(h);
  h.querySelector("#actGuardar").onclick = () => {
    a.actividades = leerSel(); guardar("ajustes", a); estado.actAbierta = null; render();
    if (volver) volver(); else cerrarHoja2();
  };
}

// ============================================================
// SOL Y LUNA
// ============================================================
function tarjetaAstros(d, dia, conFases) {
  const f = (d.daily.time || [])[dia];
  if (!f || !estado.ubic) return "";
  const off = d.utc_offset_seconds != null ? d.utc_offset_seconds : -new Date().getTimezoneOffset() * 60;
  let a, prox = [];
  try {
    a = astrosDelDia(f, estado.ubic.lat, estado.ubic.lon, off);
    if (conFases) prox = proximasFases(Date.now(), off, estado.ubic.lat, 4);
  } catch (e) { return ""; }
  const h = m => m === null ? "—" : m;
  const luz = a.sol.luzMin === null ? "" : `<p class="sutil" style="margin:10px 0 0">☀️ Luz de día: ${Math.floor(a.sol.luzMin / 60)} h ${String(a.sol.luzMin % 60).padStart(2, "0")} min</p>`;
  const L = a.luna;
  const fases = prox.length ? `<div class="fases-prox" role="list" aria-label="Próximas fases de la Luna">${prox.map(p => `<div role="listitem"><span class="e">${p.emoji}</span><b>${esc(p.nombre)}</b><br>${p.fecha}</div>`).join("")}</div><p class="nota" style="margin:6px 0 0">Fechas aproximadas (hora local). La Luna se dibuja como se ve desde tu hemisferio.</p>` : "";
  return `<section class="card"><h2>☀️🌙 Sol y Luna <span>· ${esc(nombreDia(f, dia))}</span></h2>
    <div class="astro-grid">
      <div class="ai"><small>🌅 Sale el sol</small><b>${h(a.sol.sale)}</b></div>
      <div class="ai"><small>🌇 Se pone el sol</small><b>${h(a.sol.pone)}</b></div>
      <div class="ai"><small>🌙 Sale la luna</small><b>${h(L.sale)}</b></div>
      <div class="ai"><small>🌒 Se pone la luna</small><b>${h(L.pone)}</b></div>
    </div>${luz}
    <div class="luna-fase"><span class="e" aria-hidden="true">${L.emoji}</span><div><b>${esc(L.nombre)}</b><br><span class="sutil">${Math.round(L.iluminacion * 100)}% iluminada · día ${Math.floor(L.edad) + 1} del ciclo lunar</span></div></div>
    ${fases}</section>`;
}

function mostrarHoja2(html) { $("#hoja2in").innerHTML = html; $("#hoja2").hidden = false; $("#hoja2in").scrollTop = 0; }

function abrirAjustes() {
  const tema = leer("tema") || "auto";
  mostrarHoja2(`<h3>Ajustes</h3>
    <div class="sec-tit">Ubicación</div>
    <div class="bloque"><div class="fila-aj"><div class="tx"><b>Seguir mi ubicación (GPS)</b><small>La ubicación se actualiza sola cuando te movés</small></div>${interruptor("aj-gps", estado.ajustes.gps)}</div></div>
    <div class="sec-tit">Actividades</div>
    <button class="btn sec" id="btnMisAct">🏃 Mis deportes y actividades</button>
    ${formularioAjustes()}
    <div class="sec-tit">Widget</div>
    <button class="btn sec" id="btnWidget">➕ Agregar widget a la pantalla de inicio</button>
    <div class="nota" id="widgetNota">El widget muestra la temperatura actual, tu ubicación y los próximos 3 días.</div>
    <div class="sec-tit">Probar notificaciones</div>
    <div class="bloque" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px">
      <button class="btn sec chico" data-prueba="diario">Resumen diario</button><button class="btn sec chico" data-prueba="semanal">Resumen semanal</button>
      <button class="btn sec chico" data-prueba="alerta">Alerta del SMN</button><button class="btn sec chico" data-prueba="sismo">Aviso de sismo</button><button class="btn sec chico" data-prueba="inundacion">Aviso de crecida</button><button class="btn sec chico" data-prueba="rio">Revisar río ahora</button></div>
    <div class="nota" id="pruebaNota">Si la prueba no llega, tocá “Diagnóstico” para ver el motivo.</div>
    <button class="btn sec" id="btnDiag">🔍 Diagnóstico de avisos y widget</button>
    <div class="nota" id="diagNota" style="white-space:pre-line"></div>
    <div id="bloqueVideo"></div>
    <div class="sec-tit">Opiniones y errores</div>
    <div class="bloque"><div class="fila-aj"><div class="tx"><b>Recordarme dar mi opinión</b><small>Una tarjeta en Hoy, cada 5 veces que abrís la app</small></div>${interruptor("aj-opinion", !(leer("opinion") || {}).cerrada)}</div></div>
    <button class="btn sec" data-op="calificar">⭐ Calificar la app en Play Store</button>
    <button class="btn sec" data-op="error">🐞 Reportar un error</button>
    <button class="btn sec" data-op="sugerencia">💡 Enviar una sugerencia</button>
    <div class="nota">Se abre tu app de correo con el mensaje armado: lo revisás y lo enviás vos. No incluimos tu ubicación.</div>
    <div class="sec-tit">Apariencia</div>
    <div class="seg" id="segTema"><button data-tema="auto" aria-pressed="${tema === "auto"}">Automático</button><button data-tema="claro" aria-pressed="${tema === "claro"}">Claro</button><button data-tema="oscuro" aria-pressed="${tema === "oscuro"}">Oscuro</button></div>
    <p class="nota">Datos: pronóstico y ríos de Open-Meteo.com (licencia CC BY 4.0; ríos: modelo GloFAS de Copernicus/ECMWF), Servicio Meteorológico Nacional (alertas oficiales, CC BY 4.0), USGS (sismos) y BigDataCloud (nombre del lugar). Esta app no es un servicio oficial ni del gobierno; la información es orientativa. En una emergencia llamá al 911.
    <br><span class="enlace" role="link" tabindex="0" data-url="https://www.smn.gob.ar/alertas">Alertas oficiales del SMN</span>${POLITICA_URL ? `<br><span class="enlace" role="link" tabindex="0" data-url="${POLITICA_URL}">Política de privacidad</span>` : ""}</p>
    <p class="nota" style="text-align:center">Estación Meteorológica · versión ${APP_VERSION}</p>
    <button class="btn" id="btnCerrarAj">Listo</button>`);
  const h = $("#hoja2in");
  enlazarFormulario(h);
  h.querySelector("#aj-gps").addEventListener("change", e => {
    estado.ajustes.gps = e.target.checked; guardarAjustes();
    if (e.target.checked) seguirGPS(true); else { if (estado.ubic) { estado.ubic.gps = false; guardar("ubicacion", estado.ubic); pintarUbic(); } }
  });
  h.querySelector("#btnMisAct").onclick = () => abrirActividades(abrirAjustes);
  h.querySelector("#btnWidget").onclick = async () => {
    const nota = h.querySelector("#widgetNota");
    if (!NATIVO) { nota.textContent = "El widget está disponible en la app instalada en el teléfono."; return; }
    try {
      await sincronizar();
      const r = await NATIVO.fijarWidget();
      nota.textContent = r && r.solicitado ? "Confirmá en el cartel de Android para agregar el widget." : "Tu teléfono no permite agregarlo desde aquí: mantené presionada la pantalla de inicio, tocá Widgets y buscá “Estación”.";
    } catch (e) { nota.textContent = "No se pudo pedir el widget. Mantené presionada la pantalla de inicio y buscá “Estación” en Widgets."; }
  };
  h.querySelectorAll("[data-prueba]").forEach(b => b.onclick = async () => {
    if (!NATIVO) { b.textContent = "Solo en la app"; return; }
    const nota = h.querySelector("#pruebaNota");
    await sincronizar(); await pedirPermisoNotif(h);
    try {
      await NATIVO.probar({ tipo: b.dataset.prueba });
      nota.textContent = "Notificación enviada. Si no la ves, tocá “Diagnóstico”.";
    } catch (e) { nota.textContent = "No se pudo enviar: " + ((e && e.message) || e); }
  });
  h.querySelectorAll("[data-op]").forEach(b => b.onclick = () => accionOpinion(b.dataset.op));
  h.querySelector("#aj-opinion").addEventListener("change", e => {
    const o = leer("opinion") || {}; o.cerrada = !e.target.checked; o.pendiente = false; o.base = o.abiertas || 0; guardar("opinion", o); render();
  });
  h.querySelector("#btnDiag").onclick = async () => {
    const nota = h.querySelector("#diagNota");
    if (!NATIVO) { nota.textContent = "No se detecta la parte nativa de Android.\n" + infoNativo(); return; }
    nota.textContent = "Revisando…";
    try {
      await sincronizar();
      const r = await NATIVO.diagnostico();
      const ok = v => v ? "✅" : "❌";
      const cuando = ms => ms ? new Date(ms).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "nunca";
      nota.innerHTML = "";
      nota.textContent = [
        `${ok(r.notificaciones)} Notificaciones permitidas${r.canalesBloqueados ? " · canales silenciados: " + r.canalesBloqueados : ""}`,
        `${ok(!!r.ubicacion)} Ubicación guardada: ${r.ubicacion || "ninguna (abrí la app y elegí una)"}`,
        (() => { const g = leer("gpsLog"); return g ? `${g.ok ? "✅" : "❌"} Última búsqueda de GPS: ${cuando(g.ts)} · ${g.ok ? g.msg : "falló: " + g.msg}` : "ℹ️ GPS: todavía no se buscó la ubicación"; })(),
        `${ok(r.climaMs)} Último pronóstico guardado: ${cuando(r.climaMs)}`,
        `${r.widgets > 0 ? "✅" : "ℹ️"} Widgets en la pantalla de inicio: ${r.widgets}`,
        `Widget: ${r.widgetEstado}`,
        `${ok(r.sinAhorroBateria)} Sin ahorro de batería${r.sinAhorroBateria ? "" : " (puede demorar los avisos)"}`,
        `${ok(r.crecidaGuardada)} Umbrales de crecida del río cercano: ${r.crecidaGuardada ? "guardados" : "no hay (sin río importante a ~5 km, o abrí la solapa Avisos con internet)"}`,
        `Última revisión de ríos: ${cuando(r.rioMs)}${r.rioEstado ? " · " + r.rioEstado : ""}`,
        `Último resumen diario enviado: ${r.ultimoDiario || "ninguno"} · semanal: ${r.ultimoSemanal || "ninguno"}`,
        `Android ${r.android}`,
      ].join("\n");
      if (!r.sinAhorroBateria) {
        const b2 = document.createElement("span");
        b2.className = "enlace"; b2.setAttribute("role", "link"); b2.tabIndex = 0;
        b2.textContent = "\nAbrir ajustes de batería de Android";
        b2.onclick = () => NATIVO.abrirAjustesBateria().catch(() => {});
        nota.appendChild(b2);
      }
    } catch (e) { nota.textContent = "No se pudo hacer el diagnóstico: " + ((e && e.message) || e); }
  };
  // Video opcional (el usuario elige verlo a cambio de una pausa en los anuncios)
  if (window.ANUNCIOS && window.ANUNCIOS.videoDisponible()) {
    const bv = h.querySelector("#bloqueVideo");
    bv.innerHTML = `<div class="sec-tit">Anuncios</div><button class="btn sec" id="btnVideo">🎬 Ver un video y pausar los anuncios 30 min</button><div class="nota" id="videoNota"></div>`;
    bv.querySelector("#btnVideo").onclick = async () => {
      const n = bv.querySelector("#videoNota"); n.textContent = "Cargando video…";
      const r = await window.ANUNCIOS.videoPremio();
      n.textContent = r.ok ? "¡Gracias! Anuncios pausados por 30 minutos." : "No hay un video disponible ahora. Probá más tarde.";
    };
  }
  h.querySelector("#segTema").onclick = e => {
    const b = e.target.closest("[data-tema]"); if (!b) return;
    const t = b.dataset.tema; guardar("tema", t === "auto" ? null : t); aplicarTema(t === "auto" ? null : t);
    h.querySelectorAll("#segTema button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  };
  h.querySelector("#btnCerrarAj").onclick = cerrarHoja2;
  pedirPermisoNotif(h);
}

function abrirBienvenida() {
  mostrarHoja2(`<h3>¡Bienvenido! 👋</h3>
    <p class="sutil" style="margin:0">Configurá la app a tu gusto. Podés cambiar todo después desde ⚙️ Ajustes.</p>
    <div class="sec-tit">1. Tu ubicación</div>
    <button class="btn" id="bvGPS">📍 Usar mi ubicación (GPS)</button>
    <div class="nota" id="bvGpsNota">La app sigue tu ubicación y actualiza el clima, el widget y los avisos según dónde estés. Si preferís, elegí una localidad a mano.</div>
    <button class="btn sec" id="bvManual">Elegir una localidad</button>
    <div class="sec-tit">2. ¿Qué deporte o actividad hacés?</div>
    <p class="sutil" style="margin:0">Elegí todas las que quieras: te mostramos el mejor horario y las precauciones solo para eso. Si no elegís ninguna, vas a ver todas.</p>
    ${selectorActividades(estado.ajustes.actividades)}
    <div class="nota">¿Hacés otra? Agregala a tu manera:</div>
    ${bloqueOtras()}
    <div class="sec-tit">3. Notificaciones y alertas</div>
    ${formularioAjustes()}
    <button class="btn" id="bvListo">Empezar</button>`);
  const h = $("#hoja2in");
  const leerSel = enlazarSelector(h); enlazarOtras(h);
  enlazarFormulario(h);
  h.querySelector("#bvGPS").onclick = async () => {
    const nota = h.querySelector("#bvGpsNota"); nota.textContent = "Buscando tu ubicación…";
    const ok = await seguirGPS(true);
    nota.textContent = estado.gpsEstado === "sin-permiso" ? "No se pudo obtener la ubicación. Revisá que el GPS esté activado y que le diste permiso a la app, o elegí una localidad a mano." : `✅ Ubicación: ${estado.ubic.nombre}`;
  };
  h.querySelector("#bvManual").onclick = () => { abrirHoja(); };
  h.querySelector("#bvListo").onclick = () => {
    estado.ajustes.actividades = leerSel(); estado.ajustes.listo = true; guardarAjustes(); cerrarHoja2(); render();
    if (!estado.ubic) abrirHoja();
    pedirPermisoNotif({ querySelector: () => null });
  };
  pedirPermisoNotif(h);
}

// ============================================================
// PANTALLAS
// ============================================================
function vistaHoy(d) {
  const a = d.current, h = d.hourly, di = d.daily, i0 = indiceHoraActual(h, a);
  const [c1, c2] = gradiente(a.weather_code, a.is_day === 1);
  let horas = "";
  for (let k = 0; k < 12; k++) {
    const i = i0 + k; if (i >= (h.time || []).length) break;
    horas += `<div class="h"><small>${k === 0 ? "Ahora" : horaTxt(h.time[i])}</small><span class="e">${icono(dato(h, "weather_code", i), dato(h, "is_day", i, 1) === 1)}</span><b>${Math.round(dato(h, "temperature_2m", i))}°</b><small>🌧 ${dato(h, "precipitation_probability", i).toFixed(0)}%</small></div>`;
  }
  let prox = "";
  for (let i = 1; i <= 3; i++) {
    if (!(di.time || [])[i]) break;
    prox += `<div class="h" style="flex:1"><small>${nombreDia(di.time[i], i)}</small><span class="e">${icono(dato(di, "weather_code", i))}</span><b>${Math.round(dato(di, "temperature_2m_max", i))}° <small>${Math.round(dato(di, "temperature_2m_min", i))}°</small></b><small>🌧 ${dato(di, "precipitation_probability_max", i).toFixed(0)}%</small></div>`;
  }
  const uvAhora = dato(h, "uv_index", i0);
  return `
  <section class="hero" style="background:linear-gradient(145deg,${c1},${c2})">
    <div class="fila"><span class="ico">${icono(a.weather_code, a.is_day === 1)}</span><span class="temp">${Math.round(a.temperature_2m)}°</span></div>
    <div class="desc">${esc(describir(a.weather_code))}</div>
    <div class="meta">Sensación ${Math.round(a.apparent_temperature)}° · Máx ${Math.round(dato(di, "temperature_2m_max", 0))}° · Mín ${Math.round(dato(di, "temperature_2m_min", 0))}°</div>
    <div class="rota" id="rota" aria-live="polite">${esc(estado.lineas[estado.rot % estado.lineas.length] || "")}</div>
  </section>
  ${bannerAvisos()}
  ${tarjetaOpinion()}
  <section class="card"><h2>Próximas horas</h2><div class="tira">${horas}</div></section>
  <section class="card"><h2>Próximos 3 días</h2><div class="tira" style="gap:8px">${prox}</div></section>
  ${tarjetaAstros(d, 0, false)}
  <section class="card"><h2>Ahora mismo</h2><div class="grid">
    <div class="dato"><small>💧 Humedad</small><b>${Math.round(a.relative_humidity_2m)}%</b></div>
    <div class="dato"><small>💨 Viento</small><b>${Math.round(a.wind_speed_10m)} km/h</b></div>
    <div class="dato"><small>🧭 Dirección</small><b>${dirViento(a.wind_direction_10m)}</b></div>
    <div class="dato"><small>🌬️ Ráfagas</small><b>${Math.round(a.wind_gusts_10m)} km/h</b></div>
    <div class="dato"><small>🎚️ Presión</small><b>${Math.round(a.pressure_msl)} hPa</b></div>
    <div class="dato"><small>☁️ Nubes</small><b>${Math.round(a.cloud_cover)}%</b></div>
    <div class="dato"><small>☀️ UV ahora</small><b>${uvAhora.toFixed(1)}</b></div>
    <div class="dato"><small>☀️ UV máx.</small><b>${dato(di, "uv_index_max", 0).toFixed(1)}</b></div>
    <div class="dato"><small>💧 Lluvia</small><b>${(a.precipitation || 0).toFixed(1)} mm</b></div>
  </div></section>`;
}

const METRICAS = {
  temp: { nombre: "Temp.", clave: "temperature_2m", fmt: v => Math.round(v) + "°", max: 45, clase: "" },
  lluvia: { nombre: "Lluvia", clave: "precipitation_probability", fmt: v => Math.round(v) + "%", max: 100, clase: "lluvia" },
  viento: { nombre: "Viento", clave: "wind_speed_10m", fmt: v => Math.round(v) + " km/h", max: 80, clase: "viento" },
  uv: { nombre: "UV", clave: "uv_index", fmt: v => v.toFixed(1), max: 12, clase: "uv" },
};
function vistaHoras(d) {
  const h = d.hourly, i0 = indiceHoraActual(h, d.current), m = METRICAS[estado.metrica];
  let filas = "";
  for (let k = 0; k < 24; k++) {
    const i = i0 + k; if (i >= (h.time || []).length) break;
    const v = dato(h, m.clave, i), pct = Math.max(2, Math.min(100, (v / m.max) * 100));
    filas += `<div class="filah"><span class="hh">${horaTxt(h.time[i])}</span><span class="e">${icono(dato(h, "weather_code", i), dato(h, "is_day", i, 1) === 1)}</span>
      <div class="barra ${m.clase}"><i style="width:${pct}%${estado.metrica === "temp" ? `;background:${colorTemp(v)}` : ""}"></i></div><span class="val">${m.fmt(v)}</span></div>`;
  }
  const seg = Object.entries(METRICAS).map(([k, x]) => `<button data-metrica="${k}" aria-pressed="${k === estado.metrica}">${x.nombre}</button>`).join("");
  return `<div class="seg" role="group" aria-label="Dato a mostrar">${seg}</div><section class="card">${filas}</section>`;
}

function vistaDias(d) {
  const di = d.daily, h = d.hourly;
  return (di.time || []).map((f, i) => {
    const abierto = estado.diaAbierto === i, c = dato(di, "weather_code", i);
    let det = "";
    if (abierto) {
      const idx = (h.time || []).map((t, k) => t.startsWith(f) ? k : -1).filter(k => k >= 0);
      det = `<div class="det"><div style="color:var(--text2)">${esc(fechaLarga(f))} · ${esc(describir(c))}</div>
        <div class="grid">
          <div class="dato"><small>🌧 Prob.</small><b>${dato(di, "precipitation_probability_max", i).toFixed(0)}%</b></div>
          <div class="dato"><small>💧 Lluvia</small><b>${dato(di, "precipitation_sum", i).toFixed(1)} mm</b></div>
          <div class="dato"><small>💨 Viento</small><b>${dato(di, "wind_speed_10m_max", i).toFixed(0)} km/h</b></div>
          <div class="dato"><small>🌬️ Ráfagas</small><b>${dato(di, "wind_gusts_10m_max", i).toFixed(0)} km/h</b></div>
          <div class="dato"><small>☀️ UV</small><b>${dato(di, "uv_index_max", i).toFixed(1)}</b></div>
          <div class="dato"><small>Nivel UV</small><b>${nivelUV(dato(di, "uv_index_max", i))}</b></div>
        </div>
        <div class="tira">${idx.filter((_, n) => n % 2 === 0).map(k => `<div class="h"><small>${horaTxt(h.time[k])}</small><span class="e">${icono(dato(h, "weather_code", k), dato(h, "is_day", k, 1) === 1)}</span><b>${Math.round(dato(h, "temperature_2m", k))}°</b></div>`).join("")}</div></div>`;
    }
    return `<button class="dia" data-dia="${i}" aria-expanded="${abierto}"><div class="cab"><span class="e">${icono(c)}</span>
      <div><div class="nom">${nombreDia(f, i)}</div><div class="sub">${esc(describir(c))} · 🌧 ${dato(di, "precipitation_probability_max", i).toFixed(0)}%</div></div>
      <div class="mm">${Math.round(dato(di, "temperature_2m_max", i))}° <small>${Math.round(dato(di, "temperature_2m_min", i))}°</small></div></div>${det}</button>`;
  }).join("");
}

function vistaRadar(d) {
  const r = analizarRadarSatelite(d);
  const maxmm = Math.max(1, ...r.proximos.map(p => p[1]));
  const barras = r.proximos.map(([mn, mm]) => `<div><i style="height:${Math.max(3, mm / maxmm * 100)}%"></i><small>${mn === 0 ? "ya" : "+" + mn + "′"}</small></div>`).join("");
  const capa = (n, v) => `<div class="capa"><span>${n}</span><div class="barra"><i style="width:${Math.min(100, v)}%"></i></div><span>${v.toFixed(0)}%</span></div>`;
  return `
  <section class="card"><h2>📡 Radar <span>· precipitación estimada</span></h2>
    <p class="titulo-g">${esc(r.radarTitulo)}</p>
    <div class="mini-bars" role="img" aria-label="Precipitación en los próximos minutos">${barras}</div>
    <ul class="lineas">${r.radarLineas.map(l => `<li>${esc(l)}</li>`).join("")}</ul></section>
  <section class="card"><h2>🛰️ Satélite <span>· nubosidad</span></h2>
    <p class="titulo-g">${esc(r.satTitulo)}</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${capa("Bajas", r.capas.bajas)}${capa("Medias", r.capas.medias)}${capa("Altas", r.capas.altas)}</div>
    <ul class="lineas">${r.satLineas.map(l => `<li>${esc(l)}</li>`).join("")}</ul></section>
  <section class="card"><h2>Resumen</h2><div>${esc(r.resumen)}</div></section>
  <p class="pie">Lectura calculada con datos del modelo Open-Meteo, no son imágenes del SMN.</p>`;
}

// Se completan en los pasos siguientes
// ============================================================
// AVISOS: alertas oficiales del SMN, sismos, posible tsunami y crecida de ríos (estimada, aparte)
// ============================================================
const FUENTE_SMN = "Servicio Meteorológico Nacional (smn.gob.ar), licencia CC BY 4.0";
async function cargarRio(forzar = false) {
  const r = estado.rio;
  if (!estado.ubic || r.cargando) return;
  const { lat, lon } = estado.ubic;
  if (!forzar && r.ts && r.lat === lat && r.lon === lon && Date.now() - r.ts < 3 * 3600000) return;
  if (!forzar && !r.ts) { // al abrir la app: si hay una consulta guardada de hace menos de 3 h, se reutiliza
    const rc = leer("rioCache");
    if (rc && rc.lat === lat && rc.lon === lon && Date.now() - rc.ts < 3 * 3600000) { r.u = rc.u; r.eval = rc.eval; r.lat = lat; r.lon = lon; r.ts = rc.ts; sincronizar(); render(); return; }
  }
  r.cargando = true; r.error = "";
  try {
    // Las crecidas históricas de ese lugar se calculan una sola vez y quedan guardadas
    const clave = lat.toFixed(2) + "," + lon.toFixed(2);
    const cache = leer("crecida") || {};
    let u = cache[clave];
    if (!u) {
      const rh = await fetch(URL_CRECIDA_HIST(lat.toFixed(4), lon.toFixed(4)));
      if (!rh.ok) throw new Error("HTTP " + rh.status);
      u = umbralesCrecida((await rh.json()).daily || {});
      cache[clave] = u;
      const claves = Object.keys(cache); if (claves.length > 10) delete cache[claves[0]];
      guardar("crecida", cache);
    }
    let ev = null;
    if (u.ok) {
      const rp = await fetch(URL_CRECIDA_PRON(lat.toFixed(4), lon.toFixed(4)));
      if (!rp.ok) throw new Error("HTTP " + rp.status);
      const f = new Date(); const hoy = f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
      ev = evaluarCrecida(u, (await rp.json()).daily, hoy);
    }
    r.u = u; r.eval = ev; r.lat = lat; r.lon = lon; r.ts = Date.now();
    guardar("rioCache", { lat, lon, ts: r.ts, u, eval: ev });
    sincronizar();
  } catch (e) {
    r.error = "No se pudo consultar el caudal de los ríos ahora.";
  }
  r.cargando = false;
  render();
}

function seccionRio() {
  const r = estado.rio, out = [`<div class="sec-tit">Ríos e inundaciones</div>`];
  if (!r.ts) { out.push(r.error ? `<div class="aviso warn">${esc(r.error)} Reintentá en unos minutos.</div>` : `<div class="estado" style="padding:16px">Consultando ríos cercanos…</div>`); return out.join(""); }
  const e = r.eval, m3 = x => Math.round(x).toLocaleString("es-AR") + " m³/s";
  if (!e) {
    out.push(`<div class="aviso ok">✅ No se detecta un río importante a menos de unos 5 km de tu ubicación, por eso no hay alerta de crecida. Esto no cubre arroyos chicos ni anegamientos por lluvia intensa: ante lluvias fuertes seguí las alertas del SMN.</div>`);
  } else if (e.nivel === 0) {
    out.push(`<div class="aviso ok">✅ Caudal normal en el río cercano. En los próximos 7 días se espera hasta ${m3(e.pico)}; una crecida frecuente empieza en ${m3(e.q2)}.</div>`);
  } else {
    const cuerpo = `<div>Caudal estimado hoy: ${m3(e.actual)} · pico previsto: <b>${m3(e.pico)}</b> el ${esc(fechaLarga(e.diaPico))} (${e.tendencia}).</div>
      <div class="sutil">Referencias de este lugar: crecida frecuente (cada ~2 años) ${m3(e.q2)} · fuerte (cada ~5) ${m3(e.q5)} · extrema (cada ~20) ${m3(e.q20)}.</div>` +
      lista("Qué hacer", PRECAUCIONES_CRECIDA[e.nivel]) +
      `<div class="nota">Estimación del modelo GloFAS (Copernicus) vía Open-Meteo para el río más grande en unos 5 km. Puede no ser el río que tenés en mente. No reemplaza a las alertas del INA (ina.gob.ar) ni de Defensa Civil.</div>`;
    out.push(tarjetaAviso("rio", e.nivel, "🌊", "Crecida del río cercano", "Pico " + fechaLarga(e.diaPico), NIVELES[e.nivel].nombre, cuerpo));
  }
  if (r.error) out.push(`<div class="aviso warn">${esc(r.error)}</div>`);
  return out.join("");
}

async function cargarAvisos(forzar = false) {
  const av = estado.avisos;
  if (!estado.ubic || av.cargando) return;
  if (!forzar && av.ultima && Date.now() - av.ultima < 300000 && av.lat === estado.ubic.lat && av.lon === estado.ubic.lon) return;
  av.cargando = true; av.error = ""; pintarCarga();
  const { lat, lon } = estado.ubic;
  const tareas = [];
  // alertas oficiales: se leen desde la parte nativa (el SMN no permite pedirlas desde el navegador)
  if (NATIVO) tareas.push(NATIVO.alertasSmn({ lat, lon }).then(r => { av.smn = r; }).catch(() => { av.smn = { ok: false, alertas: [], error: "No se pudieron consultar las alertas oficiales." }; }));
  else av.smn = null;
  tareas.push((async () => {
    try {
      let g;
      if (NATIVO) g = JSON.parse((await NATIVO.sismos({ lat, lon, minMag: 4.5, dias: 3 })).json);
      else { const r = await fetch(urlSismos(lat, lon, Date.now() - 3 * 86400000)); if (!r.ok) throw new Error("HTTP " + r.status); g = await r.json(); }
      av.sismos = filtrarSismos(g, lat, lon, estado.ajustes.alertas.sens);
      av.sismosOk = true;
    } catch (e) { av.sismosOk = false; av.sismos = av.sismos || []; }
  })());
  await Promise.all(tareas);
  av.cargando = false; av.ultima = Date.now(); av.lat = lat; av.lon = lon;
  pintarCarga(); render();
}

// Todos los avisos en una lista, de más a menos grave
function avisosActivos() {
  const av = estado.avisos, r = { oficiales: [], estimadas: [], sismos: [], max: 0 };
  if (av.smn && av.smn.alertas) r.oficiales = av.smn.alertas.map(a => ({ ...a, n: NIVEL_SMN[a.nivel] || 1 }));
  r.estimadas = []; // las alertas meteorológicas son solo las oficiales del SMN
  const hace24 = Date.now() - 24 * 3600000;
  r.sismos = (av.sismos || []).filter(s => s.tiempo >= hace24 || s.tsunami);
  const nOf = r.oficiales.reduce((m, a) => Math.max(m, a.n), 0);
  const nEs = r.estimadas.reduce((m, a) => Math.max(m, a.nivel), 0);
  const nSi = r.sismos.reduce((m, s) => Math.max(m, s.tsunami ? 3 : s.nivel), 0);
  r.nRio = estado.rio && estado.rio.eval ? estado.rio.eval.nivel : 0;
  r.max = Math.max(nOf, nEs, nSi, r.nRio);
  r.maxOficial = Math.max(nOf, nSi);
  return r;
}
function bannerAvisos() {
  const r = avisosActivos();
  if (!r.max) return "";
  const n = NIVELES[r.max];
  const of = r.oficiales.find(a => a.n === r.max);
  const si = r.sismos.find(x => (x.tsunami ? 3 : x.nivel) === r.max);
  let texto;
  if (of) texto = `<b>Alerta ${esc(of.nivel)} del SMN</b> · ${esc(of.evento || of.titular)}`;
  else if (si) texto = si.tsunami ? `<b>Sismo M${si.mag.toFixed(1)} con posible tsunami</b> · ${esc(si.lugar)}` : `<b>Sismo M${si.mag.toFixed(1)} ${esc(si.hace)}</b> · ${esc(si.lugar)}`;
  else {
    const a = r.estimadas.find(x => x.nivel === r.max);
    if (a) texto = `<b>${FENOMENOS[a.fenomeno].emoji} ${esc(FENOMENOS[a.fenomeno].nombre)} (estimado)</b> · ${a.dia === 0 ? "hoy" : "mañana"}`;
    else texto = `<b>🌊 Posible crecida del río cercano (estimado)</b> · pico ${esc(fechaLarga(estado.rio.eval.diaPico))}`;
  }
  return `<button class="banner n${r.max}" data-tab-ir="avisos"><span class="e">${n.emoji}</span><span>${texto}<br><small style="opacity:.75">Tocá para ver qué hacer</small></span></button>`;
}
function pintarPuntoAviso() {
  const r = avisosActivos(), p = $("#puntoAviso");
  p.hidden = !r.max; p.className = "punto n" + r.max;
}

function tarjetaAviso(id, n, emoji, titulo, sub, etiqueta, cuerpo) {
  const abierto = estado.avAbierto === id;
  return `<button class="av n${n}" data-av="${esc(id)}" aria-expanded="${abierto}"><div class="cab"><span class="e">${emoji}</span>
    <div><div class="tit">${esc(titulo)}</div><div class="sub">${esc(sub)}</div></div><span class="nivel n${n}">${esc(etiqueta)}</span></div>${abierto ? `<div class="det">${cuerpo}</div>` : ""}</button>`;
}
const lista = (t, xs) => xs.length ? `<h4>${t}</h4><ul>${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

function vistaAvisos(d) {
  const av = estado.avisos, r = avisosActivos();
  const out = [];
  // --- oficiales ---
  out.push(`<div class="sec-tit">Alertas oficiales (SMN)</div>`);
  if (!NATIVO) out.push(`<div class="aviso info">Las alertas oficiales del SMN se muestran en la app instalada en el teléfono.</div>`);
  else if (!av.smn) out.push(`<div class="estado" style="padding:16px">Consultando alertas…</div>`);
  else if (!av.smn.ok) out.push(`<div class="aviso warn">No se pudieron consultar las alertas oficiales ahora. Reintentá en unos minutos o consultá smn.gob.ar/alertas.</div>`);
  else if (!r.oficiales.length) out.push(`<div class="aviso ok">✅ El SMN no tiene alertas vigentes para tu ubicación.${av.smn.pendientes ? " (Algunas alertas no se pudieron leer: reintentá en un momento.)" : ""}</div>`);
  else r.oficiales.forEach((a, i) => {
    const n = a.n, est = NIVELES[n], p = precaucionesSmn(a), f = FENOMENOS[p.fenomeno];
    const cuerpo = (a.descripcion ? `<div>${esc(a.descripcion)}</div>` : "") +
      (p.oficiales.length ? lista("Qué indica el SMN", p.oficiales) : "") + lista("Precauciones generales", p.generales) +
      `<div class="nota">Fuente: ${FUENTE_SMN}. Se actualiza al consultar.</div>`;
    out.push(tarjetaAviso("smn" + i, n, f ? f.emoji : "⚠️", a.evento || a.titular, vigenciaSmn(a), est.nombre, cuerpo));
  });
  // --- sismos y tsunami ---
  out.push(`<div class="sec-tit">Sismos y tsunami</div>`);
  const ss = av.sismos || [];
  if (av.sismosOk === false && !ss.length) out.push(`<div class="aviso warn">No se pudieron consultar los sismos ahora.</div>`);
  else if (!ss.length) out.push(`<div class="aviso ok">✅ No hubo sismos relevantes cerca de tu ubicación en los últimos 3 días.</div>`);
  ss.slice(0, 8).forEach((s, i) => {
    const n = s.tsunami ? 3 : Math.max(1, s.nivel);
    const cuerpo = `<div>Magnitud ${s.mag.toFixed(1)} · ${s.distKm} km de tu ubicación${s.profKm != null ? ` · profundidad ${s.profKm} km` : ""}.</div>` +
      (s.tsunami ? `<div><b>El USGS marca este sismo como capaz de generar tsunami.</b> Es solo un indicador, no confirma que haya uno. Ante dudas seguí las indicaciones de Defensa Civil y del Servicio de Hidrografía Naval.</div>` : "") +
      lista(s.tsunami ? "Si estás en la costa" : "Qué hacer ante un sismo", s.tsunami ? precauciones("tsunami") : precauciones("sismo")) +
      (s.url ? `<div class="nota"><span class="enlace" role="link" tabindex="0" data-url="${esc(s.url)}">Ver ficha del USGS</span></div>` : "");
    out.push(tarjetaAviso("sis" + i, n, s.tsunami ? "🌊" : "🌍", `Sismo M${s.mag.toFixed(1)} · ${s.lugar}`, `${s.hace} · a ${s.distKm} km`, s.tsunami ? "Posible tsunami" : NIVELES[n].nombre, cuerpo));
  });
  // --- ríos e inundaciones ---
  out.push(seccionRio());
  // --- movilidad ---
  const di = d.daily;
  const mov = [["🏍️", "Moto", condicionMoto(di)], ["🚗", "Auto", condicionAuto(di)], ["🚶", "Caminando", condicionCaminando(di)]]
    .map(([e, n, [nivel, t]]) => `<div class="mov"><span class="e">${e}</span><div class="${nivel}"><b>${n}</b><span style="color:var(--text)">${esc(t)}</span></div></div>`).join("");
  out.push(`<section class="card"><h2>Movilidad hoy</h2>${mov}</section>`);
  out.push(`<p class="nota">Información orientativa. Las alertas oficiales las emite el Servicio Meteorológico Nacional (${FUENTE_SMN}); los sismos provienen del USGS. Esta app no es un servicio oficial ni del gobierno. En una emergencia llamá al 911.</p>`);
  return out.join("");
}

function colorPuntaje(p) { return p >= 80 ? "var(--ok)" : p >= 60 ? "#0ea5e9" : p >= 40 ? "var(--n1)" : "var(--n3)"; }
// Alertas oficiales del SMN que cubren (aunque sea en parte) el día elegido
function alertasSmnDelDia(d, dia) {
  const f = (d.daily.time || [])[dia];
  if (!f) return [];
  const [y, m, dd] = f.split("-").map(Number);
  const ini = new Date(y, m - 1, dd).getTime(), fin = ini + 86400000;
  return avisosActivos().oficiales.filter(a => (a.desde || 0) < fin && (!a.hasta || a.hasta > ini)).sort((x, z) => z.n - x.n);
}
function actividadesUsuarioOTodas() {
  const m = actividadesDelUsuario();
  return { personalizada: m.length > 0, lista: m.length ? m : ACTIVIDADES };
}
function vistaActividades(d) {
  const dias = (d.daily.time || []).slice(0, 5);
  if (estado.actDia >= dias.length) estado.actDia = 0;
  const chips = dias.map((f, i) => `<button class="chip" data-actdia="${i}" aria-pressed="${i === estado.actDia}">${nombreDia(f, i)}</button>`).join("");
  const mias = actividadesUsuarioOTodas();
  const lista = actividadesDelDia(d, estado.actDia, mias.lista);
  const alsDia = alertasSmnDelDia(d, estado.actDia);
  const alDia = alsDia.length ? (() => {
    const a = alsDia[0], n = NIVELES[a.n], f = FENOMENOS[precaucionesSmn(a).fenomeno], mas = alsDia.length - 1;
    return `<div class="alerta-dia n${a.n}"><span>${n.emoji}</span><div><b>${f ? f.emoji : "⚠️"} Alerta ${esc(a.nivel)} del SMN: ${esc(a.evento || a.titular)}</b> · ${esc(vigenciaSmn(a))}.${mas ? ` Hay ${mas} alerta${mas > 1 ? "s" : ""} más en la solapa Avisos.` : ""} Revisá bien los horarios.</div></div>`;
  })() : "";
  const tarjetas = lista.map(r => {
    if (r.sinHorario) return `<div class="act"><div class="cab"><span class="e">${r.emoji}</span><div><div class="nom">${esc(r.nombre)}</div><div class="sub">Ya no quedan horas útiles hoy</div></div></div></div>`;
    const abierta = estado.actAbierta === r.id;
    const det = abierta ? `<div class="det"><div>🕒 Mejor momento: <span class="ventana">${r.ventana}</span></div>
      <div class="sutil">🌡️ ${Math.round(r.stats.tempMin)}° a ${Math.round(r.stats.tempMax)}° · 💨 viento ${Math.round(r.stats.viento)} km/h · 🌧 ${Math.round(r.stats.prob)}%</div>
      <b>Precauciones</b><ul>${r.precauciones.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<button class="act" data-act="${r.id}" aria-expanded="${abierta}"><div class="cab"><span class="e">${r.emoji}</span>
      <div><div class="nom">${esc(r.nombre)}</div><div class="sub">🕒 ${r.ventana}</div></div><span class="veredicto v-${r.veredicto.clase}">${r.veredicto.texto}</span></div>
      <div class="puntaje"><i style="width:${Math.max(4, r.puntaje)}%;background:${colorPuntaje(r.puntaje)}"></i></div>${det}</button>`;
  }).join("");
  const cab = `<div class="act-cab"><div><b>${mias.personalizada ? "Tus actividades" : "Todas las actividades"}</b><div class="sutil">${mias.personalizada ? "Solo las que elegiste" : "Elegí las tuyas para personalizar esta solapa"}</div></div><button class="btn ${mias.personalizada ? "sec " : ""}chico" data-editar-act>✏️ ${mias.personalizada ? "Personalizar" : "Elegir"}</button></div>`;
  return `<div class="chips" role="group" aria-label="Día">${chips}</div>
    ${cab}
    ${tarjetaAstros(d, estado.actDia, true)}
    <p class="sutil" style="margin:0">Qué tan bueno es el día para hacer actividades al aire libre en ${esc(estado.ubic.nombre)}. Tocá una para ver el mejor horario y las precauciones.</p>
    ${alDia}${tarjetas}
    <p class="pie">Es una estimación con el pronóstico del modelo Open-Meteo. Ante tormentas o alertas oficiales, no salgas.</p>`;
}

// ============================================================
// PLANETAS: qué planetas se ven (a simple vista) en tu ubicación, noche por noche
// ============================================================
const PLANETAS_DIAS = 14;
function planetasCalculados(off) {
  const u = estado.ubic, base = new Date(Date.now() + off * 1000 - 6 * 3600000); // antes de las 6 am todavía es "esta noche"
  const clave = [u.lat.toFixed(2), u.lon.toFixed(2), off, base.toISOString().slice(0, 10)].join("|");
  if (estado._pl && estado._pl.clave === clave) return estado._pl;
  const dias = [];
  for (let i = 0; i < PLANETAS_DIAS; i++) {
    const f = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const iso = f.toISOString().slice(0, 10);
    dias.push({ iso, f, planetas: PLANETAS.noche(iso, u.lat, u.lon, off) });
  }
  return (estado._pl = { clave, dias });
}
function vistaPlanetas(d) {
  const off = d.utc_offset_seconds != null ? d.utc_offset_seconds : -new Date().getTimezoneOffset() * 60;
  let pl;
  try { pl = planetasCalculados(off); } catch (e) { return `<div class="estado">No se pudieron calcular los planetas.</div>`; }
  if (estado.planDia >= pl.dias.length) estado.planDia = 0;
  const sel = pl.dias[estado.planDia], hh = ms => hhmm(ms, off);
  const nombreFecha = (dia, i) => i === 0 ? "esta noche" : i === 1 ? "mañana a la noche" : `la noche del ${DIAS[dia.f.getUTCDay()].toLowerCase()} ${dia.f.getUTCDate()}/${dia.f.getUTCMonth() + 1}`;
  const brillo = m => m <= -3 ? "muy brillante" : m <= 0 ? "brillante" : m <= 1.2 ? "se ve bien" : "tenue";
  const altura = a => a < 20 ? "bajo, cerca del horizonte" : a < 45 ? "a media altura" : "bien alto";
  const tarjetas = PLANETAS.LISTA.map((p, k) => {
    const x = sel.planetas[k];
    let estadoTxt;
    if (x.visible) {
      estadoTxt = `<span class="pl-si">✅ Se ve</span> de ${hh(x.desde)} a ${hh(x.hasta)}<br><span class="sutil">Mejor momento: ${hh(x.maxMs)}, hacia el ${PLANETAS.puntos(x.maxAz)}, ${altura(x.maxAlt)} · ${brillo(x.mag)}</span>`;
    } else {
      const m = { "cerca-sol": "Muy cerca del Sol: el resplandor no deja verlo", "solo-dia": "Solo está sobre el horizonte de día", "bajo-horizonte": "No sale por encima del horizonte de noche" }[x.motivo];
      estadoTxt = `<span class="pl-no">No se ve ${nombreFecha(sel, estado.planDia)}</span><br><span class="sutil">${m}</span>`;
    }
    const prox = pl.dias.findIndex((z, i) => i > estado.planDia && z.planetas[k].visible);
    const proxTxt = !x.visible ? `<p class="sutil" style="margin:8px 0 0">${prox >= 0 ? `Próxima vez que se ve: <b>${DIAS[pl.dias[prox].f.getUTCDay()].toLowerCase()} ${pl.dias[prox].f.getUTCDate()}/${pl.dias[prox].f.getUTCMonth() + 1}</b>` : "No se ve en los próximos 14 días"}</p>` : "";
    const tira = pl.dias.map((z, i) => `<button class="${z.planetas[k].visible ? "v" : ""}" data-pldia="${i}" aria-pressed="${i === estado.planDia}" aria-label="${DIAS[z.f.getUTCDay()]} ${z.f.getUTCDate()}: ${z.planetas[k].visible ? "se ve" : "no se ve"}">${DIAS[z.f.getUTCDay()][0]}<br>${z.f.getUTCDate()}<i></i></button>`).join("");
    return `<section class="card"><div class="pl-fila"><span class="pl-bola" style="background:radial-gradient(circle at 35% 30%, #fff8, ${p.color} 45%, ${p.color})"></span><div><b>${p.nombre}</b><div class="pl-estado">${estadoTxt}</div></div></div>${proxTxt}<div class="pl-tira" role="group" aria-label="Próximos ${PLANETAS_DIAS} días de ${p.nombre}">${tira}</div></section>`;
  }).join("");
  return `<section class="card"><h2>🔭 Planetas <span>· ${esc(estado.ubic.nombre)}</span></h2>
    <p class="sutil" style="margin:0">Cuándo se ven a simple vista desde tu ubicación, ${nombreFecha(sel, estado.planDia)}. Tocá un día para ver los demás.</p>
    <p class="pl-leyenda"><i></i> día en que se ve</p></section>${tarjetas}
    <p class="nota">Se calcula en tu teléfono, sin internet. Un planeta cuenta como visible si está a más de 5° sobre el horizonte con el cielo oscuro; las nubes y las luces de la ciudad pueden impedir verlo. Los horarios pueden diferir unos minutos.</p>`;
}
const VISTAS = { hoy: vistaHoy, horas: vistaHoras, dias: vistaDias, radar: vistaRadar, activ: vistaActividades, avisos: vistaAvisos, planetas: vistaPlanetas };

function render() {
  pintarUbic();
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === estado.tab)));
  const v = $("#vista");
  if (!estado.ubic) {
    v.innerHTML = `<div class="estado"><div class="grande">🌤️</div><p><b>Estación Meteorológica</b><br>Activá el GPS o elegí una localidad para ver el pronóstico.</p><button class="btn" id="btnElegir">Buscar ubicación</button></div>`;
    $("#btnElegir").onclick = abrirHoja; return;
  }
  if (!estado.datos) {
    v.innerHTML = estado.error ? `<div class="estado"><div class="grande">📡</div><p>${esc(estado.error)}</p><button class="btn" id="btnReint">Reintentar</button></div>` : `<div class="estado">Cargando clima…</div>`;
    const b = $("#btnReint"); if (b) b.onclick = () => pedirClima(true); return;
  }
  const aviso = estado.error ? `<div class="aviso warn">${esc(estado.error)}</div>` : "";
  const scroll = v.scrollTop;
  v.innerHTML = aviso + VISTAS[estado.tab](estado.datos) + `<p class="pie">Actualizado ${estado.ultima ? new Date(estado.ultima).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "(datos guardados)"} · v${APP_VERSION}</p>`;
  v.scrollTop = scroll;
  pintarPuntoAviso();
  document.title = estado.datos.current ? `${Math.round(estado.datos.current.temperature_2m)}° ${estado.ubic.nombre}` : "Estación Meteorológica";
}

// ============================================================
// INTERACCIÓN
// ============================================================
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  estado.tab = b.dataset.tab; guardar("tab", estado.tab); render(); $("#vista").scrollTop = 0;
  if (estado.tab === "avisos") { cargarAvisos(); cargarRio(); }
  if (estado.tab === "activ") cargarAvisos();
  if (window.ANUNCIOS) window.ANUNCIOS.transicion();
});
$("#vista").addEventListener("click", e => {
  if (e.target.closest("[data-editar-act]")) { abrirActividades(); return; }
  const m = e.target.closest("[data-metrica]"); if (m) { estado.metrica = m.dataset.metrica; render(); return; }
  const ir = e.target.closest("[data-tab-ir]"); if (ir) { estado.tab = ir.dataset.tabIr; guardar("tab", estado.tab); render(); $("#vista").scrollTop = 0; cargarAvisos(); return; }
  const op = e.target.closest("[data-op]"); if (op) { accionOpinion(op.dataset.op); return; }
  const ur = e.target.closest("[data-url]"); if (ur) { abrirEnlace(ur.dataset.url); return; }
  const aa = e.target.closest("[data-av]"); if (aa) { estado.avAbierto = estado.avAbierto === aa.dataset.av ? null : aa.dataset.av; render(); return; }
  const pd = e.target.closest("[data-pldia]"); if (pd) { estado.planDia = +pd.dataset.pldia; render(); return; }
  const ad = e.target.closest("[data-actdia]"); if (ad) { estado.actDia = +ad.dataset.actdia; estado.actAbierta = null; render(); return; }
  const ac = e.target.closest("[data-act]"); if (ac) { estado.actAbierta = estado.actAbierta === ac.dataset.act ? null : ac.dataset.act; render(); return; }
  const d = e.target.closest("[data-dia]"); if (d) { const i = +d.dataset.dia; estado.diaAbierto = estado.diaAbierto === i ? -1 : i; render(); }
});
$("#btnRefrescar").onclick = () => { if (estado.ubic && estado.ubic.gps) seguirGPS(true); pedirClima(true); };
$("#btnAjustes").onclick = () => abrirAjustes();

function abrirEnlace(url) {
  if (!/^(https:\/\/|mailto:)/.test(url)) return;
  const sinCorreo = () => { if (/^mailto:/.test(url)) alert("No se encontró una app de correo. Escribinos a " + CONTACTO_EMAIL); };
  if (NATIVO) NATIVO.abrirUrl({ url }).catch(sinCorreo); else window.open(url, "_blank", "noopener");
}

// ============================================================
// OPINIONES Y ERRORES: calificar en Play Store, avisar de un problema o mandar una sugerencia (por correo)
// ============================================================
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PLAY_ID}`;
// Cada 5 aperturas aparece la tarjeta en "Hoy". Si la ignora, se vuelve a preguntar 5 aperturas después.
(function contarAperturas() {
  const o = leer("opinion") || {};
  o.abiertas = (o.abiertas || 0) + 1;
  if (o.pendiente) { o.pendiente = false; o.base = o.abiertas; }            // no contestó: se pospone
  else if (!o.cerrada && o.abiertas - (o.base || 0) >= 5) o.pendiente = true; // toca preguntar en esta apertura
  guardar("opinion", o);
})();
function escribirComentario(tipo) {
  const ua = (navigator.userAgent.match(/Android [^;)]+; [^;)]+/) || [navigator.userAgent.slice(0, 80)])[0];
  const asunto = `${tipo === "error" ? "Error" : "Sugerencia"} - Estación Meteorológica v${APP_VERSION}`;
  const cuerpo = `${tipo === "error" ? "Contanos qué pasó y qué estabas haciendo (si podés, adjuntá una captura):" : "Contanos tu idea o comentario:"}\n\n\n\n` +
    `--- Datos técnicos (podés borrarlos) ---\nApp: v${APP_VERSION}\nTeléfono: ${ua}\nPantalla: ${estado.tab}\n` +
    `${estado.error ? "Aviso en pantalla: " + estado.error + "\n" : ""}(No incluimos tu ubicación.)`;
  abrirEnlace(`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`);
}
function accionOpinion(op) {
  const o = leer("opinion") || {};
  if (op === "calificar") { abrirEnlace(PLAY_URL); o.cerrada = true; }
  else if (op === "error" || op === "sugerencia") { escribirComentario(op); o.cerrada = true; }
  else if (op === "nunca") o.cerrada = true;
  // "Ahora no" (y cualquier respuesta): la próxima pregunta, si corresponde, es 5 aperturas después
  o.pendiente = false; o.base = o.abiertas || 0;
  guardar("opinion", o); render();
}
// Tarjeta en "Hoy": aparece cada 5 aperturas (si no se cerró para siempre); se puede apagar o volver a prender en Ajustes
function tarjetaOpinion() {
  const o = leer("opinion") || {};
  if (o.cerrada || !o.pendiente) return "";
  return `<section class="card"><h2>¿Cómo te va con la app?</h2>
    <p class="sutil" style="margin:0 0 10px">Tu opinión nos ayuda a mejorarla.</p>
    <div style="display:grid;gap:8px">
      <button class="btn" data-op="calificar">👍 Me gusta: calificarla en Play Store</button>
      <button class="btn sec" data-op="error">😕 Tengo un problema o una sugerencia</button>
      <div style="display:flex;gap:8px"><button class="btn sec chico" data-op="luego" style="flex:1">Ahora no</button><button class="btn sec chico" data-op="nunca" style="flex:1">No preguntar más</button></div>
    </div></section>`;
}
function aplicarTema(t) {
  if (t === "claro" || t === "oscuro") document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
  const oscuro = t ? t === "oscuro" : matchMedia("(prefers-color-scheme: dark)").matches;
  $('meta[name="theme-color"]').content = oscuro ? "#0b1220" : "#eef2f7";
}

// --- búsqueda de ubicación a mano ---
let tBusca = 0, seqBusca = 0;
function abrirHoja() { $("#hoja").hidden = false; $("#buscar").value = ""; $("#resultados").innerHTML = ""; setTimeout(() => $("#buscar").focus(), 50); }
function cerrarHoja() { $("#hoja").hidden = true; }
$("#btnUbic").onclick = abrirHoja;
$("#btnCerrarHoja").onclick = cerrarHoja;
$("#hoja").addEventListener("click", e => { if (e.target.id === "hoja") cerrarHoja(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarHoja(); cerrarHoja2(); } });
function cerrarHoja2() { $("#hoja2").hidden = true; if (window.ANUNCIOS) setTimeout(window.ANUNCIOS.transicion, 400); }

function elegir(ubic) {
  estado.ubic = ubic; estado.datos = null; estado.avisos.smn = null; estado.avisos.sismos = null;
  guardar("ubicacion", ubic); guardar("ultimoClima", null);
  if (!ubic.gps) { estado.ajustes.gps = false; guardar("ajustes", estado.ajustes); }
  cerrarHoja(); render(); sincronizar(); pedirClima();
}
const cacheBusqueda = {};
$("#buscar").addEventListener("input", e => {
  clearTimeout(tBusca); const q = e.target.value.trim();
  if (q.length < 2) { $("#resultados").innerHTML = ""; return; }
  tBusca = setTimeout(async () => {
    const mi = ++seqBusca;
    try {
      const p = new URLSearchParams({ name: q, count: "10", language: "es", countryCode: "AR" });
      const r = cacheBusqueda[q] || (cacheBusqueda[q] = await (await fetch(`${URL_GEO}?${p}${omClave}`)).json());
      if (mi !== seqBusca) return;
      const res = r.results || [];
      $("#resultados").innerHTML = res.length ? res.map((x, i) => `<button data-i="${i}">${esc(x.name)}<small>${esc([x.admin2, x.admin1].filter(Boolean).join(", "))}</small></button>`).join("") : `<div class="estado" style="padding:16px">Sin resultados</div>`;
      $("#resultados").onclick = ev => {
        const b = ev.target.closest("button[data-i]"); if (!b) return;
        const x = res[+b.dataset.i];
        elegir({ nombre: [x.name, x.admin1].filter((v, k, a) => v && a.indexOf(v) === k).join(", "), lat: x.latitude, lon: x.longitude, gps: false });
      };
    } catch (err) { $("#resultados").innerHTML = `<div class="estado" style="padding:16px">No se pudo buscar. Revisá tu conexión.</div>`; }
  }, 350);
});
$("#btnGPS").onclick = async () => {
  $("#resultados").innerHTML = `<div class="estado" style="padding:16px">Buscando tu ubicación…</div>`;
  const ok = await seguirGPS(true);
  if (estado.gpsEstado === "sin-permiso") $("#resultados").innerHTML = `<div class="estado" style="padding:16px">No se pudo obtener la ubicación. Revisá que el GPS esté activado y que la app tenga permiso de ubicación.</div>`;
  else { cerrarHoja(); }
};

// --- línea rotativa ---
setInterval(() => {
  if (!estado.lineas.length || estado.tab !== "hoy") return;
  estado.rot = (estado.rot + 1) % estado.lineas.length;
  const el = $("#rota"); if (!el) return;
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = estado.lineas[estado.rot]; el.style.opacity = 1; }, 250);
}, 6000);
// con la app abierta (por ejemplo en un viaje) se revisa el GPS cada 5 minutos
setInterval(() => { if (!document.hidden && estado.ubic && estado.ajustes.gps) seguirGPS(); }, 5 * 60000);
// al volver a la app: seguir el GPS y refrescar el pronóstico si el guardado ya es viejo
const alVolverALaApp = () => {
  if (!estado.ubic) return;
  if (estado.ajustes.gps) seguirGPS();
  pedirClima(); // usa el pronóstico guardado si tiene menos de 30 minutos
};
document.addEventListener("visibilitychange", () => { if (!document.hidden) alVolverALaApp(); });
// En Android, al volver a la app el sistema avisa con este evento propio (visibilitychange no siempre se dispara en el WebView)
document.addEventListener("resume", alVolverALaApp);

// Los anuncios de pantalla completa nunca tapan un aviso importante (alerta naranja/roja, sismo fuerte o tsunami)
window.ANUNCIOS_PERMITIR_PANTALLA_COMPLETA = () => {
  try { return avisosActivos().max < 2 && $("#hoja").hidden && $("#hoja2").hidden; } catch (e) { return false; }
};

// ============================================================
// ARRANQUE
// ============================================================
aplicarTema(leer("tema"));
if (estado.datos) { const m = leer("climaMeta"); estado.ultima = (m && m.ts) || 0; armarLineas(); }
render();
if (estado.ubic) pedirClima();
if (estado.ajustes.gps && estado.ajustes.listo) seguirGPS();
sincronizar();
if (!estado.ajustes.listo) { setTimeout(abrirBienvenida, 300); }
if ("serviceWorker" in navigator && location.protocol !== "file:" && !esNativa) navigator.serviceWorker.register("sw.js").catch(() => {});
