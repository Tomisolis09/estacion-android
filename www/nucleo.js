"use strict";
// ============================================================
// NÚCLEO: constantes, utilidades y lógica pura (sin interfaz).
// Se usa en la app y se prueba en Node (ver tests/).
// ============================================================
const URL_CLIMA = "https://api.open-meteo.com/v1/forecast";
const URL_GEO = "https://geocoding-api.open-meteo.com/v1/search";
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
// FASE LUNAR (aproximada, para observación de estrellas)
// ============================================================
function faseLunar(fecha = new Date()) {
  const jd = fecha.getTime() / 86400000 + 2440587.5;
  const fase = (((jd - 2451550.26) / 29.530588853) % 1 + 1) % 1;
  const iluminacion = (1 - Math.cos(2 * Math.PI * fase)) / 2;
  const nombre = fase < 0.03 || fase > 0.97 ? "nueva" : fase < 0.22 ? "creciente" : fase < 0.28 ? "en cuarto creciente"
    : fase < 0.47 ? "gibosa creciente" : fase < 0.53 ? "llena" : fase < 0.72 ? "gibosa menguante"
    : fase < 0.78 ? "en cuarto menguante" : "menguante";
  return { fase, iluminacion, nombre };
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
  if (a.id === "astro") {
    const f = faseLunar(new Date(fecha + "T22:00:00"));
    puntaje -= Math.max(0, f.iluminacion - 0.4) * 40;
    notas.push(`🌙 Luna ${f.nombre} (${Math.round(f.iluminacion * 100)}% iluminada): ` + (f.iluminacion > 0.6 ? "su brillo dificulta ver estrellas débiles." : "buen momento para observar."));
  }
  puntaje = Math.max(0, Math.min(100, puntaje));

  if (motivos.has("tormenta")) notas.push("⛈️ Hay riesgo de tormenta eléctrica en ese horario: no lo hagas al aire libre.");
  if (stats.sensMax >= 35) notas.push("🥵 Calor intenso: evitá el esfuerzo fuerte, hidratate y buscá sombra.");
  else if (stats.sensMax >= 30) notas.push("🌡️ Hace calor: tomá agua antes y durante, y usá ropa liviana.");
  if (stats.sensMin <= 0) notas.push("🧊 Posible hielo en el piso: cuidado con los resbalones. Abrigate bien.");
  else if (stats.sensMin <= 8) notas.push("🧥 Hace frío: abrigate en capas.");
  if (stats.uv >= 8) notas.push(`☀️ UV ${nivelUV(stats.uv).toLowerCase()} (${stats.uv.toFixed(1)}): protector solar, gorra y anteojos.`);
  else if (stats.uv >= 6) notas.push(`☀️ UV alto (${stats.uv.toFixed(1)}): usá protector solar.`);
  if (stats.prob >= 40) notas.push(`☂️ Posible lluvia (${Math.round(stats.prob)}%): llevá impermeable.`);
  if (stats.rafaga >= 40) notas.push(`💨 Ráfagas de hasta ${Math.round(stats.rafaga)} km/h: asegurá tus cosas y tené cuidado.`);
  if (motivos.has("niebla")) notas.push("🌫️ Visibilidad reducida: extremá las precauciones.");

  return {
    id: a.id, nombre: a.nombre, emoji: a.emoji, sinHorario: false,
    puntaje: Math.round(puntaje), veredicto: veredicto(puntaje),
    ventana: `${fmtHora(w[0].H)}–${fmtHora(w[w.length - 1].H + 1)}`,
    stats, motivos: [...motivos], precauciones: notas.concat(a.tips),
  };
}

function actividadesDelDia(datos, dia) {
  return ACTIVIDADES.map(a => evaluarActividad(datos, a, dia)).filter(Boolean)
    .sort((x, y) => y.puntaje - x.puntaje);
}

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
  const lugar = (j.city || j.locality || "").trim();
  const prov = (j.principalSubdivision || "").replace(/^Provincia (de |del )/i, "").trim();
  const partes = [lugar, prov].filter((v, i, a) => v && a.indexOf(v) === i);
  return partes.length ? partes.join(", ") : null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PARAMS, dato, describir, icono, gradiente, nivelUV, indiceHoraActual, analizarRadarSatelite,
    condicionMoto, condicionAuto, condicionCaminando, resumenDia, alertasClima, FENOMENOS, NIVELES,
    PRECAUCIONES, precauciones, distanciaKm, traducirLugar, textoHace, urlSismos, filtrarSismos,
    cercaDeCosta, faseLunar, ACTIVIDADES, evaluarActividad, actividadesDelDia, CIUDADES, ciudadMasCercana,
    nombreOffline, nombreDesdeReversa, horaActualDe, fenomenoSmn, precaucionesSmn, estiloNivelSmn, vigenciaSmn, NIVEL_SMN,
  };
}
