"use strict";
// ============================================================
// VIAJES: cargás un destino y las fechas, y la app muestra el clima de esos días y qué llevar.
// Hasta 16 días: pronóstico. Más lejos: estimación con el clima de esos mismos días en años anteriores.
// ============================================================
const VIAJES_MAX = 8;
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtFecha = f => `${DIAS_CORTOS[diaSemanaDe(f)]} ${f.slice(8, 10)}/${f.slice(5, 7)}`;
const fmtRango = v => v.desde === v.hasta ? fmtFecha(v.desde) : `${fmtFecha(v.desde)} → ${fmtFecha(v.hasta)}`;
const verCacheViaje = () => leer("viajeCache") || {};

function leerViajes() {
  const hoy = hoyISO(), l = leer("viajes");
  const v = (Array.isArray(l) ? l : []).filter(x => x && x.id && isFinite(x.lat) && isFinite(x.lon) && diasEntre(x.desde, x.hasta).length
    && diasHastaViaje(x.hasta, hoy) >= -2); // los viajes terminados hace más de 2 días se quitan solos
  return v.sort((a, b) => a.desde.localeCompare(b.desde));
}
function guardarViajes(v) { guardar("viajes", v); }

// ---------- datos ----------
async function pedirJson(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function datosViaje(v, forzar) {
  const clave = `${v.id}|${v.desde}|${v.hasta}`, cache = verCacheViaje(), c = cache[clave];
  const hoy = hoyISO(), fechas = diasEntre(v.desde, v.hasta);
  const hayPron = fechas.some(f => diasHastaViaje(f, hoy) <= VIAJE_HORIZONTE - 1 && diasHastaViaje(f, hoy) >= 0);
  const ttl = hayPron ? 3 * 3600000 : 7 * 86400000;
  if (!forzar && c && Date.now() - c.ts < ttl) return { dias: c.dias, ts: c.ts };
  let pron = null; const tipicos = {};
  if (hayPron) {
    const p = new URLSearchParams({ latitude: v.lat, longitude: v.lon, timezone: "auto", forecast_days: String(VIAJE_HORIZONTE),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max" });
    pron = (await pedirJson(`${URL_CLIMA}?${p}${omClave}`)).daily;
  }
  const sinPron = fechas.filter(f => !(pron && (pron.time || []).includes(f)));
  if (sinPron.length) {
    // Las mismas fechas de los 3 años anteriores (el archivo histórico llega hasta unos días atrás)
    const rango = fechas, resp = await Promise.all([1, 2, 3].map(k => {
      const p = new URLSearchParams({ latitude: v.lat, longitude: v.lon, timezone: "auto", start_date: fechaAniosAntes(rango[0], k), end_date: fechaAniosAntes(rango[rango.length - 1], k),
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" });
      return pedirJson(`${omServidor("archive-api")}/v1/archive?${p}${omClave}`).then(j => j.daily, () => null);
    }));
    Object.assign(tipicos, tipicosDeArchivos(rango, resp));
  }
  const dias = armarDiasViaje(fechas, pron, tipicos);
  if (!dias.some(d => d.fuente)) throw new Error("sin datos");
  cache[clave] = { ts: Date.now(), dias };
  Object.keys(cache).forEach(k => { if (!leerViajes().some(x => k.startsWith(x.id + "|"))) delete cache[k]; });
  guardar("viajeCache", cache);
  return { dias, ts: Date.now() };
}

// ---------- pantallas ----------
function tarjetaViajes() {
  const v = leerViajes(), hoy = hoyISO();
  const filas = v.map(x => {
    const falta = diasHastaViaje(x.desde, hoy), fin = diasHastaViaje(x.hasta, hoy);
    const cuando = fin < 0 ? "terminó" : falta <= 0 ? "en curso" : falta === 1 ? "mañana" : `faltan ${falta} días`;
    return `<button class="ag-fila" data-viaje="${esc(x.id)}"><span class="ag-dia">✈️</span><span class="ag-txt">${esc(x.nombre)}<small>${esc(fmtRango(x))} · ${cuando}</small></span><span aria-hidden="true">›</span></button>`;
  }).join("");
  return `<section class="card"><h2>✈️ Viajes</h2>${v.length ? `<div class="agenda">${filas}</div>`
    : `<p class="sutil" style="margin:0 0 10px">¿Te vas de vacaciones? Cargá el destino y las fechas y te mostramos el clima y qué llevar.</p>`}
    ${v.length < VIAJES_MAX ? `<button class="btn sec chico" data-viaje-nuevo style="margin-top:10px">＋ Agregar viaje</button>` : ""}</section>`;
}

function abrirViajes() { // lista (desde Ajustes)
  const v = leerViajes();
  mostrarHoja2(`<h3>✈️ Mis viajes</h3>
    <div class="bloque">${v.length ? v.map(x => `<button class="fila-aj" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font:inherit;cursor:pointer" data-viaje="${esc(x.id)}"><div class="tx"><b>${esc(x.nombre)}</b><small>${esc(fmtRango(x))}</small></div><span aria-hidden="true">›</span></button>`).join("")
      : `<div class="fila-aj"><div class="tx"><small>Todavía no cargaste viajes.</small></div></div>`}</div>
    ${v.length < VIAJES_MAX ? `<button class="btn" data-viaje-nuevo>＋ Agregar viaje</button>` : ""}
    <button class="btn sec" id="vj-cerrar">Cerrar</button>`);
  $("#hoja2in").querySelector("#vj-cerrar").onclick = cerrarHoja2;
}

let seqViaje = 0;
function abrirNuevoViaje() {
  const hoy = hoyISO(); let lugar = null;
  mostrarHoja2(`<h3>✈️ Nuevo viaje</h3>
    <div class="sec-tit">Destino</div>
    <input type="search" id="vj-buscar" placeholder="Ciudad o lugar (ej. Bariloche, Río de Janeiro)" autocomplete="off">
    <div id="vj-res" class="resultados"></div>
    <div class="nota" id="vj-lugar"></div>
    <div class="sec-tit">Fechas</div>
    <div class="bloque">
      <div class="fila-aj"><div class="tx">Desde</div><input type="date" id="vj-desde" min="${hoy}" value="${sumarDias(hoy, 7)}"></div>
      <div class="fila-aj"><div class="tx">Hasta</div><input type="date" id="vj-hasta" min="${hoy}" value="${sumarDias(hoy, 14)}"></div>
    </div>
    <div class="nota" id="vj-nota">Hasta ${VIAJE_MAX_DIAS} días. Hasta 16 días antes del viaje ves el pronóstico; si falta más, te mostramos cómo suele ser el clima en esas fechas.</div>
    <button class="btn" id="vj-guardar">Guardar y ver el clima</button>
    <button class="btn sec" id="vj-cancelar">Cancelar</button>`);
  const h = $("#hoja2in"), nota = h.querySelector("#vj-nota"); let t = 0;
  h.querySelector("#vj-cancelar").onclick = cerrarHoja2;
  h.querySelector("#vj-buscar").addEventListener("input", e => {
    clearTimeout(t); const q = e.target.value.trim(); const res = h.querySelector("#vj-res");
    if (q.length < 2) { res.innerHTML = ""; return; }
    t = setTimeout(async () => {
      const mi = ++seqViaje;
      try {
        const p = new URLSearchParams({ name: q, count: "8", language: "es" });
        const r = (await pedirJson(`${URL_GEO}?${p}${omClave}`)).results || [];
        if (mi !== seqViaje) return;
        res.innerHTML = r.length ? r.map((x, i) => `<button type="button" data-i="${i}">${esc(x.name)}<small>${esc([x.admin1, x.country].filter(Boolean).join(", "))}</small></button>`).join("")
          : `<div class="estado" style="padding:12px">No se encontró ese lugar.</div>`;
        res.onclick = ev => {
          const b = ev.target.closest("button[data-i]"); if (!b) return; const x = r[+b.dataset.i];
          lugar = { nombre: [x.name, x.admin1 && x.admin1 !== x.name ? x.admin1 : null, x.country_code && x.country_code !== "AR" ? x.country : null].filter(Boolean).join(", "), lat: x.latitude, lon: x.longitude };
          h.querySelector("#vj-lugar").textContent = "📍 " + lugar.nombre; res.innerHTML = ""; h.querySelector("#vj-buscar").value = "";
        };
      } catch (err) { res.innerHTML = `<div class="estado" style="padding:12px">No se pudo buscar. Revisá tu conexión.</div>`; }
    }, 350);
  });
  h.querySelector("#vj-guardar").onclick = () => {
    const desde = h.querySelector("#vj-desde").value, hasta = h.querySelector("#vj-hasta").value, dias = diasEntre(desde, hasta);
    const error = !lugar ? "Elegí el destino de la lista de resultados." : !dias.length ? "Revisá las fechas: «Hasta» no puede ser antes que «Desde»."
      : diasHastaViaje(hasta, hoyISO()) < 0 ? "El viaje ya terminó: elegí fechas de hoy en adelante." : dias.length > VIAJE_MAX_DIAS ? `El viaje puede durar hasta ${VIAJE_MAX_DIAS} días.` : "";
    if (error) { nota.textContent = "⚠️ " + error; return; }
    const v = leerViajes(); const nuevo = { id: "v" + Date.now().toString(36), ...lugar, desde, hasta };
    v.push(nuevo); guardarViajes(v); render(); abrirViaje(nuevo.id);
  };
}

async function abrirViaje(id, forzar) {
  const v = leerViajes().find(x => x.id === id); if (!v) { cerrarHoja2(); return; }
  const cab = `<h3>✈️ ${esc(v.nombre)}</h3><div class="sutil">${esc(fmtRango(v))} · ${diasEntre(v.desde, v.hasta).length} día${diasEntre(v.desde, v.hasta).length > 1 ? "s" : ""}</div>`;
  mostrarHoja2(`${cab}<div class="estado" style="padding:24px">Buscando el clima…</div><button class="btn sec" id="vj-cerrar">Cerrar</button>`);
  $("#hoja2in").querySelector("#vj-cerrar").onclick = cerrarHoja2;
  let r;
  try { r = await datosViaje(v, forzar); }
  catch (e) {
    if (!$("#hoja2").hidden) mostrarHoja2(`${cab}<div class="estado" style="padding:18px">No se pudo traer el clima. Revisá tu conexión e intentá de nuevo.</div>
      <button class="btn" id="vj-reintentar">Reintentar</button><button class="btn sec" id="vj-borrar">Eliminar viaje</button><button class="btn sec" id="vj-cerrar">Cerrar</button>`);
    enlazarViaje(v); return;
  }
  const sum = resumenViaje(r.dias), cons = consejosViaje(r.dias), R = Math.round;
  const origen = sum.tipicos === 0 ? "Pronóstico" : sum.pron === 0 ? "Estimación según años anteriores" : "Pronóstico + estimación";
  const filas = r.dias.map(d => !d.fuente ? `<div class="ag-fila"><span class="ag-dia">${esc(fmtFecha(d.f))}</span><span class="ag-txt"><small>Sin datos</small></span></div>`
    : `<div class="vj-dia ${d.fuente}"><span class="vj-f">${esc(fmtFecha(d.f))}</span><span class="vj-e" title="${esc(describir(d.codigo))}">${icono(d.codigo, true)}</span>
      <span class="vj-t"><b>${R(d.max)}°</b> <small>${R(d.min)}°</small></span><span class="vj-l">🌧 ${R(d.prob)}%</span><span class="vj-o">${d.fuente === "pron" ? "pronóstico" : "típico"}</span></div>`).join("");
  mostrarHoja2(`${cab}
    <section class="card" style="box-shadow:none"><div style="font-size:15px">🌡️ <b>${R(sum.min)}° a ${R(sum.max)}°</b> · ☂️ lluvia probable ${sum.lluviosos} de ${sum.total} día${sum.total > 1 ? "s" : ""}</div>
    <div class="sutil" style="margin-top:4px">${origen}</div></section>
    <div class="sec-tit">🧳 Qué llevar</div><ul class="qh">${cons.map(x => `<li><span>${esc(x)}</span></li>`).join("")}</ul>
    <div class="sec-tit">Día por día</div><div class="vj-lista">${filas}</div>
    ${sum.tipicos ? `<div class="nota">“Típico” es el promedio de esos mismos días en los 3 años anteriores: sirve de guía, pero no es un pronóstico. Cuando falten 16 días o menos, se actualiza solo con el pronóstico.</div>` : `<div class="nota">Datos de Open-Meteo. El pronóstico puede cambiar: volvé a mirarlo cerca de la fecha.</div>`}
    <button class="btn sec" id="vj-reintentar">🔄 Actualizar</button><button class="btn sec" id="vj-borrar">Eliminar viaje</button><button class="btn sec" id="vj-cerrar">Cerrar</button>`);
  enlazarViaje(v);
}
function enlazarViaje(v) {
  const h = $("#hoja2in"), on = (id, f) => { const b = h.querySelector(id); if (b) b.onclick = f; };
  on("#vj-cerrar", cerrarHoja2); on("#vj-reintentar", () => abrirViaje(v.id, true));
  on("#vj-borrar", () => { if (!confirm("¿Eliminar este viaje?")) return; guardarViajes(leerViajes().filter(x => x.id !== v.id)); cerrarHoja2(); render(); });
}

document.addEventListener("click", e => {
  const a = e.target.closest("[data-viaje]"); if (a) { abrirViaje(a.dataset.viaje); return; }
  if (e.target.closest("[data-viaje-nuevo]")) { abrirNuevoViaje(); return; }
});
