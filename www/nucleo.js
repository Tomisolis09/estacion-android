"use strict";
// ============================================================
// NÚCLEO: constantes, utilidades y lógica pura (sin interfaz).
// Se usa en la app y se prueba en Node (ver tests/).
// ============================================================
// LICENCIA COMERCIAL DE OPEN-METEO
// El servicio gratuito es solo para uso NO comercial (una app con anuncios es comercial). Al contratar el plan de
// open-meteo.com/en/pricing te dan una clave: pegala entre las comillas y la app pasa sola al servidor de clientes
// (customer-api.open-meteo.com), tanto en el pronóstico como en el widget, los avisos y los ríos.
// Dejala vacía mientras no tengas plan.
const OPEN_METEO_CLAVE = "";
// URL pública de tu política de privacidad (la misma que cargás en Play Console). Si está vacía, no se muestra el enlace.
const POLITICA_URL = "";
const CONTACTO_EMAIL = "tomisolisrider09@gmail.com"; // correo al que llegan los comentarios y reportes de errores
const PLAY_ID = "com.tomisolis.estacionmeteorologica"; // mismo appId que capacitor.config.json
const APP_VERSION = "4.11"; // número que se ve al pie de cada pantalla (sirve para saber qué APK tenés instalado)
const omServidor = sub => `https://${OPEN_METEO_CLAVE ? "customer-" : ""}${sub}.open-meteo.com`;
const omClave = OPEN_METEO_CLAVE ? `&apikey=${encodeURIComponent(OPEN_METEO_CLAVE)}` : "";
const URL_CLIMA = omServidor("api") + "/v1/forecast";
const URL_GEO = omServidor("geocoding-api") + "/v1/search";
const URL_SISMOS = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const URL_REVERSA = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const PARAMS = {
  current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,cape,wind_speed_10m,wind_gusts_10m,uv_index",
  daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max",
  minutely_15: "precipitation", timezone: "auto", forecast_days: "7",
};
const DESCRIPCIONES = {0:"Despejado",1:"Mayormente despejado",2:"Parcialmente nublado",3:"Nublado",45:"Niebla",48:"Niebla con escarcha",51:"Llovizna débil",53:"Llovizna",55:"Llovizna intensa",56:"Llovizna helada",57:"Llovizna helada intensa",61:"Lluvia débil",63:"Lluvia",65:"Lluvia fuerte",66:"Lluvia helada",67:"Lluvia helada fuerte",71:"Nevada débil",73:"Nevada",75:"Nevada fuerte",77:"Granizo fino",80:"Chubascos débiles",81:"Chubascos",82:"Chubascos violentos",85:"Chubascos de nieve",86:"Chubascos de nieve fuertes",95:"Tormenta",96:"Tormenta con granizo",99:"Tormenta con granizo fuerte"};
const ICONOS = {2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",56:"🌧️",57:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",66:"🌧️",67:"🌧️",71:"🌨️",73:"🌨️",75:"❄️",77:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",85:"🌨️",86:"❄️",95:"⛈️",96:"⛈️",99:"⛈️"};

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const dato = (o, k, i, def = 0) => { const v = (o && o[k]) || []; return i >= 0 && i < v.length && v[i] != null ? v[i] : def; };
const describir = c => DESCRIPCIONES[c] || "Variable";
function icono(c, dia = true) {
  if (c === 0 || c === 1) return dia ? (c === 0 ? "☀️" : "🌤️") : "🌙";
  if (c === 2) return dia ? "⛅" : "☁️";
  return ICONOS[c] || "🌤️";
}
function gradiente(c, dia) {
  if ([95, 96, 99].includes(c)) return ["#1e1b4b", "#6d28d9"];
  if (!dia) return ["#0f172a", "#3730a3"];
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c)) return ["#334155", "#0369a1"];
  if ([71,73,75,77,85,86,45,48].includes(c)) return ["#64748b", "#94a3b8"];
  if (c === 3) return ["#475569", "#94a3b8"];
  if (c === 2) return ["#2563eb", "#64748b"];
  return ["#1d4ed8", "#38bdf8"];
}
const cieloPorNubes = p => p < 10 ? "Despejado" : p < 30 ? "Poco nublado" : p < 60 ? "Parcialmente nublado" : p < 85 ? "Mayormente nublado" : "Nublado";
const nivelUV = u => u < 3 ? "Bajo" : u < 6 ? "Moderado" : u < 8 ? "Alto" : u < 11 ? "Muy alto" : "Extremo";
const dirViento = g => g == null ? "" : ["N","NE","E","SE","S","SO","O","NO"][Math.floor(((g % 360) + 360) % 360 / 45 + 0.5) % 8];
const intensidad = mm => mm < 0.1 ? "nula" : mm < 2.5 ? "débil" : mm < 7.6 ? "moderada" : mm < 50 ? "fuerte" : "muy fuerte";
const fechaLarga = s => { const [y, m, d] = s.split("-").map(Number); const f = new Date(y, m - 1, d); return `${DIAS[f.getDay()]} ${d} de ${MESES[m - 1]}`; };
function nombreDia(fecha, i) {
  if (i === 0) return "Hoy"; if (i === 1) return "Mañana";
  const [y, m, d] = fecha.split("-").map(Number); return DIAS[new Date(y, m - 1, d).getDay()];
}
function indiceHoraActual(horario, actual) {
  const ref = (actual.time || "").slice(0, 13);
  const t = horario.time || [];
  for (let i = 0; i < t.length; i++) if (t[i].slice(0, 13) >= ref) return i;
  return 0;
}
const horaTxt = s => (s || "").slice(11, 16);
const colorTemp = t => t <= 5 ? "#3b82f6" : t <= 15 ? "#0ea5e9" : t <= 24 ? "#10b981" : t <= 30 ? "#f59e0b" : "#ef4444";

// ---------- lectura de radar y satélite (a partir del modelo, no de imágenes) ----------
function analizarRadarSatelite(datos) {
  const actual = datos.current || {}, horario = datos.hourly || {}, min15 = datos.minutely_15 || {};
  const i0 = indiceHoraActual(horario, actual);
  const ref = actual.time || "";
  let proximos = [];
  const tiempos = min15.time || [], valores = min15.precipitation || [];
  if (ref && tiempos.length && valores.length) {
    const t0 = new Date(ref).getTime();
    for (let k = 0; k < tiempos.length; k++) {
      if (tiempos[k] >= ref) {
        proximos.push([Math.floor((new Date(tiempos[k]).getTime() - t0) / 60000), (valores[k] || 0) * 4]);
        if (proximos.length >= 8) break;
      }
    }
  }
  if (!proximos.length) for (let k = 0; k < 3; k++) proximos.push([k * 60, dato(horario, "precipitation", i0 + k)]);
  const horizonte = proximos.length === 8 ? "2 horas" : "3 horas";
  const mmActual = Math.max(actual.precipitation || 0, proximos[0] ? proximos[0][1] : 0);
  const primera = proximos.find(([, mm]) => mm >= 0.1);
  let acum3 = 0; for (let k = 0; k < 3; k++) acum3 += dato(horario, "precipitation", i0 + k);
  let prob6 = 0, cape = 0;
  for (let k = 0; k < 6; k++) {
    prob6 = Math.max(prob6, dato(horario, "precipitation_probability", i0 + k));
    cape = Math.max(cape, dato(horario, "cape", i0 + k));
  }
  const radarLineas = []; let radarTitulo;
  if (mmActual >= 0.1) {
    radarTitulo = `Precipitación ${intensidad(mmActual)} en la zona`;
    const fin = proximos.find(([mn, mm]) => mn > 0 && mm < 0.1);
    radarLineas.push(fin ? `🕒 Cesaría en unos ${fin[0]} min.` : `🕒 Continuaría durante las próximas ${horizonte}.`);
  } else if (primera) {
    radarTitulo = `Lluvia ${intensidad(Math.max(...proximos.map(p => p[1])))} en camino`;
    radarLineas.push(`🕒 Comenzaría en unos ${primera[0]} min.`);
  } else radarTitulo = `Sin precipitación prevista en las próximas ${horizonte}`;
  radarLineas.push(`💧 Acumulado próximas 3 h: ${acum3.toFixed(1)} mm`);
  radarLineas.push(`🎯 Probabilidad máxima en 6 h: ${prob6.toFixed(0)}%`);
  if (cape >= 2000 && prob6 >= 30) radarLineas.push(`⚡ Atmósfera muy inestable (CAPE ${cape.toFixed(0)} J/kg): riesgo de tormentas fuertes.`);
  else if (cape >= 1000 && prob6 >= 20) radarLineas.push(`⚡ Inestabilidad moderada (CAPE ${cape.toFixed(0)} J/kg): posibles tormentas aisladas.`);

  let nubes = actual.cloud_cover; if (nubes == null) nubes = dato(horario, "cloud_cover", i0);
  const bajas = dato(horario, "cloud_cover_low", i0), medias = dato(horario, "cloud_cover_mid", i0), altas = dato(horario, "cloud_cover_high", i0);
  const cielo = cieloPorNubes(nubes);
  const satTitulo = `${cielo} (${nubes.toFixed(0)}% de cobertura)`;
  const satLineas = [];
  const capas = [["bajas", bajas], ["medias", medias], ["altas", altas]];
  const [dom, val] = capas.reduce((a, b) => b[1] > a[1] ? b : a);
  if (val < 20) satLineas.push("🌤️ Sin capas de nubes significativas.");
  else satLineas.push("☁️ " + {
    bajas: "Predominan nubes bajas (estratos): cielo cubierto, posible llovizna o neblina.",
    medias: "Predominan nubes medias (altostratos/altocúmulos): sol velado.",
    altas: "Predominan nubes altas (cirros): cielo velado, sin lluvia asociada.",
  }[dom]);
  const futura = dato(horario, "cloud_cover", i0 + 6, nubes), delta = futura - nubes;
  let tendTxt;
  if (delta >= 20) { satLineas.push(`📈 La nubosidad aumentaría en 6 h (→ ${futura.toFixed(0)}%).`); tendTxt = "con nubosidad en aumento"; }
  else if (delta <= -20) { satLineas.push(`📉 La nubosidad disminuiría en 6 h (→ ${futura.toFixed(0)}%).`); tendTxt = "con tendencia a despejar"; }
  else { satLineas.push("➖ La nubosidad se mantendría similar en las próximas 6 h."); tendTxt = "sin cambios importantes en la nubosidad"; }
  const vis = dato(horario, "visibility", i0, null);
  if (vis != null && vis < 5000) satLineas.push(`🌫️ Visibilidad reducida: ${(vis / 1000).toFixed(1)} km.`);

  const partes = [`Cielo ${cielo.toLowerCase()}, ${tendTxt}.`];
  if (mmActual >= 0.1) partes.push(`Hay precipitación ${intensidad(mmActual)} ahora mismo.`);
  else if (primera) partes.push(`Se espera lluvia en unos ${primera[0]} minutos.`);
  else if (prob6 >= 40) partes.push("Por ahora no llueve, pero hay chances de lluvia en las próximas horas.");
  else partes.push("No se esperan lluvias en el corto plazo.");
  if (cape >= 1000 && prob6 >= 20) partes.push("Ojo con la inestabilidad: pueden desarrollarse tormentas.");
  return { radarTitulo, radarLineas, satTitulo, satLineas, resumen: partes.join(" "), proximos, capas: { bajas, medias, altas } };
}

// ---------- movilidad ----------
function condicionMoto(d) {
  const ll = dato(d, "precipitation_probability_max", 0), v = dato(d, "wind_speed_10m_max", 0), c = dato(d, "weather_code", 0);
  if (c >= 95) return ["bad", "Tormentas previstas. Mejor no circular."];
  if (ll >= 70) return ["bad", `Alta probabilidad de lluvia (${ll.toFixed(0)}%). Pista resbalosa.`];
  if (v >= 50) return ["bad", `Viento fuerte (${v.toFixed(0)} km/h). Precaución.`];
  if (ll >= 40 || v >= 35) return ["warn", "Condiciones regulares. Posible lluvia o viento."];
  return ["ok", "Buenas condiciones para circular."];
}
function condicionAuto(d) {
  const ll = dato(d, "precipitation_probability_max", 0), v = dato(d, "wind_speed_10m_max", 0), c = dato(d, "weather_code", 0);
  if (c >= 95) return ["bad", "Tormentas previstas. Conducí con mucha precaución."];
  if (c === 45 || c === 48) return ["warn", "Niebla: reducí la velocidad y usá luces bajas."];
  if (ll >= 70 || v >= 60) return ["warn", "Conducí con precaución por lluvia o viento."];
  return ["ok", "Buenas condiciones para conducir."];
}
function condicionCaminando(d) {
  const ll = dato(d, "precipitation_probability_max", 0), uv = dato(d, "uv_index_max", 0), tmax = dato(d, "temperature_2m_max", 0);
  if (ll >= 70) return ["bad", "Lluvia probable. Llevá paraguas o impermeable."];
  if (tmax >= 35) return ["warn", "Calor intenso. Hidratate y evitá el mediodía."];
  if (uv >= 8) return ["warn", "UV muy alto. Usá protector solar."];
  return ["ok", "Buenas condiciones para caminar."];
}

// ============================================================
// ALERTAS METEOROLÓGICAS POR NIVEL
// Estimadas con los datos del modelo (Open-Meteo). NO son alertas oficiales.
// Las notificaciones en segundo plano usan solo las alertas oficiales del SMN y los sismos.
// ============================================================
const FENOMENOS = {
  tormenta: { nombre: "Tormentas", emoji: "⛈️" },
  lluvia: { nombre: "Lluvias intensas", emoji: "🌧️" },
  viento: { nombre: "Viento fuerte", emoji: "💨" },
  calor: { nombre: "Calor extremo", emoji: "🥵" },
  frio: { nombre: "Frío y heladas", emoji: "🥶" },
  nieve: { nombre: "Nevadas", emoji: "❄️" },
  niebla: { nombre: "Niebla", emoji: "🌫️" },
};
const NIVELES = [
  { n: 0, nombre: "Sin alerta", emoji: "✅", clase: "ok" },
  { n: 1, nombre: "Amarilla", emoji: "🟡", clase: "n1" },
  { n: 2, nombre: "Naranja", emoji: "🟠", clase: "n2" },
  { n: 3, nombre: "Roja", emoji: "🔴", clase: "n3" },
];
const nivelPor = (v, u) => v >= u[2] ? 3 : v >= u[1] ? 2 : v >= u[0] ? 1 : 0;

function horaActualDe(datos) {
  const t = datos && datos.current && datos.current.time;
  const h = parseInt((t || "").slice(11, 13), 10);
  return isNaN(h) ? 0 : h;
}

// Valores del día i. Los datos horarios (CAPE, lluvia/hora, visibilidad) se toman desde `horaDesde`.
function resumenDia(datos, i, horaDesde = 0) {
  const d = datos.daily || {}, h = datos.hourly || {};
  const fecha = (d.time || [])[i];
  if (!fecha) return null;
  let capeMax = 0, mmHoraMax = 0, visMin = null;
  (h.time || []).forEach((t, k) => {
    if (!t.startsWith(fecha) || parseInt(t.slice(11, 13), 10) < horaDesde) return;
    capeMax = Math.max(capeMax, dato(h, "cape", k));
    mmHoraMax = Math.max(mmHoraMax, dato(h, "precipitation", k));
    const v = h.visibility ? h.visibility[k] : null;
    if (v != null) visMin = visMin == null ? v : Math.min(visMin, v);
  });
  return {
    fecha, codigo: dato(d, "weather_code", i),
    tmax: dato(d, "temperature_2m_max", i), tmin: dato(d, "temperature_2m_min", i),
    mm: dato(d, "precipitation_sum", i), prob: dato(d, "precipitation_probability_max", i),
    viento: dato(d, "wind_speed_10m_max", i), rafaga: dato(d, "wind_gusts_10m_max", i),
    uv: dato(d, "uv_index_max", i), capeMax, mmHoraMax, visMin,
  };
}

function alertasClima(datos, dias = [0, 1]) {
  const res = [];
  const hora = horaActualDe(datos);
  for (const i of dias) {
    if (i === 0 && hora >= 21) continue; // a esa hora el día ya casi terminó
    const r = resumenDia(datos, i, i === 0 ? hora : 0);
    if (!r) continue;
    const add = (fenomeno, nivel, detalle) => {
      if (nivel > 0) res.push({ fenomeno, nivel, dia: i, fecha: r.fecha, detalle, clave: `${fenomeno}|${nivel}|${r.fecha}` });
    };

    // Tormentas
    let nt = 0;
    if (r.codigo === 95) nt = 1;
    if (r.codigo === 96 || r.codigo === 99) nt = 2;
    if (r.capeMax >= 1500 && r.prob >= 40) nt = Math.max(nt, 1);
    if (r.capeMax >= 2500 && r.prob >= 60) nt = Math.max(nt, 2);
    if (r.capeMax >= 4000 && r.prob >= 70) nt = Math.max(nt, 3);
    if (r.codigo === 99 && r.mm >= 50 && r.rafaga >= 80) nt = 3;
    add("tormenta", nt,
      (r.codigo >= 95 ? describir(r.codigo) : "Condiciones favorables para tormentas") +
      ` · probabilidad de lluvia ${Math.round(r.prob)}%` +
      (r.capeMax >= 1500 ? ` · atmósfera inestable (CAPE ${Math.round(r.capeMax)} J/kg)` : ""));

    // Lluvias intensas
    const nl = Math.max(nivelPor(r.mm, [25, 50, 100]), nivelPor(r.mmHoraMax, [15, 30, 50]));
    add("lluvia", nl, `Acumulado estimado ${r.mm.toFixed(0)} mm en el día` + (r.mmHoraMax >= 15 ? ` · hasta ${r.mmHoraMax.toFixed(0)} mm en una hora` : ""));

    // Viento
    const nv = Math.max(nivelPor(r.rafaga, [70, 90, 120]), nivelPor(r.viento, [50, 70, 90]));
    add("viento", nv, `Viento de hasta ${Math.round(r.viento)} km/h y ráfagas de hasta ${Math.round(r.rafaga)} km/h`);

    // Calor y frío
    add("calor", nivelPor(r.tmax, [35, 38, 41]), `Máxima prevista de ${Math.round(r.tmax)} °C`);
    add("frio", nivelPor(-r.tmin, [-2, 3, 8]), `Mínima prevista de ${Math.round(r.tmin)} °C` + (r.tmin <= 2 ? ": riesgo de heladas" : ""));

    // Nieve
    let nn = 0;
    if ([71, 73, 77, 85].includes(r.codigo)) nn = 1;
    if ([75, 86].includes(r.codigo)) nn = 2;
    add("nieve", nn, describir(r.codigo));

    // Niebla
    let nb = 0;
    if (r.codigo === 45 || r.codigo === 48) nb = 1;
    if (r.visMin != null && r.visMin < 1000) nb = Math.max(nb, 1);
    if (r.visMin != null && r.visMin < 200) nb = Math.max(nb, 2);
    add("niebla", nb, r.visMin != null ? `Visibilidad mínima prevista: ${Math.round(r.visMin)} m` : describir(r.codigo));
  }
  res.sort((a, b) => b.nivel - a.nivel || a.dia - b.dia);
  return res;
}

// ============================================================
// PRECAUCIONES
// ============================================================
const PRECAUCIONES = {
  tormenta: [
    "Resguardate en un edificio o en un vehículo cerrado. Evitá árboles aislados, torres, antenas y espacios abiertos.",
    "Alejate de ríos, arroyos y zonas bajas: pueden crecer en minutos.",
    "Desenchufá los artefactos sensibles y no uses equipos conectados a la red durante la tormenta.",
    "Si hay riesgo de granizo, guardá el auto bajo techo. Asegurá macetas, toldos y chapas.",
    "Esperá 30 minutos desde el último trueno antes de volver a salir.",
  ],
  lluvia: [
    "No cruces calles, vados ni cauces con agua en movimiento, aunque parezcan poco profundos.",
    "No manejes por zonas anegadas: el auto puede quedar varado o ser arrastrado.",
    "Si el agua sube, evitá subsuelos, garajes y sótanos y subí a un piso alto.",
    "Despejá desagües y rejillas, y alejá del agua los enchufes y cables.",
    "Tené a mano linterna, documentos y el celular cargado, y seguí las indicaciones de Defensa Civil.",
  ],
  viento: [
    "Asegurá o guardá lo que pueda volar: macetas, toldos, chapas y muebles de balcón.",
    "Alejate de árboles, carteles, postes y cables, y no te refugies debajo de ellos.",
    "Si ves cables caídos no los toques y llamá al 911.",
    "Al manejar sujetá bien el volante y reducí la velocidad, sobre todo con camionetas, acoplados y motos.",
    "Evitá actividades al aire libre como náutica, drones o caminatas en cumbres.",
  ],
  calor: [
    "Tomá agua seguido aunque no tengas sed. Evitá el alcohol y las bebidas muy azucaradas.",
    "Evitá el sol entre las 11 y las 17 h y no hagas ejercicio intenso al aire libre.",
    "Usá ropa clara y holgada, gorra y protector solar. Buscá lugares frescos y ventilados.",
    "Nunca dejes personas ni mascotas dentro de un auto cerrado.",
    "Prestá atención a bebés, personas mayores y personas con enfermedades crónicas.",
    "Si alguien tiene piel caliente y seca, confusión o se desmaya, puede ser golpe de calor: llamá al 107 o al 911 y refrescalo.",
  ],
  frio: [
    "Abrigate en capas y protegé manos, pies y cabeza.",
    "Ventilá siempre los ambientes con estufas, braseros o calefones. El monóxido de carbono no tiene olor y puede ser mortal. No duermas con braseros encendidos.",
    "Cuidá a bebés, personas mayores y quienes viven en la calle. Si alguien está en riesgo, llamá al 911.",
    "Con heladas, protegé plantas, caños expuestos y mascotas.",
    "Manejá despacio, sobre todo de madrugada: puede haber hielo en rutas y puentes.",
  ],
  nieve: [
    "Si vas a viajar, consultá el estado de las rutas, llevá cadenas, abrigo, agua y comida.",
    "Evitá viajar si no es necesario: el hielo y la poca visibilidad aumentan el riesgo de accidentes.",
    "Nunca uses estufas, braseros ni generadores sin ventilación.",
    "Abrigate en capas y mantené el celular cargado.",
  ],
  niebla: [
    "Reducí la velocidad, aumentá la distancia con el vehículo de adelante y usá luces bajas (no las altas).",
    "Si la niebla es muy densa, detenete fuera de la calzada y encendé las balizas.",
    "Evitá adelantamientos y revisá el estado de las rutas antes de salir.",
    "Si caminás o andás en bici, usá ropa clara o reflectante.",
  ],
  sismo: [
    "Durante el temblor: agachate, cubrite la cabeza y el cuello y sostenete de un mueble firme. Alejate de ventanas, espejos y objetos que puedan caer.",
    "No uses el ascensor y no corras hacia las escaleras mientras tiembla.",
    "Si estás afuera, alejate de edificios, cables y postes. Si manejás, detenete en un lugar abierto.",
    "Después: revisá si hay heridos o daños. Si sentís olor a gas, cerrá la llave y ventilá, sin encender llamas ni interruptores.",
    "Usá linterna (no velas ni fósforos) y estate atento a las réplicas.",
    "Seguí las indicaciones de Defensa Civil. En una emergencia llamá al 911 y evitá saturar las líneas con llamadas innecesarias.",
  ],
  tsunami: [
    "Si estás en la costa y sentís un temblor fuerte o prolongado, o ves que el mar se retira de golpe, no esperes un aviso: alejate de la playa de inmediato.",
    "Andá a terreno alto (al menos 30 m sobre el nivel del mar) o a unos 3 km tierra adentro, a pie si es posible.",
    "Las olas pueden repetirse durante horas: no regreses hasta que las autoridades (Defensa Civil, Armada/SHN) lo indiquen.",
    "No vayas a mirar el mar ni a sacar fotos.",
    "Tené a mano documentos, linterna, agua, el celular cargado y un plan de evacuación acordado con tu familia.",
  ],
};
const PRECAUCION_ROJA = "Nivel rojo: evitá salir salvo que sea imprescindible y seguí las indicaciones de Defensa Civil. En una emergencia llamá al 911.";
function precauciones(fenomeno, nivel = 1) {
  const base = (PRECAUCIONES[fenomeno] || []).slice();
  if (nivel >= 3) base.unshift(PRECAUCION_ROJA);
  return base;
}

// ============================================================
// ALERTAS OFICIALES DEL SMN (llegan ya filtradas por ubicación desde la parte nativa)
// ============================================================
const NIVEL_SMN = { amarillo: 1, naranja: 2, rojo: 3 };
// Tipo de fenómeno a partir del texto del evento ("Tormentas", "Vientos", "Temperaturas extremas", "Zonda"...)
function fenomenoSmn(evento, titular = "") {
  const t = (evento + " " + titular).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/tormenta|granizo|rayo|electric/.test(t)) return "tormenta";
  if (/nevad|nieve|ventisca/.test(t)) return "nieve";
  if (/niebla|neblina|visibilidad/.test(t)) return "niebla";
  if (/zonda|viento|vendaval|temporal|ciclon|tornado/.test(t)) return "viento";
  if (/lluvia|precipitacion|inundacion|crecida|anegamiento|tormenta/.test(t)) return "lluvia";
  if (/calor|alta temperatura|ola de calor/.test(t)) return "calor";
  if (/frio|helada|baja temperatura|ola polar/.test(t)) return "frio";
  return "general";
}
const PRECAUCION_GENERAL = [
  "Mantenete informado por los canales oficiales del Servicio Meteorológico Nacional y de Defensa Civil.",
  "Evitá actividades al aire libre mientras dure el aviso, y postergá viajes que no sean necesarios.",
  "Cuidá a niños, personas mayores y mascotas, y tené a mano linterna, agua y el celular cargado.",
  "En una emergencia llamá al 911.",
];
function precaucionesSmn(a) {
  const f = fenomenoSmn(a.evento || "", a.titular || "");
  const base = f === "general" ? PRECAUCION_GENERAL.slice() : precauciones(f, NIVEL_SMN[a.nivel] || 1);
  const ins = String(a.instruccion || "").split(/\n+/).map(x => x.replace(/^\s*\d+\s*[-.)]\s*/, "").trim()).filter(Boolean);
  return { fenomeno: f, oficiales: ins, generales: base };
}
function estiloNivelSmn(nivel) {
  const n = NIVEL_SMN[nivel] || 1;
  return NIVELES[n];
}
function vigenciaSmn(a, ahora = Date.now()) {
  const f = ms => { const d = new Date(ms); return `${DIAS[d.getDay()].slice(0, 3)} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  if (!a.hasta) return a.desde && a.desde > ahora ? `Desde ${f(a.desde)}` : "Vigente";
  if (a.desde && a.desde > ahora) return `Desde ${f(a.desde)} hasta ${f(a.hasta)}`;
  return `Vigente hasta ${f(a.hasta)}`;
}

// ============================================================
// SISMOS Y POSIBLE TSUNAMI (datos del USGS, informativos)
// ============================================================
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
// [radio en km, magnitud mínima]: alcanza con cumplir uno
const SENS_SISMOS = {
  todos: [[300, 4.5], [700, 5.5], [800, 6.5]],
  moderada: [[300, 5.0], [700, 5.5], [800, 6.5]],
  fuerte: [[400, 5.5], [800, 6.5]],
};
const RUMBOS = { N: "N", NNE: "NNE", NE: "NE", ENE: "ENE", E: "E", ESE: "ESE", SE: "SE", SSE: "SSE", S: "S", SSW: "SSO", SW: "SO", WSW: "OSO", W: "O", WNW: "ONO", NW: "NO", NNW: "NNO" };
function traducirLugar(place) {
  const s = String(place || "").trim();
  const m = s.match(/^(\d+)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i);
  if (m && RUMBOS[m[2].toUpperCase()]) return `A ${m[1]} km al ${RUMBOS[m[2].toUpperCase()]} de ${m[3]}`;
  return s.replace(/^offshore\s+/i, "Frente a la costa de ") || "Ubicación sin nombre";
}
function textoHace(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
function nivelSismo(mag, dist) {
  const p = mag - dist / 250;
  return p >= 6.5 ? 3 : p >= 5.5 ? 2 : p >= 4.2 ? 1 : 0;
}
function urlSismos(lat, lon, desdeMs) {
  const p = new URLSearchParams({
    format: "geojson", latitude: lat.toFixed(3), longitude: lon.toFixed(3), maxradiuskm: "2000",
    minmagnitude: "4.5", starttime: new Date(desdeMs).toISOString().slice(0, 19), orderby: "time", limit: "200",
  });
  return `${URL_SISMOS}?${p}`;
}
// Puntos de referencia de la costa atlántica argentina y del Pacífico chileno [lat, lon]. Igual que en Sismos.java.
const COSTA = [[-34.6,-58.4],[-34.9,-57.9],[-36.6,-56.7],[-37.9,-57.5],[-38.0,-57.55],[-38.55,-58.7],[-39.0,-61.4],[-40.8,-63.0],[-40.8,-65.1],[-42.0,-63.8],[-42.77,-65.04],[-43.3,-65.1],[-44.8,-65.7],[-45.87,-67.5],[-47.75,-65.9],[-49.3,-67.7],[-51.6,-69.0],[-52.4,-68.4],[-53.8,-67.7],[-54.8,-68.3],[-34.9,-54.9],[-18.5,-70.3],[-20.2,-70.1],[-23.65,-70.4],[-27.4,-70.9],[-29.9,-71.3],[-33.05,-71.6],[-33.6,-71.6],[-35.4,-72.5],[-36.8,-73.1],[-39.8,-73.4],[-41.5,-73.0],[-43.1,-73.7],[-46.6,-75.4],[-50.0,-75.5],[-53.0,-70.9]];
const COSTA_KM = 100;
const cercaDeCosta = (lat, lon) => COSTA.some(([la, lo]) => distanciaKm(lat, lon, la, lo) <= COSTA_KM);
function filtrarSismos(geojson, lat, lon, sens = "moderada", ahora = Date.now()) {
  const tiers = SENS_SISMOS[sens] || SENS_SISMOS.moderada;
  const out = [], costero = cercaDeCosta(lat, lon);
  ((geojson && geojson.features) || []).forEach(f => {
    const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
    if (c.length < 2 || p.mag == null || p.time == null) return;
    const dist = distanciaKm(lat, lon, c[1], c[0]); // el USGS da [longitud, latitud, profundidad]
    const cumple = tiers.some(([radio, mag]) => dist <= radio && p.mag >= mag);
    // El campo "tsunami" del USGS marca sismos oceánicos grandes. No confirma que haya un tsunami. Solo se usa si el usuario está cerca de la costa.
    const posibleTsunami = costero && p.tsunami === 1 && p.mag >= 6.0 && dist <= 2000;
    if (!cumple && !posibleTsunami) return;
    out.push({
      id: f.id, mag: p.mag, lugar: traducirLugar(p.place), distKm: Math.round(dist),
      profKm: c[2] != null ? Math.round(c[2]) : null, tiempo: p.time, hace: textoHace(ahora - p.time),
      tsunami: posibleTsunami, url: p.url || "", nivel: nivelSismo(p.mag, dist),
    });
  });
  out.sort((a, b) => b.tiempo - a.tiempo);
  return out;
}

// ============================================================
// SOL Y LUNA: salida, puesta y fases (cálculo astronómico local, funciona sin internet)
// Fórmulas astronómicas estándar de baja precisión: los horarios pueden diferir 1-2 minutos (sol)
// y algunos minutos (luna) de los almanaques oficiales.
// ============================================================
const AST = (() => {
  const RAD = Math.PI / 180, DIA_MS = 86400000, J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  const aJuliano = ms => ms / DIA_MS - 0.5 + J1970;
  const aMs = j => (j + 0.5 - J1970) * DIA_MS;
  const aDias = ms => aJuliano(ms) - J2000;
  const ascRecta = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
  const declinacion = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
  const tiempoSideral = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
  const refraccion = h => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };
  const altura = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));

  const anomaliaSol = d => RAD * (357.5291 + 0.98560028 * d);
  const longEclip = M => {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    return M + C + RAD * 102.9372 + Math.PI;
  };
  const coordsSol = d => { const M = anomaliaSol(d), L = longEclip(M); return { dec: declinacion(L, 0), ra: ascRecta(L, 0), M, L }; };

  const J0 = 0.0009;
  const ciclo = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
  const transitoAprox = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
  const transitoSolar = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  // Sol: salida, mediodía solar y puesta (ms UTC) para el día en que cae "ms". Devuelve null si no sale/pone ese día.
  function solDelDia(ms, lat, lon) {
    const lw = RAD * -lon, phi = RAD * lat, d = aDias(ms), n = ciclo(d, lw), ds = transitoAprox(0, lw, n);
    const M = anomaliaSol(ds), L = longEclip(M), dec = declinacion(L, 0), Jnoon = transitoSolar(ds, M, L);
    const cosw = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (!isFinite(cosw) || cosw < -1 || cosw > 1) return { mediodia: aMs(Jnoon), sale: null, pone: null };
    const w = Math.acos(cosw);
    const a = transitoAprox(w, lw, n), Jset = transitoSolar(a, M, L), Jrise = Jnoon - (Jset - Jnoon);
    return { mediodia: aMs(Jnoon), sale: aMs(Jrise), pone: aMs(Jset) };
  }

  // Luna
  function coordsLuna(d) {
    const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), dt = 385001 - 20905 * Math.cos(M);
    return { ra: ascRecta(l, b), dec: declinacion(l, b), dist: dt };
  }
  function alturaLuna(ms, lat, lon) {
    const lw = RAD * -lon, phi = RAD * lat, d = aDias(ms), c = coordsLuna(d);
    const H = tiempoSideral(d, lw) - c.ra, h = altura(H, phi, c.dec);
    return h + refraccion(h);
  }
  // fase: 0 nueva, 0.25 cuarto creciente, 0.5 llena, 0.75 cuarto menguante. fraccion: parte iluminada (0..1).
  function iluminacion(ms) {
    const d = aDias(ms), s = coordsSol(d), m = coordsLuna(d), sdist = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { fraccion: (1 + Math.cos(inc)) / 2, fase: faseElongacion(d) };
  }
  // Fase a partir de la diferencia de longitud eclíptica Luna-Sol (con las correcciones principales de la órbita lunar)
  function faseElongacion(d) {
    const Ms = anomaliaSol(d), ls = longEclip(Ms);
    const Lm = RAD * (218.3164477 + 13.17639648 * d), Mm = RAD * (134.9634 + 13.06499295 * d);
    const D = RAD * (297.8502 + 12.19074912 * d);
    const lm = Lm + RAD * (6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * (Lm - RAD * 93.272)));
    return ((((lm - ls) / (2 * Math.PI)) % 1) + 1) % 1;
  }
  // Salida y puesta de la Luna entre inicioMs y inicioMs + 24 h (se revisa hora por hora)
  function lunaDelDia(inicioMs, lat, lon) {
    const hc = 0.133 * RAD, H = 3600000;
    let h0 = alturaLuna(inicioMs, lat, lon) - hc, sale = null, pone = null;
    for (let i = 1; i <= 24; i += 2) {
      const h1 = alturaLuna(inicioMs + i * H, lat, lon) - hc, h2 = alturaLuna(inicioMs + (i + 1) * H, lat, lon) - hc;
      const a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a), ye = (a * xe + b) * xe + h1, disc = b * b - 4 * a * h1;
      let raices = 0, x1 = 0, x2 = 0;
      if (disc >= 0) {
        const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
        x1 = xe - dx; x2 = xe + dx;
        if (Math.abs(x1) <= 1) raices++;
        if (Math.abs(x2) <= 1) raices++;
        if (x1 < -1) x1 = x2;
      }
      if (raices === 1) { if (h0 < 0) sale = i + x1; else pone = i + x1; }
      else if (raices === 2) { sale = i + (ye < 0 ? x2 : x1); pone = i + (ye < 0 ? x1 : x2); }
      if (sale !== null && pone !== null) break;
      h0 = h2;
    }
    return { sale: sale === null ? null : inicioMs + sale * H, pone: pone === null ? null : inicioMs + pone * H };
  }
  return { solDelDia, lunaDelDia, iluminacion, DIA_MS };
})();

// Fases: nombre, emoji (el dibujo se espeja en el hemisferio sur, donde la Luna se ve "al revés")
function nombreFase(f) {
  return f < 0.03 || f > 0.97 ? "nueva" : f < 0.22 ? "creciente" : f < 0.28 ? "en cuarto creciente"
    : f < 0.47 ? "gibosa creciente" : f < 0.53 ? "llena" : f < 0.72 ? "gibosa menguante"
    : f < 0.78 ? "en cuarto menguante" : "menguante";
}
function emojiFase(f, lat = -34) {
  const norte = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  let k = Math.round(f * 8) % 8;
  if (lat < 0 && k !== 0 && k !== 4) k = 8 - k; // espejo: creciente <-> menguante
  return norte[k];
}
function titularFase(f) {
  const n = nombreFase(f);
  return n === "nueva" ? "Luna nueva" : n === "llena" ? "Luna llena" : n === "creciente" ? "Luna creciente"
    : n === "menguante" ? "Luna menguante" : n === "en cuarto creciente" ? "Cuarto creciente"
    : n === "en cuarto menguante" ? "Cuarto menguante" : n === "gibosa creciente" ? "Gibosa creciente" : "Gibosa menguante";
}

// Compatibilidad: usada por la actividad "Observar estrellas"
function faseLunar(fecha = new Date()) {
  const il = AST.iluminacion(fecha.getTime());
  return { fase: il.fase, iluminacion: il.fraccion, nombre: nombreFase(il.fase) };
}

const hhmm = (ms, offSeg) => {
  const d = new Date(ms + offSeg * 1000);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
};
const fechaCorta = (ms, offSeg) => { const d = new Date(ms + offSeg * 1000); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1); };

// Todo lo de Sol y Luna para un día ("2026-10-12") en un lugar. offSeg = diferencia horaria del lugar con UTC.
function astrosDelDia(fechaISO, lat, lon, offSeg) {
  const [y, m, d] = fechaISO.slice(0, 10).split("-").map(Number);
  const inicio = Date.UTC(y, m - 1, d) - offSeg * 1000;
  const mediodia = inicio + 12 * 3600000;
  const sol = AST.solDelDia(mediodia, lat, lon);
  const lunaH = AST.lunaDelDia(inicio, lat, lon);
  const il = AST.iluminacion(mediodia);
  const luz = sol.sale !== null && sol.pone !== null ? Math.round((sol.pone - sol.sale) / 60000) : null;
  const t = ms => ms === null ? null : hhmm(ms, offSeg);
  return {
    sol: { sale: t(sol.sale), pone: t(sol.pone), mediodia: t(sol.mediodia), luzMin: luz,
      saleMs: sol.sale, poneMs: sol.pone },
    luna: { sale: t(lunaH.sale), pone: t(lunaH.pone), fase: il.fase, iluminacion: il.fraccion,
      nombre: titularFase(il.fase), emoji: emojiFase(il.fase, lat), edad: il.fase * 29.530588853 },
  };
}

// Próximas fases principales (nueva, cuarto creciente, llena, cuarto menguante) a partir de un momento
function proximasFases(desdeMs, offSeg, lat = -34, cantidad = 4) {
  const nombres = [["Luna nueva", 0], ["Cuarto creciente", 2], ["Luna llena", 4], ["Cuarto menguante", 6]];
  const emojis = k => emojiFase(k / 8, lat);
  const dist = (ms, b) => ((AST.iluminacion(ms).fase - b + 1.5) % 1) - 0.5; // distancia con signo a la fase objetivo
  const salida = [], paso = 6 * 3600000;
  let t = desdeMs;
  for (let n = 0; n < 4 * 40 && salida.length < cantidad; n++, t += paso) {
    const a = AST.iluminacion(t).fase, b = AST.iluminacion(t + paso).fase;
    const ua = a, ub = b < a ? b + 1 : b;
    const k = Math.floor(ua * 4 + 1e-9) + 1;
    if (k / 4 <= ub + 1e-12 && Math.floor(ub * 4) >= k) {
      const objetivo = (k / 4) % 1;
      let lo = t, hi = t + paso;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (dist(mid, objetivo) < 0) lo = mid; else hi = mid; }
      const ms = Math.round((lo + hi) / 2);
      const [nom, idx] = nombres[k % 4];
      if (ms > desdeMs) salida.push({ nombre: nom, emoji: emojis(idx), ms, fecha: fechaCorta(ms, offSeg), hora: hhmm(ms, offSeg) });
    }
  }
  return salida;
}

// ============================================================
// ACTIVIDADES AL AIRE LIBRE
// ============================================================
// ventana: horas del día evaluadas [desde, hasta). Pueden pasar de 24 (siguiente madrugada).
// ideal / limite: sensación térmica en °C. vientoIdeal / vientoLimite en km/h.
// lluvia, uv, nubes: cuánto pesan en el puntaje. vis: si la visibilidad importa.
const ACTIVIDADES = [
  { id: "senderismo", nombre: "Senderismo", emoji: "🥾", ventana: [7, 19], dur: 3, ideal: [10, 24], limite: [-3, 33], vientoIdeal: 20, vientoLimite: 45, lluvia: 1, uv: 0.6, nubes: 0, vis: true,
    tips: ["Avisá tu ruta y la hora a la que pensás volver.", "Llevá agua (1 litro cada 2 horas), abrigo liviano y un mapa sin conexión.", "Volvé antes de que oscurezca. Si se acerca una tormenta, bajá de cumbres y crestas."] },
  { id: "running", nombre: "Correr", emoji: "🏃", ventana: [6, 21], dur: 1, ideal: [8, 19], limite: [-5, 29], vientoIdeal: 20, vientoLimite: 40, lluvia: 0.8, uv: 0.5, nubes: 0, vis: false,
    tips: ["Hidratate antes y después. Con más de 25° llevá agua.", "Con poca luz usá ropa reflectante y andá por lugares iluminados.", "Entrá en calor 5 a 10 minutos y bajá el ritmo si hace calor."] },
  { id: "ciclismo", nombre: "Ciclismo", emoji: "🚴", ventana: [7, 20], dur: 2, ideal: [10, 26], limite: [0, 34], vientoIdeal: 18, vientoLimite: 35, lluvia: 1.2, uv: 0.5, nubes: 0, vis: true,
    tips: ["Usá casco siempre y luces si hay poca luz.", "Con el piso mojado frená antes y evitá pintura vial, rieles y hojas.", "Con viento lateral fuerte tené cuidado en rutas con camiones."] },
  { id: "playa", nombre: "Playa o pileta", emoji: "🏖️", ventana: [10, 19], dur: 3, ideal: [26, 34], limite: [21, 40], vientoIdeal: 25, vientoLimite: 45, lluvia: 1, uv: 0, nubes: 0.3, vis: false,
    tips: ["Usá protector solar factor 50 y reaplicalo cada 2 horas y después de meterte al agua.", "Respetá las banderas y a los guardavidas. No nades solo ni con corrientes.", "Hidratate y evitá el sol entre las 11 y las 16 h."] },
  { id: "picnic", nombre: "Picnic o asado", emoji: "🧺", ventana: [10, 20], dur: 3, ideal: [18, 28], limite: [8, 36], vientoIdeal: 20, vientoLimite: 35, lluvia: 1.2, uv: 0.5, nubes: 0, vis: false,
    tips: ["Con viento fuerte o pasto seco no hagas fuego.", "Apagá las brasas con agua antes de irte.", "No dejes alimentos al sol más de 2 horas: conservalos en frío."] },
  { id: "pesca", nombre: "Pesca", emoji: "🎣", ventana: [5, 21], dur: 3, ideal: [12, 28], limite: [2, 36], vientoIdeal: 15, vientoLimite: 30, lluvia: 0.6, uv: 0.3, nubes: 0, vis: false,
    tips: ["Usá chaleco salvavidas si salís en embarcación.", "No pesques con tormenta eléctrica: la caña atrae los rayos.", "Avisá adónde vas y llevá abrigo y agua."] },
  { id: "camping", nombre: "Camping", emoji: "⛺", ventana: [15, 29], dur: 8, ideal: [8, 26], limite: [-2, 34], vientoIdeal: 20, vientoLimite: 40, lluvia: 1.3, uv: 0, nubes: 0, vis: false,
    tips: ["Armá la carpa lejos de cauces secos y de árboles aislados.", "Con viento reforzá las estacas y los tensores.", "Hacé fuego solo donde esté permitido y con agua cerca. Nunca uses braseros dentro de la carpa: el monóxido de carbono es mortal."] },
  { id: "futbol", nombre: "Fútbol y deportes", emoji: "⚽", ventana: [9, 22], dur: 2, ideal: [12, 26], limite: [2, 33], vientoIdeal: 25, vientoLimite: 45, lluvia: 0.7, uv: 0.5, nubes: 0, vis: false,
    tips: ["Con tormenta eléctrica suspendé el partido y esperá 30 minutos desde el último trueno.", "Con calor tomá agua cada 15 o 20 minutos.", "Con el césped mojado hay más riesgo de lesiones."] },
  { id: "mascotas", nombre: "Paseo con mascotas", emoji: "🐕", ventana: [6, 21], dur: 1, ideal: [8, 24], limite: [-3, 30], vientoIdeal: 30, vientoLimite: 55, lluvia: 0.6, uv: 0.3, nubes: 0, vis: false,
    tips: ["Con calor el asfalto quema las almohadillas: apoyá la mano 5 segundos para probarlo.", "Llevá agua para tu mascota y nunca la dejes en el auto.", "Con tormenta o pirotecnia evitá salir: muchas mascotas se asustan y se escapan."] },
  { id: "nautica", nombre: "Kayak y vela", emoji: "🛶", ventana: [8, 19], dur: 3, ideal: [18, 30], limite: [10, 36], vientoIdeal: 12, vientoLimite: 28, lluvia: 0.8, uv: 0.4, nubes: 0, vis: true,
    tips: ["Usá chaleco salvavidas siempre y avisá tu recorrido.", "Volvé a la costa si sube el viento o aparecen nubes oscuras.", "Las ráfagas pueden dar vuelta embarcaciones chicas."] },
  { id: "drone", nombre: "Drone", emoji: "🚁", ventana: [8, 20], dur: 1, ideal: [5, 30], limite: [-5, 38], vientoIdeal: 15, vientoLimite: 28, lluvia: 2, uv: 0, nubes: 0, vis: true,
    tips: ["Volá siempre a la vista y respetá la normativa de la ANAC.", "No vueles con lluvia ni con ráfagas: pueden llevarse el drone.", "El frío reduce la batería: llevá repuestos y mantenelas abrigadas."] },
  { id: "caminata", nombre: "Caminata", emoji: "🚶", ventana: [6, 21], dur: 1, ideal: [10, 24], limite: [-3, 32], vientoIdeal: 25, vientoLimite: 50, lluvia: 0.8, uv: 0.4, nubes: 0, vis: false,
    tips: ["Usá calzado cómodo y llevá agua si vas a caminar más de una hora.", "Con poca luz caminá por lugares iluminados y con ropa clara o reflectante.", "Con calor evitá las horas centrales del día y buscá sombra."] },
  { id: "tenis", nombre: "Tenis y pádel", emoji: "🎾", ventana: [8, 21], dur: 2, ideal: [14, 27], limite: [4, 34], vientoIdeal: 15, vientoLimite: 30, lluvia: 1.2, uv: 0.5, nubes: 0, vis: false,
    tips: ["Con viento fuerte la pelota se vuelve impredecible: ajustá tus tiros.", "Con la cancha mojada hay más riesgo de resbalones.", "Con calor hidratate en cada cambio de lado y usá gorra y protector solar."] },
  { id: "yoga", nombre: "Yoga y gimnasia al aire libre", emoji: "🧘", ventana: [6, 20], dur: 1, ideal: [14, 26], limite: [5, 33], vientoIdeal: 20, vientoLimite: 40, lluvia: 1, uv: 0.4, nubes: 0, vis: false,
    tips: ["Con el pasto húmedo usá una colchoneta gruesa o buscá una superficie seca.", "Entrá en calor antes de estirar, sobre todo si hace frío.", "Evitá el sol fuerte del mediodía y tené agua a mano."] },
  { id: "escalada", nombre: "Escalada", emoji: "🧗", ventana: [8, 19], dur: 3, ideal: [8, 24], limite: [-2, 31], vientoIdeal: 20, vientoLimite: 40, lluvia: 1.8, uv: 0.3, nubes: 0, vis: false,
    tips: ["La roca mojada resbala mucho y puede soltarse: no escales después de lluvia.", "Revisá tu equipo y asegurate con compañeros experimentados.", "Con viento fuerte o tormenta bajá enseguida: las paredes expuestas son peligrosas."] },
  { id: "golf", nombre: "Golf", emoji: "⛳", ventana: [8, 19], dur: 4, ideal: [12, 28], limite: [2, 35], vientoIdeal: 20, vientoLimite: 40, lluvia: 1.2, uv: 0.4, nubes: 0, vis: false,
    tips: ["Con tormenta eléctrica volvé al club: los palos atraen rayos y la cancha es zona abierta.", "Protegete del sol: gorra, anteojos y protector solar.", "Con viento fuerte ajustá la elección del palo."] },
  { id: "skate", nombre: "Skate y patín", emoji: "🛹", ventana: [8, 21], dur: 1, ideal: [12, 28], limite: [2, 35], vientoIdeal: 25, vientoLimite: 45, lluvia: 2, uv: 0.3, nubes: 0, vis: false,
    tips: ["Usá casco y protecciones, siempre.", "Con el piso mojado o con hojas el riesgo de caída es muy alto.", "Con poca luz evitá calles con tránsito y usá luces o elementos reflectantes."] },
  { id: "moto", nombre: "Moto", emoji: "🏍️", ventana: [8, 20], dur: 2, ideal: [14, 28], limite: [3, 36], vientoIdeal: 20, vientoLimite: 40, lluvia: 1.6, uv: 0.3, nubes: 0, vis: true,
    tips: ["Casco bien abrochado y ropa con protecciones.", "Con lluvia, el piso mojado y la pintura vial resbalan: aumentá la distancia de frenado.", "El viento lateral y las ráfagas, sobre todo cerca de camiones, pueden sacarte de tu línea."] },
  { id: "equitacion", nombre: "Equitación", emoji: "🐎", ventana: [7, 20], dur: 2, ideal: [10, 26], limite: [-2, 33], vientoIdeal: 20, vientoLimite: 38, lluvia: 1.2, uv: 0.4, nubes: 0, vis: false,
    tips: ["Usá casco y botas con taco. Los caballos se asustan con truenos y ráfagas.", "Con calor intenso dales agua y sombra, y bajá el ritmo.", "Con el suelo mojado o helado el riesgo de resbalar es mayor."] },
  { id: "astro", nombre: "Observar estrellas", emoji: "🌌", ventana: [21, 29], dur: 2, ideal: [8, 24], limite: [-8, 32], vientoIdeal: 25, vientoLimite: 45, lluvia: 1, uv: 0, nubes: 1, vis: true,
    tips: ["Alejate de las luces de la ciudad y dejá 20 minutos que se adapte la vista.", "Abrigate más de lo que creés: de noche baja mucho la temperatura.", "Usá luz roja y avisá a alguien dónde vas a estar."] },
];

function datosHora(h, k) {
  const temp = dato(h, "temperature_2m", k);
  const sens = h.apparent_temperature && h.apparent_temperature[k] != null ? h.apparent_temperature[k] : temp;
  const viento = dato(h, "wind_speed_10m", k);
  const rafaga = h.wind_gusts_10m && h.wind_gusts_10m[k] != null ? h.wind_gusts_10m[k] : viento * 1.4;
  return {
    temp, sens, viento, rafaga, prob: dato(h, "precipitation_probability", k), mm: dato(h, "precipitation", k),
    uv: dato(h, "uv_index", k), nubes: dato(h, "cloud_cover", k), cape: dato(h, "cape", k),
    codigo: dato(h, "weather_code", k), vis: h.visibility && h.visibility[k] != null ? h.visibility[k] : null,
  };
}

function puntajeHora(a, x) {
  let s = 100;
  const motivos = [];
  if (x.codigo >= 95 || (x.cape >= 1500 && x.prob >= 30)) { s = Math.min(s, 8); motivos.push("tormenta"); }
  const [i0, i1] = a.ideal, [l0, l1] = a.limite;
  if (x.sens < l0 || x.sens > l1) { s = Math.min(s, 10); motivos.push(x.sens < l0 ? "frio" : "calor"); }
  else if (x.sens < i0) { const p = 50 * (i0 - x.sens) / (i0 - l0); s -= p; if (p >= 15) motivos.push("frio"); }
  else if (x.sens > i1) { const p = 50 * (x.sens - i1) / (l1 - i1); s -= p; if (p >= 15) motivos.push("calor"); }
  const pl = a.lluvia * (x.prob * 0.4 + Math.min(x.mm, 5) * 12);
  s -= pl; if (pl >= 15) motivos.push("lluvia");
  const v = Math.max(x.viento, x.rafaga * 0.7);
  if (v > a.vientoIdeal) {
    s -= 55 * Math.min(1.3, (v - a.vientoIdeal) / (a.vientoLimite - a.vientoIdeal));
    motivos.push("viento");
  }
  if (v >= a.vientoLimite) s = Math.min(s, 15);
  if (a.uv && x.uv >= 8) s -= a.uv * (x.uv >= 11 ? 24 : 12);
  if (a.nubes) s -= a.nubes * x.nubes * 0.9;
  if (a.vis && x.vis != null) {
    if (x.vis < 1000) { s = Math.min(s, 15); motivos.push("niebla"); }
    else if (x.vis < 5000) { s -= 25 * (5000 - x.vis) / 4000; motivos.push("niebla"); }
  }
  return { s: Math.max(0, Math.min(100, s)), motivos };
}

const veredicto = p => p >= 80 ? { texto: "Ideal", clase: "ideal" } : p >= 60 ? { texto: "Bueno", clase: "bueno" }
  : p >= 40 ? { texto: "Con precauciones", clase: "regular" } : { texto: "No recomendable", clase: "malo" };
const fmtHora = H => String(H % 24).padStart(2, "0") + ":00";

// Avisos según el clima previsto para una franja horaria (stats y motivos salen de evaluarActividad / evaluarHorario).
function notasClima(stats, motivos) {
  const notas = [];
  if (motivos.has("tormenta")) notas.push("⛈️ Hay riesgo de tormenta eléctrica en ese horario: no lo hagas al aire libre.");
  if (stats.sensMax >= 35) notas.push("🥵 Calor intenso: evitá el esfuerzo fuerte, hidratate y buscá sombra.");
  else if (stats.sensMax >= 30) notas.push("🌡️ Hace calor: tomá agua antes y durante, y usá ropa liviana.");
  if (stats.sensMin <= 0) notas.push("🧊 Posible hielo en el piso: cuidado con los resbalones. Abrigate bien.");
  else if (stats.sensMin <= 8) notas.push("🧥 Hace frío: abrigate en capas.");
  if (stats.uv >= 8) notas.push(`☀️ UV ${nivelUV(stats.uv).toLowerCase()} (${stats.uv.toFixed(1)}): protector solar, gorra y anteojos.`);
  else if (stats.uv >= 6) notas.push(`☀️ UV alto (${stats.uv.toFixed(1)}): usá protector solar.`);
  if (stats.prob >= 70) notas.push(`☂️ Es muy probable que llueva (${Math.round(stats.prob)}%${stats.mm >= 1 ? `, unos ${Math.round(stats.mm)} mm` : ""}): salí con paraguas o impermeable, o dejalo para otro momento. El piso va a estar resbaladizo.`);
  else if (stats.prob >= 40) notas.push(`☂️ Posible lluvia (${Math.round(stats.prob)}%): llevá paraguas o impermeable.`);
  if (stats.rafaga >= 40) notas.push(`💨 Ráfagas de hasta ${Math.round(stats.rafaga)} km/h: asegurá tus cosas y tené cuidado.`);
  if (motivos.has("niebla")) notas.push("🌫️ Visibilidad reducida: extremá las precauciones.");
  return notas;
}

function evaluarActividad(datos, a, dia) {
  const h = datos.hourly || {}, d = datos.daily || {};
  const fecha = (d.time || [])[dia];
  if (!fecha || !h.time) return null;
  const i00 = h.time.indexOf(fecha + "T00:00");
  if (i00 < 0) return null;
  const horaAhora = dia === 0 ? horaActualDe(datos) : -1;
  const horas = [];
  for (let H = a.ventana[0]; H < a.ventana[1]; H++) {
    const k = i00 + H;
    if (k >= h.time.length) break;
    if (dia === 0 && H < horaAhora) continue;
    horas.push({ H, k, ...puntajeHora(a, datosHora(h, k)), x: datosHora(h, k) });
  }
  if (!horas.length) return { id: a.id, nombre: a.nombre, emoji: a.emoji, sinHorario: true, puntaje: -1 };

  const L = Math.min(a.dur, horas.length);
  let mejor = null;
  for (let i = 0; i + L <= horas.length; i++) {
    const w = horas.slice(i, i + L);
    const media = w.reduce((t, z) => t + z.s, 0) / L;
    const minimo = Math.min(...w.map(z => z.s));
    let puntaje = 0.7 * media + 0.3 * minimo;
    // Una tormenta dentro del horario es un riesgo de seguridad: nunca queda como opción aceptable.
    if (w.some(z => z.motivos.includes("tormenta"))) puntaje = Math.min(puntaje, 35);
    if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, w };
  }
  let puntaje = mejor.puntaje;
  const w = mejor.w, xs = w.map(z => z.x);
  const motivos = new Set(); w.forEach(z => z.motivos.forEach(m => motivos.add(m)));
  const max = k => Math.max(...xs.map(x => x[k])), min = k => Math.min(...xs.map(x => x[k]));
  const stats = {
    sensMin: min("sens"), sensMax: max("sens"), tempMin: min("temp"), tempMax: max("temp"),
    viento: max("viento"), rafaga: max("rafaga"), uv: max("uv"), prob: max("prob"),
    mm: xs.reduce((t, x) => t + x.mm, 0), nubes: xs.reduce((t, x) => t + x.nubes, 0) / xs.length,
  };

  const notas = [];
  if ((a.base || a.id) === "astro") {
    const f = faseLunar(new Date(fecha + "T22:00:00"));
    puntaje -= Math.max(0, f.iluminacion - 0.4) * 40;
    notas.push(`🌙 Luna ${f.nombre} (${Math.round(f.iluminacion * 100)}% iluminada): ` + (f.iluminacion > 0.6 ? "su brillo dificulta ver estrellas débiles." : "buen momento para observar."));
  }
  puntaje = Math.max(0, Math.min(100, puntaje));

  notas.push(...notasClima(stats, motivos));

  return {
    id: a.id, nombre: a.nombre, emoji: a.emoji, sinHorario: false,
    puntaje: Math.round(puntaje), veredicto: veredicto(puntaje),
    ventana: `${fmtHora(w[0].H)}–${fmtHora(w[w.length - 1].H + 1)}`,
    stats, motivos: [...motivos], precauciones: notas.concat(a.tips),
  };
}

function actividadesDelDia(datos, dia, lista = ACTIVIDADES) {
  return lista.map(a => evaluarActividad(datos, a, dia)).filter(Boolean)
    .sort((x, y) => y.puntaje - x.puntaje);
}

// ---------- Días y horario propios de cada actividad ----------
// La persona carga en qué días (0 = domingo ... 6 = sábado) y de qué hora a qué hora hace una actividad: { dias: [1, 3], desde: "18:00", hasta: "19:30" }.
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const diaSemanaDe = fecha => { const [y, m, d] = String(fecha).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
const minDeHora = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "")); if (!m) return null; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? h * 60 + mi : null; };
// [desde, hasta] en minutos desde las 00:00. Si termina "antes" de empezar, cruza la medianoche (22:00 a 01:00). null si no sirve.
function rangoHorario(hr) {
  const d = minDeHora(hr && hr.desde), h = minDeHora(hr && hr.hasta);
  if (d === null || h === null || d === h) return null;
  return [d, h > d ? h : h + 1440];
}
const DURACION_MAX_MIN = 14 * 60;
function limpiarHorarios(h) {
  const o = {};
  if (!h || typeof h !== "object") return o;
  for (const id of Object.keys(h)) {
    const x = h[id];
    if (!x || !Array.isArray(x.dias)) continue;
    const dias = [...new Set(x.dias.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))];
    const rg = rangoHorario(x);
    if (!dias.length || !rg || rg[1] - rg[0] > DURACION_MAX_MIN) continue;
    o[id] = { dias, desde: x.desde, hasta: x.hasta };
  }
  return o;
}
function horarioDiasTxt(dias) {
  const n = [1, 2, 3, 4, 5, 6, 0].filter(x => dias.includes(x)).map(x => DIAS_CORTOS[x]);
  if (n.length === 7) return "Todos los días";
  return n.length > 1 ? n.slice(0, -1).join(", ") + " y " + n[n.length - 1] : (n[0] || "");
}
const horaDecimalTxt = x => {
  x = ((x % 24) + 24) % 24;
  let h = Math.floor(x), m = Math.round((x - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
};

// Evalúa el horario elegido por la persona para el día "dia" (0 = hoy). sol = { sale, pone } en horas decimales locales (opcional).
// Devuelve null si no hay pronóstico para ese día, { pasado: true } si el horario de hoy ya terminó.
function evaluarHorario(datos, a, dia, hr, sol) {
  const rg = rangoHorario(hr);
  const h = (datos && datos.hourly) || {}, d = (datos && datos.daily) || {};
  const fecha = (d.time || [])[dia];
  if (!rg || !fecha || !h.time) return null;
  const i00 = h.time.indexOf(fecha + "T00:00");
  if (i00 < 0) return null;
  const base = { id: a.id, nombre: a.nombre, emoji: a.emoji, ventana: `${hr.desde}–${hr.hasta}` };
  const H0 = Math.floor(rg[0] / 60), H1 = Math.ceil(rg[1] / 60);
  const horaAhora = dia === 0 ? horaActualDe(datos) : 0;
  if (dia === 0 && H1 <= horaAhora) return { ...base, pasado: true };
  const horas = [];
  for (let H = Math.max(H0, horaAhora); H < H1; H++) {
    const k = i00 + H;
    if (k >= h.time.length) break;
    const x = datosHora(h, k);
    horas.push({ H, x, esDia: h.is_day ? h.is_day[k] === 1 : true, ...puntajeHora(a, x) });
  }
  if (!horas.length) return { ...base, sinDatos: true };
  const L = horas.length;
  const media = horas.reduce((t, z) => t + z.s, 0) / L, minimo = Math.min(...horas.map(z => z.s));
  let puntaje = 0.7 * media + 0.3 * minimo;
  const motivos = new Set(); horas.forEach(z => z.motivos.forEach(m => motivos.add(m)));
  if (motivos.has("tormenta")) puntaje = Math.min(puntaje, 35);
  const xs = horas.map(z => z.x), max = k => Math.max(...xs.map(x => x[k])), min = k => Math.min(...xs.map(x => x[k]));
  const stats = {
    sensMin: min("sens"), sensMax: max("sens"), tempMin: min("temp"), tempMax: max("temp"),
    viento: max("viento"), rafaga: max("rafaga"), uv: max("uv"), prob: max("prob"),
    mm: xs.reduce((t, x) => t + x.mm, 0), nubes: xs.reduce((t, x) => t + x.nubes, 0) / L,
  };
  const esAstro = (a.base || a.id) === "astro";
  const notas = notasClima(stats, motivos);
  // Luz natural: si el horario cae de noche, otras precauciones (y para mirar estrellas, esperar a que oscurezca)
  if (sol && sol.sale != null && sol.pone != null) {
    const ini = Math.max(rg[0], horaAhora * 60) / 60, fin = rg[1] / 60;
    if (esAstro) {
      if (ini < sol.pone + 1) notas.push(`🌆 A esa hora todavía hay luz: el cielo oscuro empieza después de las ${horaDecimalTxt(sol.pone + 1)}.`);
    } else if (ini >= sol.pone) {
      notas.push(`🌙 Es de noche en todo tu horario (el sol se pone a las ${horaDecimalTxt(sol.pone)}): usá luces y ropa reflectante, y elegí lugares iluminados.`);
    } else if (fin > sol.pone) {
      notas.push(`🌙 Terminás de noche (el sol se pone a las ${horaDecimalTxt(sol.pone)}): llevá luz y ropa reflectante.`);
    } else if (ini < sol.sale) {
      notas.push(`🌅 Empezás antes de que salga el sol (${horaDecimalTxt(sol.sale)}): hay poca luz, usá luces y ropa reflectante.`);
    }
  }
  if (esAstro) {
    const f = faseLunar(new Date(fecha + "T22:00:00"));
    puntaje -= Math.max(0, f.iluminacion - 0.4) * 40;
    notas.push(`🌙 Luna ${f.nombre} (${Math.round(f.iluminacion * 100)}% iluminada): ` + (f.iluminacion > 0.6 ? "su brillo dificulta ver estrellas débiles." : "buen momento para observar."));
    const cielo = (h.cloud_cover ? stats.nubes : 0);
    if (cielo >= 60) notas.unshift(`☁️ Cielo muy nublado (${Math.round(cielo)}%): tal vez no veas las estrellas.`);
  }
  puntaje = Math.max(0, Math.min(100, puntaje));
  return {
    ...base, sinHorario: false, propio: true, parcial: dia === 0 && horaAhora > H0,
    puntaje: Math.round(puntaje), veredicto: veredicto(puntaje),
    stats, motivos: [...motivos], avisos: notas.filter(n => !n.startsWith("🌙 Luna")), precauciones: notas.concat(a.tips),
    horas: horas.map(z => ({ H: z.H, temp: z.x.temp, prob: z.x.prob, mm: z.x.mm, viento: z.x.viento, codigo: z.x.codigo, esDia: z.esDia })),
  };
}

// ---------- Cielo y nubes (para saber si algo se va a poder ver) ----------
// Cuánto cielo cubierto hay según el pronóstico por hora entre dos momentos (ms UTC). offSeg = diferencia horaria del lugar.
// Devuelve null si el pronóstico no cubre al menos la mitad de ese lapso.
function condicionCielo(datos, desdeMs, hastaMs, offSeg) {
  const h = datos && datos.hourly;
  if (!h || !h.time || !h.cloud_cover || !(hastaMs > desdeMs)) return null;
  let n = 0, nub = 0, prob = 0, lluvia = false, niebla = false;
  for (let k = 0; k < h.time.length; k++) {
    const t = h.time[k];
    const ini = Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13)) - offSeg * 1000;
    if (ini + 3600000 <= desdeMs || ini >= hastaMs) continue;
    n++;
    nub += dato(h, "cloud_cover", k);
    prob = Math.max(prob, dato(h, "precipitation_probability", k));
    const c = dato(h, "weather_code", k);
    if ((c >= 51 && c <= 77) || (c >= 80 && c <= 86) || c >= 95 || dato(h, "precipitation", k) >= 0.3) lluvia = true;
    if (c === 45 || c === 48) niebla = true;
    const v = h.visibility && h.visibility[k];
    if (v != null && v < 2000) niebla = true;
  }
  const horas = Math.max(1, Math.ceil((hastaMs - desdeMs) / 3600000));
  if (n === 0 || n < horas * 0.5) return null;
  const pct = Math.round(nub / n);
  // nivel: 0 despejado, 1 algo nublado, 2 muy nublado, 3 cubierto / lluvia / niebla
  let nivel, emoji, texto, titulo;
  if (lluvia || prob >= 60) { nivel = 3; emoji = "🌧️"; texto = "Se pronostica lluvia: probablemente no se vea."; titulo = "Con lluvia"; }
  else if (niebla) { nivel = 3; emoji = "🌫️"; texto = "Niebla o poca visibilidad: probablemente no se vea."; titulo = "Con niebla"; }
  else if (pct >= 85) { nivel = 3; emoji = "☁️"; texto = `Cielo cubierto (${pct}% de nubes): probablemente no se vea.`; titulo = "Cubierto"; }
  else if (pct >= 60) { nivel = 2; emoji = "☁️"; texto = `Muy nublado (${pct}% de nubes): tal vez no se vea.`; titulo = "Muy nublado"; }
  else if (pct >= 30) { nivel = 1; emoji = "⛅"; texto = `Algo nublado (${pct}% de nubes): puede verse entre las nubes.`; titulo = "Algo nublado"; }
  else { nivel = 0; emoji = "✨"; texto = `Cielo despejado (${pct}% de nubes): buenas chances de verse.`; titulo = "Despejado"; }
  return { nivel, pct, prob, emoji, texto, titulo };
}

// ============================================================
// RÍOS E INUNDACIONES (caudal estimado por el modelo GloFAS, vía Open-Meteo)
// ============================================================
// El servicio devuelve el caudal (m³/s) del río más grande en unos 5 km a la redonda. Si no hay río, devuelve vacío.
// No hay un "nivel de alerta" oficial en el dato: se compara el caudal previsto con las crecidas históricas de ese mismo
// lugar (1990-2022): la que ocurre en promedio cada 2 años = amarilla, cada 5 = naranja, cada 20 = roja.
const URL_CRECIDA_HIST = (lat, lon) => `${omServidor("flood-api")}/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&start_date=1990-01-01&end_date=2022-12-31&timezone=GMT${omClave}`;
const URL_CRECIDA_PRON = (lat, lon) => `${omServidor("flood-api")}/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&past_days=3&forecast_days=10&timezone=GMT${omClave}`;

// Calcula las crecidas de 2, 5 y 20 años con los máximos anuales (posición de Weibull). daily = { time[], river_discharge[] }
function umbralesCrecida(daily) {
  const t = (daily && daily.time) || [], v = (daily && daily.river_discharge) || [];
  const porAnio = {}, todos = [];
  for (let i = 0; i < t.length; i++) {
    if (v[i] == null || !isFinite(v[i])) continue;
    const y = String(t[i]).slice(0, 4);
    (porAnio[y] = porAnio[y] || []).push(v[i]);
    todos.push(v[i]);
  }
  const maximos = [];
  for (const y in porAnio) { if (porAnio[y].length >= 300) maximos.push(Math.max(...porAnio[y])); }
  if (maximos.length < 15 || !todos.length) return { ok: false };
  maximos.sort((a, b) => b - a);
  todos.sort((a, b) => a - b);
  const n = maximos.length, mediana = todos[Math.floor(todos.length / 2)];
  const retorno = T => {
    if (T >= n + 1) return maximos[0];
    const pos = (n + 1) / T - 1, i = Math.floor(pos), f = pos - i;
    return maximos[i] + (maximos[Math.min(i + 1, n - 1)] - maximos[i]) * f;
  };
  const q2 = retorno(2), q5 = retorno(5), q20 = retorno(20);
  // Un caudal muy chico no es un río relevante; y los umbrales tienen que crecer (si no, el dato no sirve)
  if (mediana < 5 || !(q2 > 0) || !(q5 > q2) || !(q20 > q5)) return { ok: false, chico: mediana < 5 };
  return { ok: true, q2, q5, q20, mediana, anios: n };
}

// Evalúa los próximos 7 días (incluido hoy). Devuelve null si el servicio no tiene dato para ese lugar.
function evaluarCrecida(u, daily, hoyISO) {
  if (!u || !u.ok || !daily || !daily.time) return null;
  const t = daily.time, v = daily.river_discharge || [];
  let actual = null, pico = null, diaPico = null, k = 0;
  for (let i = 0; i < t.length; i++) {
    if (v[i] == null) continue;
    if (t[i] <= hoyISO) actual = v[i];
    if (t[i] >= hoyISO && k < 7) { k++; if (pico === null || v[i] > pico) { pico = v[i]; diaPico = t[i]; } }
  }
  if (pico === null) return null;
  if (actual === null) actual = pico;
  const nivel = pico >= u.q20 ? 3 : pico >= u.q5 ? 2 : pico >= u.q2 ? 1 : 0;
  const tendencia = pico > actual * 1.15 ? "creciendo" : pico < actual * 0.85 ? "bajando" : "estable";
  return { nivel, pico, diaPico, actual, tendencia, q2: u.q2, q5: u.q5, q20: u.q20, mediana: u.mediana };
}

const PRECAUCIONES_CRECIDA = [
  [],
  ["Mantenete informado: seguí las indicaciones de Defensa Civil y del INA (ina.gob.ar).",
    "No acampes ni dejes vehículos cerca de la orilla o en cauces secos.",
    "Con lluvia, evitá cruzar ríos, arroyos y calles anegadas."],
  ["Alejate de la costa y de zonas bajas cercanas al río. Preparate por si hay que evacuar.",
    "Dejá a mano documentos, medicamentos, linterna, batería externa y agua.",
    "Subí a lugares altos objetos de valor y cortá la luz en sectores que puedan inundarse.",
    "No cruces zonas inundadas ni a pie ni en auto: 30 cm de agua en movimiento pueden arrastrar un vehículo."],
  ["Riesgo de crecida grave. Si estás en zona baja o cerca del río, seguí las órdenes de evacuación sin demoras.",
    "Llamá al 103 (Defensa Civil) o al 911 si hay peligro. Avisá a vecinos que necesiten ayuda.",
    "No vuelvas a la zona hasta que las autoridades lo indiquen.",
    "Alejate de cables caídos y no toques artefactos eléctricos mojados."],
];

// ============================================================
// NOMBRE DEL LUGAR A PARTIR DE LAS COORDENADAS
// ============================================================
// [nombre, provincia, latitud, longitud]. Sirve cuando el servicio de nombres no responde.
const CIUDADES = [
  ["Buenos Aires", "Ciudad de Buenos Aires", -34.61, -58.38], ["La Plata", "Buenos Aires", -34.92, -57.95],
  ["Mar del Plata", "Buenos Aires", -38.00, -57.55], ["Bahía Blanca", "Buenos Aires", -38.72, -62.27],
  ["Tandil", "Buenos Aires", -37.32, -59.13], ["Olavarría", "Buenos Aires", -36.89, -60.32],
  ["Junín", "Buenos Aires", -34.59, -60.95], ["Pergamino", "Buenos Aires", -33.89, -60.57],
  ["San Nicolás", "Buenos Aires", -33.33, -60.21], ["Zárate", "Buenos Aires", -34.10, -59.03],
  ["Luján", "Buenos Aires", -34.57, -59.11], ["Azul", "Buenos Aires", -36.78, -59.86],
  ["Necochea", "Buenos Aires", -38.55, -58.74], ["Pehuajó", "Buenos Aires", -35.81, -61.90],
  ["Trenque Lauquen", "Buenos Aires", -35.97, -62.73], ["Chivilcoy", "Buenos Aires", -34.90, -60.02],
  ["Tres Arroyos", "Buenos Aires", -38.37, -60.28], ["Coronel Suárez", "Buenos Aires", -37.46, -61.93],
  ["Santa Rosa", "La Pampa", -36.62, -64.29], ["General Pico", "La Pampa", -35.66, -63.76],
  ["Neuquén", "Neuquén", -38.95, -68.06], ["Zapala", "Neuquén", -38.90, -70.07],
  ["San Martín de los Andes", "Neuquén", -40.16, -71.35], ["Cutral Có", "Neuquén", -38.94, -69.23],
  ["Bariloche", "Río Negro", -41.13, -71.31], ["Viedma", "Río Negro", -40.81, -63.00],
  ["General Roca", "Río Negro", -39.03, -67.58], ["El Bolsón", "Río Negro", -41.96, -71.53],
  ["Esquel", "Chubut", -42.91, -71.32], ["Trelew", "Chubut", -43.25, -65.31],
  ["Puerto Madryn", "Chubut", -42.77, -65.04], ["Comodoro Rivadavia", "Chubut", -45.87, -67.50],
  ["Río Gallegos", "Santa Cruz", -51.62, -69.22], ["El Calafate", "Santa Cruz", -50.34, -72.26],
  ["Río Grande", "Tierra del Fuego", -53.79, -67.70], ["Ushuaia", "Tierra del Fuego", -54.80, -68.30],
  ["Rosario", "Santa Fe", -32.95, -60.64], ["Santa Fe", "Santa Fe", -31.63, -60.70],
  ["Rafaela", "Santa Fe", -31.25, -61.49], ["Venado Tuerto", "Santa Fe", -33.75, -61.97],
  ["Reconquista", "Santa Fe", -29.15, -59.65], ["Paraná", "Entre Ríos", -31.73, -60.53],
  ["Concordia", "Entre Ríos", -31.39, -58.02], ["Gualeguaychú", "Entre Ríos", -33.01, -58.52],
  ["Córdoba", "Córdoba", -31.42, -64.18], ["Río Cuarto", "Córdoba", -33.13, -64.35],
  ["Villa María", "Córdoba", -32.41, -63.24], ["San Francisco", "Córdoba", -31.43, -62.08],
  ["Villa Carlos Paz", "Córdoba", -31.42, -64.50], ["Mendoza", "Mendoza", -32.89, -68.84],
  ["San Rafael", "Mendoza", -34.62, -68.33], ["Malargüe", "Mendoza", -35.47, -69.58],
  ["San Juan", "San Juan", -31.54, -68.54], ["San Luis", "San Luis", -33.30, -66.34],
  ["Villa Mercedes", "San Luis", -33.68, -65.46], ["La Rioja", "La Rioja", -29.41, -66.86],
  ["Catamarca", "Catamarca", -28.47, -65.78], ["San Miguel de Tucumán", "Tucumán", -26.82, -65.22],
  ["Salta", "Salta", -24.79, -65.41], ["Cafayate", "Salta", -26.07, -65.98],
  ["San Salvador de Jujuy", "Jujuy", -24.19, -65.30], ["La Quiaca", "Jujuy", -22.10, -65.60],
  ["Santiago del Estero", "Santiago del Estero", -27.79, -64.26], ["Resistencia", "Chaco", -27.46, -58.98],
  ["Presidente Roque Sáenz Peña", "Chaco", -26.79, -60.44], ["Corrientes", "Corrientes", -27.47, -58.83],
  ["Goya", "Corrientes", -29.14, -59.26], ["Posadas", "Misiones", -27.37, -55.90],
  ["Puerto Iguazú", "Misiones", -25.60, -54.58], ["Formosa", "Formosa", -26.18, -58.17],
];
function ciudadMasCercana(lat, lon) {
  let mejor = null;
  for (const [nombre, prov, la, lo] of CIUDADES) {
    const d = distanciaKm(lat, lon, la, lo);
    if (!mejor || d < mejor.dist) mejor = { nombre, prov, dist: d };
  }
  return mejor;
}
function nombreOffline(lat, lon) {
  const c = ciudadMasCercana(lat, lon);
  return c.dist <= 15 ? `${c.nombre}, ${c.prov}` : `Cerca de ${c.nombre}, ${c.prov}`;
}
// Respuesta del servicio de nombres (BigDataCloud, versión para apps). null si no sirve.
function nombreDesdeReversa(j) {
  if (!j || typeof j !== "object") return null;
  // "city" suele ser el partido o municipio entero (ej. Pilar); "locality" es el barrio o localidad (ej. Villa Rosa).
  // Se muestra la localidad primero para que el nombre cambie al moverse dentro de un mismo partido.
  const loc = (j.locality || "").trim(), ciu = (j.city || "").trim();
  const prov = (j.principalSubdivision || "").replace(/^Provincia (de |del )/i, "").trim();
  const base = loc && ciu && loc.toLowerCase() !== ciu.toLowerCase() ? [loc, ciu] : [loc || ciu, prov];
  const partes = base.filter((v, i, a) => v && a.indexOf(v) === i);
  return partes.length ? partes.join(", ") : null;
}


// ---------- "Qué hacer hoy": decisiones simples a partir del pronóstico ----------
// Devuelve hasta 6 consejos { e: emoji, t: texto } con las próximas horas del pronóstico por hora.
function queHacerHoy(d) {
  if (!d || !d.hourly || !d.current || !d.hourly.time) return [];
  const h = d.hourly, t = h.time, i0 = indiceHoraActual(h, d.current);
  if (i0 >= t.length) return [];
  const num = (arr, i, def) => { const v = arr && arr[i]; return typeof v === "number" && isFinite(v) ? v : def; };
  const fin12 = Math.min(t.length, i0 + 12), finRopa = Math.min(t.length, i0 + 8);
  const out = [];
  const esDiaH = i => (h.is_day ? h.is_day[i] === 1 : true);
  const hora = i => +t[i].slice(11, 13);
  const sens = i => num(h.apparent_temperature, i, num(h.temperature_2m, i, 18));
  // Ropa
  let smin = Infinity, smax = -Infinity;
  for (let i = i0; i < finRopa; i++) { smin = Math.min(smin, sens(i)); smax = Math.max(smax, sens(i)); }
  let ropa;
  if (smax >= 30) ropa = "Ropa liviana y clara; hidratate seguido.";
  else if (smin <= 8) ropa = "Abrigo grueso, y gorro o bufanda si salís temprano o de noche.";
  else if (smax - smin >= 10) ropa = `Salí en capas: ahora ${Math.round(sens(i0))}° y llega a ${Math.round(smax)}°; así te sacás o ponés ropa.`;
  else if (smax <= 15) ropa = "Campera o abrigo: va a estar fresco.";
  else if (smax >= 24) ropa = "Ropa fresca; con una prenda liviana alcanza.";
  else ropa = "Ropa cómoda; una campera liviana por las dudas.";
  out.push({ e: "👕", t: ropa, k: "ropa" });
  // Paraguas
  const ll = lluviaProxima(d);
  out.push(ll ? { e: "☂️", t: ll.ahora ? "Está lloviendo o va a llover en breve: salí con paraguas." : `Salí con paraguas: se anuncia lluvia de ${ll.desde} a ${ll.hasta} h.`, k: "paraguas" }
    : { e: "🌂", t: "No hace falta paraguas en las próximas horas.", k: "paraguas" });
  // Tender la ropa (solo de día)
  if (esDiaH(i0)) {
    const diaFin = Math.min(t.length, i0 + 6);
    let lluvia = false, nubes = 0, n = 0;
    for (let i = i0; i < diaFin; i++) { if (num(h.precipitation_probability, i, 0) >= 30 || num(h.precipitation, i, 0) > 0.1) lluvia = true; nubes += num(h.cloud_cover, i, 40); n++; }
    if (lluvia) out.push({ e: "🧺", t: "Mejor no tender la ropa afuera: puede llover.", k: "tender" });
    else if (n >= 3) out.push({ e: "🧺", t: nubes / n < 60 ? "Buen momento para tender la ropa: sin lluvia y con sol." : "Podés tender la ropa, pero con cielo cubierto se seca más lento.", k: "tender" });
  }
  // Protector solar
  let uvMax = 0, uvH = -1;
  for (let i = i0; i < fin12; i++) { const u = num(h.uv_index, i, 0); if (u > uvMax) { uvMax = u; uvH = hora(i); } }
  if (uvMax >= 6) out.push({ e: "🧴", t: `Usá protector solar (UV ${Math.round(uvMax)}, máximo cerca de las ${uvH} h). Evitá el sol de mediodía.`, k: "uv" });
  // Mejor momento para salir: ventana de 2 horas de día con menos lluvia y temperatura agradable
  let mejor = null;
  for (let i = i0; i + 1 < Math.min(t.length, i0 + 14); i++) {
    if (!esDiaH(i) || !esDiaH(i + 1)) continue;
    const costo = [i, i + 1].reduce((c, k) => c + num(h.precipitation_probability, k, 0) + Math.abs(sens(k) - 21) * 2 + (num(h.wind_speed_10m, k, 0) > 35 ? 20 : 0), 0);
    if (!mejor || costo < mejor.costo) mejor = { costo, i };
  }
  if (mejor) {
    const a = mejor.i, p = Math.max(num(h.precipitation_probability, a, 0), num(h.precipitation_probability, a + 1, 0));
    out.push({ e: "🚶", t: `Mejor momento para salir${t[a].slice(0, 10) !== t[i0].slice(0, 10) ? " mañana" : ""}: de ${hora(a)} a ${(hora(a + 1) + 1) % 24} h (${Math.round(sens(a))}°${p >= 30 ? `, lluvia ${Math.round(p)}%` : ", sin lluvia"}).`, k: "salir" });
  }
  // Lavar el auto: hoy y mañana sin lluvia
  const di = d.daily || {};
  if (!ll && num(di.precipitation_probability_max, 0, 100) < 30 && num(di.precipitation_probability_max, 1, 100) < 30 && esDiaH(i0)) out.push({ e: "🚗", t: "Buen día para lavar el auto: no se espera lluvia hoy ni mañana.", k: "auto" });
  return out.slice(0, 6);
}

// ---------- Viajes: clima de un destino para unas fechas ----------
const VIAJE_MAX_DIAS = 30, VIAJE_HORIZONTE = 16; // el pronóstico llega a 16 días; más allá se estima con años anteriores
const fechaUTC = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const isoDeUTC = ms => new Date(ms).toISOString().slice(0, 10);
const sumarDias = (iso, n) => isoDeUTC(fechaUTC(iso) + n * 86400000);
// Todas las fechas aaaa-mm-dd entre dos fechas, inclusive. [] si el rango no es válido.
function diasEntre(desde, hasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || "") || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || "")) return [];
  const n = Math.round((fechaUTC(hasta) - fechaUTC(desde)) / 86400000);
  if (!(n >= 0) || n > 400) return [];
  return Array.from({ length: n + 1 }, (_, i) => sumarDias(desde, i));
}
// La misma fecha "k" años antes (el 29/02 pasa a 28/02 si ese año no es bisiesto)
function fechaAniosAntes(iso, k) {
  const y = +iso.slice(0, 4) - k, m = iso.slice(5, 7), d = iso.slice(8, 10);
  const f = new Date(Date.UTC(y, +m - 1, +d));
  return f.getUTCMonth() === +m - 1 ? isoDeUTC(f.getTime()) : `${y}-${m}-28`;
}
// Promedia varios años del archivo histórico. archivos[j] = respuesta "daily" del año j+1 para las mismas fechas (en orden).
// Devuelve { fecha: { max, min, prob (% de años con lluvia), mm, codigo, anios } }
function tipicosDeArchivos(fechas, archivos) {
  const out = {};
  fechas.forEach((f, i) => {
    const v = (archivos || []).map(a => a && a.time && a.time.length === fechas.length ? {
      max: a.temperature_2m_max[i], min: a.temperature_2m_min[i], mm: a.precipitation_sum[i], cod: a.weather_code ? a.weather_code[i] : null } : null)
      .filter(x => x && typeof x.max === "number" && typeof x.min === "number");
    if (!v.length) return;
    const media = k => v.reduce((t, x) => t + x[k], 0) / v.length;
    const lluvias = v.filter(x => (x.mm || 0) >= 1).length;
    const cuenta = {}; v.forEach(x => { if (x.cod != null) cuenta[x.cod] = (cuenta[x.cod] || 0) + 1; });
    let codigo = +Object.keys(cuenta).sort((p, q) => cuenta[q] - cuenta[p])[0];
    if (!isFinite(codigo)) codigo = lluvias * 2 > v.length ? 61 : 2;
    out[f] = { max: media("max"), min: media("min"), prob: Math.round(100 * lluvias / v.length), mm: media("mm") || 0, codigo, anios: v.length };
  });
  return out;
}
// Une pronóstico (diario de la API) y estimaciones históricas en una lista por día.
function armarDiasViaje(fechas, pron, tipicos) {
  const ix = {}; ((pron && pron.time) || []).forEach((t, i) => { ix[t] = i; });
  return fechas.map(f => {
    const i = ix[f], g = k => (pron && pron[k] ? pron[k][i] : null);
    if (i != null && typeof g("temperature_2m_max") === "number") {
      return { f, fuente: "pron", max: g("temperature_2m_max"), min: g("temperature_2m_min"), prob: g("precipitation_probability_max") ?? 0,
        mm: g("precipitation_sum") ?? 0, viento: g("wind_speed_10m_max") ?? 0, uv: g("uv_index_max") ?? 0, codigo: g("weather_code") ?? 2 };
    }
    const t = tipicos && tipicos[f];
    return t ? { f, fuente: "tipico", max: t.max, min: t.min, prob: t.prob, mm: t.mm, viento: 0, uv: 0, codigo: t.codigo } : { f, fuente: null };
  });
}
const diaConLluvia = d => d.fuente && (d.fuente === "tipico" ? d.prob >= 50 : (d.prob >= 50 || d.mm >= 2));
function resumenViaje(dias) {
  const v = dias.filter(d => d.fuente);
  if (!v.length) return null;
  return { max: Math.max(...v.map(d => d.max)), min: Math.min(...v.map(d => d.min)), lluviosos: v.filter(diaConLluvia).length, total: v.length,
    viento: Math.max(...v.map(d => d.viento || 0)), uv: Math.max(...v.map(d => d.uv || 0)), pron: v.filter(d => d.fuente === "pron").length, tipicos: v.filter(d => d.fuente === "tipico").length };
}
// Qué llevar en la valija
function consejosViaje(dias) {
  const r = resumenViaje(dias); if (!r) return [];
  const out = [], R = Math.round;
  if (r.min <= 10) out.push(`🧥 Abrigo de verdad: las mínimas llegan a ${R(r.min)}°.`);
  else if (r.min <= 16) out.push(`🧥 Una campera o buzo para la noche (mínima ${R(r.min)}°).`);
  if (r.max >= 30) out.push(`👕 Ropa liviana y fresca: llegan a ${R(r.max)}° de máxima.`);
  if (r.max - r.min >= 14) out.push("🧅 Ropa en capas: hay mucha diferencia entre el día y la noche.");
  if (r.lluviosos > 0) out.push(`☂️ Paraguas o piloto: probable lluvia ${r.lluviosos} de ${r.total} día${r.total > 1 ? "s" : ""}.`);
  if (r.max >= 26 || r.uv >= 6) out.push("🧴 Protector solar, gorro y lentes de sol.");
  if (r.viento >= 40) out.push("💨 Algún día con viento fuerte: una campera que corte el viento.");
  if (!out.length) out.push("👕 Ropa cómoda de entretiempo; con una campera liviana alcanza.");
  return out;
}
// Días que faltan para el viaje (0 = empieza hoy; negativo = ya empezó)
const diasHastaViaje = (desde, hoy) => Math.round((fechaUTC(desde) - fechaUTC(hoy)) / 86400000);

// ---------- Avisos antes de las actividades con horario propio ----------
// Arma los avisos de los próximos 2 días que la parte nativa envía "antesMin" minutos antes de cada actividad.
// acts: actividades del usuario; horarios: { id: {dias, desde, hasta} }; solDe(dia) opcional (luz natural).
function recordatoriosActividad(datos, acts, horarios, opciones) {
  const o = opciones || {};
  const ahora = o.ahoraMs != null ? o.ahoraMs : Date.now(), antesMin = o.antesMin || 60;
  const out = [];
  if (!datos || !datos.daily || !datos.hourly) return out;
  const off = datos.utc_offset_seconds != null ? datos.utc_offset_seconds : -new Date(ahora).getTimezoneOffset() * 60;
  (acts || []).forEach(a => {
    const hr = (horarios || {})[a.id]; if (!hr) return;
    const rg = rangoHorario(hr); if (!rg) return;
    for (let dia = 0; dia < 3; dia++) {
      const f = (datos.daily.time || [])[dia]; if (!f || !hr.dias.includes(diaSemanaDe(f))) continue;
      const base = Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) - off * 1000;
      const inicio = base + rg[0] * 60000, fin = base + rg[1] * 60000, fire = inicio - antesMin * 60000;
      if (fire <= ahora || fire > ahora + 48 * 3600000) continue;
      const r = evaluarHorario(datos, a, dia, hr, o.solDe ? o.solDe(dia) : null);
      if (!r || r.pasado || r.sinDatos) continue;
      const st = r.stats, notas = (r.precauciones || []).slice(0, 6);
      const t1 = Math.round(st.tempMin), t2 = Math.round(st.tempMax);
      const resumen = `🌡️ ${t1 === t2 ? t1 + "°" : t1 + "° a " + t2 + "°"} · 💨 ${Math.round(st.viento)} km/h · 🌧 ${Math.round(st.prob)}%`;
      const cuando = dia === 0 ? "hoy" : dia === 1 ? "mañana" : "";
      out.push({
        id: `${a.id}|${f}`, fire, inicio, fin,
        titulo: `${a.emoji} ${a.nombre} ${cuando ? cuando + " " : ""}a las ${hr.desde} · ${r.veredicto.texto}`,
        corto: (r.avisos && r.avisos.length ? r.avisos.slice(0, 2).map(x => x.split(/(?<=\.)\s/)[0]).join(" ") : resumen),
        largo: `${resumen}\n` + notas.join("\n"),
      });
    }
  });
  out.sort((x, y) => x.fire - y.fire);
  return out.slice(0, 12);
}

// ---------- resumen repetido y paraguas ----------
const LLUVIA_PROB_HORA = 40, LLUVIA_MM_HORA = 0.5; // mismos umbrales que la parte nativa (Pronostico.java)
// Horas del día en que llega el resumen repetido: desde la hora del diario, cada N horas, hasta la hora límite.
function horasRepeticion(hora, cada, hasta) {
  const m = s => { const x = /^(\d{1,2}):(\d{2})$/.exec(s || ""); return x ? +x[1] * 60 + +x[2] : null; };
  const h0 = m(hora), h1 = m(hasta); const out = [];
  if (h0 === null || h1 === null || !(cada === 4 || cada === 5)) return out;
  for (let t = h0 + cada * 60; t <= h1; t += cada * 60) out.push(String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"));
  return out;
}
// ¿Llueve ahora o va a llover en las próximas 12 horas? -> {ahora, desde, hasta, prob} o null
function lluviaProxima(d) {
  if (!d || !d.hourly || !d.current) return null;
  const h = d.hourly, t = h.time || [], i0 = indiceHoraActual(h, d.current);
  const llueve = i => (+(h.precipitation_probability || [])[i] || 0) >= LLUVIA_PROB_HORA || (+(h.precipitation || [])[i] || 0) >= LLUVIA_MM_HORA;
  let d0 = -1, d1 = -1, prob = 0;
  for (let i = i0; i < Math.min(t.length, i0 + 12); i++) {
    if (llueve(i)) { if (d0 < 0) d0 = i; d1 = i; prob = Math.max(prob, +(h.precipitation_probability || [])[i] || 0); }
  }
  if (d0 < 0) return null;
  const hh = x => horaTxt(x).replace(/^0/, "").replace(/:00$/, "");
  return { ahora: d0 === i0, desde: hh(t[d0]), hasta: hh(t[d1 + 1] || t[d1]), prob };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VIAJE_MAX_DIAS, VIAJE_HORIZONTE, diasEntre, sumarDias, fechaAniosAntes, tipicosDeArchivos, armarDiasViaje, resumenViaje, consejosViaje, diasHastaViaje, diaConLluvia,
    queHacerHoy, recordatoriosActividad,
    horasRepeticion, lluviaProxima,
    PARAMS, dato, describir, icono, gradiente, nivelUV, indiceHoraActual, analizarRadarSatelite,
    condicionMoto, condicionAuto, condicionCaminando, resumenDia, alertasClima, FENOMENOS, NIVELES,
    PRECAUCIONES, precauciones, distanciaKm, traducirLugar, textoHace, urlSismos, filtrarSismos,
    cercaDeCosta, faseLunar, astrosDelDia, proximasFases, emojiFase, titularFase, ACTIVIDADES, evaluarActividad, actividadesDelDia,
    notasClima, evaluarHorario, rangoHorario, limpiarHorarios, horarioDiasTxt, diaSemanaDe, DIAS_CORTOS, condicionCielo, CIUDADES, ciudadMasCercana,
    umbralesCrecida, evaluarCrecida, PRECAUCIONES_CRECIDA, URL_CRECIDA_HIST, URL_CRECIDA_PRON, nombreOffline, nombreDesdeReversa, horaActualDe, fenomenoSmn, precaucionesSmn, estiloNivelSmn, vigenciaSmn, NIVEL_SMN,
  };
}
