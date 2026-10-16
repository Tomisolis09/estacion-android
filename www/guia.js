"use strict";
// ============================================================
// GUÍA DE USO: se muestra al instalar (después de la bienvenida) y queda en Ajustes → "Cómo usar la app".
// ============================================================
const GUIA = [
  { e: "👋", t: "Qué es esta app", tab: null, p: [
    "Te muestra el clima de donde estás: ahora, hora por hora y los próximos días, con avisos y consejos para tus actividades.",
    "Los datos vienen de Open-Meteo (pronóstico), el Servicio Meteorológico Nacional (alertas), el Servicio Geológico de EE. UU. (sismos) y GloFAS (ríos).",
    "⚠️ No es una app oficial ni de emergencias. Son estimaciones: ante una alerta seria, seguí las indicaciones de Defensa Civil y del SMN.",
  ] },
  { e: "📍", t: "Tu ubicación y el GPS", tab: null, p: [
    "Con el GPS activado, la ubicación te sigue sola: si te movés más de 2 km, la app actualiza el clima, el widget y los avisos.",
    "Arriba ves el nombre del lugar. Tocalo para buscar otra ciudad a mano (útil para ver el clima de un viaje). Al elegir un lugar a mano, el GPS se apaga.",
    "Para volver a seguir tu ubicación: Ajustes → “Seguir mi ubicación (GPS)”. El botón de arriba a la derecha (⟳) actualiza todo al instante.",
    "Si el GPS no encuentra tu lugar: revisá que esté prendido, que la app tenga permiso de ubicación y probá al aire libre o cerca de una ventana.",
  ] },
  { e: "🏠", t: "Hoy", tab: "hoy", p: [
    "Es la pantalla principal: temperatura actual, sensación térmica, máxima y mínima. La frase de abajo va rotando con datos útiles (lluvia, radar, paraguas).",
    "☂️ Si se anuncia lluvia en las próximas horas aparece el cartel “Salí con paraguas” con el horario aproximado.",
    "Más abajo: próximas horas, próximos 3 días, sol y luna, y datos de ahora (viento, humedad, UV, presión). El UV te dice cuándo usar protector solar.",
    "Si hay una alerta del SMN, un sismo cercano o riesgo de crecida, aparece un aviso arriba: tocalo para ver los detalles.",
  ] },
  { e: "🕒", t: "Horas y Días", tab: "horas", p: [
    "Horas: el pronóstico de las próximas horas con temperatura, probabilidad de lluvia, viento y UV. Sirve para elegir el momento de salir.",
    "Días: el pronóstico de la semana. Tocá un día para ver el detalle: máxima, mínima, lluvia acumulada, viento, UV, salida y puesta del sol.",
    "La probabilidad de lluvia es la chance de que llueva en esa hora o día; los milímetros indican cuánta agua se espera.",
  ] },
  { e: "📡", t: "Radar y satélite", tab: "radar", p: [
    "Muestra la lluvia estimada y la nubosidad cerca tuyo, para saber si se acerca una tormenta.",
    "Son estimaciones del modelo meteorológico, no un radar real: usalas como orientación y mirá también el cielo.",
    "El resumen de abajo dice en palabras si se espera lluvia o cielo despejado en las próximas horas.",
  ] },
  { e: "🏃", t: "Actividades", tab: "activ", p: [
    "Elegí tus deportes en Ajustes → “Mis deportes y actividades” (también podés crear los tuyos). La solapa muestra solo esos.",
    "Cada actividad tiene un puntaje (Ideal, Bueno, Regular, No recomendable), el mejor horario del día y las precauciones según el clima.",
    "Tocá una actividad y después “Mis días y horario”: cargá los días y la hora en que la hacés (por ejemplo Lun y Mié de 18:00 a 19:30).",
    "Entonces la app te muestra el clima hora por hora de ese horario y las precauciones para ese momento: paraguas, viento, calor, frío, UV, anochecer o niebla. Arriba aparece tu agenda de los próximos días.",
    "Podés cambiar el día con los botones de arriba (Hoy, Mañana…).",
  ] },
  { e: "🔭", t: "Planetas", tab: "planetas", p: [
    "Te dice qué planetas se ven a simple vista esta noche desde tu ubicación, en qué horario y hacia dónde mirar (punto cardinal y altura; un puño con el brazo estirado ≈ 10°).",
    "Tiene en cuenta el clima: si hay nubes, lluvia o niebla a esa hora, avisa que quizás no se vea. Verde = buena chance, naranja = pueden taparlo las nubes.",
    "Tocá un día de la tira de abajo para ver otras noches. También te sugiere la próxima noche con cielo más despejado.",
    "Para ver mejor: alejate de luces fuertes, esperá unos minutos a que se acostumbre la vista y mirá hacia el horizonte indicado.",
  ] },
  { e: "⚠️", t: "Avisos", tab: "avisos", p: [
    "Alertas oficiales del SMN para tu zona (tormentas, viento, calor, frío, niebla…) con nivel de color, horario y qué hacer.",
    "Ríos e inundaciones: estima si el río cercano puede crecer en los próximos días. Es una estimación, no un aviso oficial de evacuación.",
    "Sismos y tsunami: terremotos recientes cerca tuyo, con distancia y magnitud.",
    "Movilidad: cómo está el día para moto, auto y caminar.",
  ] },
  { e: "🔔", t: "Notificaciones", tab: null, ajustes: true, p: [
    "Resumen diario: a la hora que elijas te dice cómo está hoy y mañana.",
    "Repetir durante el día: te manda el clima actualizado cada 4 o 5 horas, hasta la hora límite que pongas (viene desactivado, se activa en Ajustes).",
    "☂️ Si se anuncia lluvia, los resúmenes te avisan que salgas con paraguas y a qué hora llueve.",
    "Resumen de la semana: un día y hora a elección, con cómo va a estar la semana.",
    "Alertas: avisos del SMN, sismos y crecidas de ríos, con sensibilidad ajustable.",
    "Si no te llegan: aceptá el permiso de notificaciones, y en el celular desactivá el ahorro de batería para esta app. En Ajustes hay botones de prueba y un “Diagnóstico”.",
  ] },
  { e: "🧩", t: "Widget", tab: null, ajustes: true, p: [
    "El widget muestra en tu pantalla de inicio la temperatura, tu ubicación y los próximos 3 días, sin abrir la app.",
    "Para agregarlo: Ajustes → “Agregar widget a la pantalla de inicio”, o mantené apretada la pantalla de inicio → Widgets → “Estación”.",
    "Se actualiza solo cada cierto tiempo y cuando abrís la app. Si dice que no hay datos, abrí la app una vez con internet.",
  ] },
  { e: "⚙️", t: "Ajustes, opinión y errores", tab: null, ajustes: true, p: [
    "En ⚙️ Ajustes cambiás la ubicación, las actividades, las notificaciones, el tema (claro, oscuro o automático) y esta guía.",
    "La app guarda los últimos datos para gastar menos internet y mostrarte algo aunque no tengas señal. Tocá ⟳ para actualizar.",
    "💬 Opinión: cada 5 veces que abrís la app aparece una tarjeta en Hoy para contarnos cómo te va o avisar un error. Podés desactivarla en Ajustes → “Opiniones y errores”.",
    "Tu privacidad: la ubicación se usa para pedir el clima y no se guarda en ningún servidor propio. Más detalles en la política de privacidad.",
  ] },
];

function abrirGuia(inicio) {
  let i = Math.max(0, Math.min(GUIA.length - 1, inicio || 0)), indice = inicio === "indice";
  if (indice) i = 0;
  const pintar = () => {
    if (indice) {
      mostrarHoja2(`<h3>📖 Cómo usar la app</h3>
        <p class="sutil" style="margin:0">Tocá un tema para ver cómo funciona.</p>
        <div class="bloque">${GUIA.map((g, k) => `<button class="fila-aj" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font:inherit;cursor:pointer" data-gtema="${k}"><div class="tx"><b>${g.e} ${g.t}</b></div><span aria-hidden="true">›</span></button>`).join("")}</div>
        <button class="btn" id="g-empezar">Ver la guía paso a paso</button>
        <button class="btn sec" id="g-cerrar">Cerrar</button>`);
    } else {
      const g = GUIA[i], ult = i === GUIA.length - 1;
      mostrarHoja2(`<div style="display:flex;justify-content:space-between;align-items:center"><span class="sutil">Paso ${i + 1} de ${GUIA.length}</span><button class="chip" id="g-indice" type="button">☰ Temas</button></div>
        <h3>${g.e} ${g.t}</h3>
        <div class="guia-txt">${g.p.map(x => `<p>${esc(x)}</p>`).join("")}</div>
        <div class="guia-pts" aria-hidden="true">${GUIA.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
        ${g.tab ? `<button class="btn sec" id="g-ir">Ir a esta pantalla</button>` : ""}
        <div style="display:flex;gap:8px"><button class="btn sec" id="g-ant" ${i === 0 ? "disabled" : ""}>‹ Anterior</button><button class="btn" id="g-sig">${ult ? "Listo" : "Siguiente ›"}</button></div>`);
    }
    const h = $("#hoja2in");
    const on = (id, f) => { const b = h.querySelector(id); if (b) b.onclick = f; };
    h.querySelectorAll("[data-gtema]").forEach(b => b.onclick = () => { indice = false; i = +b.dataset.gtema; pintar(); });
    on("#g-empezar", () => { indice = false; i = 0; pintar(); });
    on("#g-cerrar", cerrarHoja2);
    on("#g-indice", () => { indice = true; pintar(); });
    on("#g-ant", () => { if (i > 0) { i--; pintar(); } });
    on("#g-sig", () => { if (i < GUIA.length - 1) { i++; pintar(); } else cerrarHoja2(); });
    on("#g-ir", () => { cerrarHoja2(); estado.tab = GUIA[i].tab; guardar("tab", estado.tab); render(); const v = $("#vista"); if (v) v.scrollTop = 0; });
  };
  guardar("guia", { vista: true });
  pintar();
}
