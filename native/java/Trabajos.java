package __PKG__;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** Lo que se hace cuando suena una alarma: bajar datos y avisar. */
final class Trabajos {

    private Trabajos() {}

    private static final String ETQ = "EstacionClima";
    private static final Locale AR = new Locale("es", "AR");
    private static final long HORA_MS = 3600L * 1000;

    static void ejecutar(Context c, String accion) {
        try {
            if (Programador.ACCION_DIARIO.equals(accion)) diario(c, false);
            else if (Programador.ACCION_SEMANAL.equals(accion)) semanal(c, false);
            else if (Programador.ACCION_ALERTAS.equals(accion)) alertas(c);
        } catch (Throwable t) {
            Log.e(ETQ, "Error en " + accion, t);
        }
    }

    // ------------------------------------------------------------------
    // Resúmenes
    // ------------------------------------------------------------------

    private static String fechaHoy(long ahora) {
        return new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date(ahora));
    }

    /** En las pruebas, si algo falla se avisa con una notificación en vez de no mostrar nada. */
    private static void avisoPrueba(Context c, String titulo, String detalle) {
        Notificador.mostrar(c, 3998, Notificador.CANAL_RESUMEN, "(Prueba) " + titulo, detalle, detalle);
    }

    static void diario(Context c, boolean forzar) {
        Ajustes a = Prefs.ajustes(c);
        Prefs.Ubic u = Prefs.ubicacion(c);
        if (u == null) {
            if (forzar) avisoPrueba(c, "Falta la ubicación", "Abrí la app y elegí tu ubicación (GPS o a mano).");
            return;
        }
        if (!forzar && (a == null || !a.diarioOn)) return;
        try {
            Pronostico p = Datos.pronostico(c, u, true, 9000, forzar ? 0 : Datos.TTL_MS);
            Resumen.Texto t = Resumen.diario(p, u.nombre);
            Notificador.mostrar(c, 1001, Notificador.CANAL_RESUMEN, t.titulo, t.corto, t.largo);
            if (!forzar) Prefs.marcarEnvio(c, "diario", fechaHoy(System.currentTimeMillis()));
        } catch (IOException e) {
            Log.w(ETQ, "Resumen diario sin datos: " + e.getMessage());
            if (forzar) avisoPrueba(c, "Sin datos del clima", "No se pudo bajar el pronóstico: " + Datos.ultimoError);
        }
        WidgetProvider.refrescarTodosYa(c, false);
    }

    static void semanal(Context c, boolean forzar) {
        Ajustes a = Prefs.ajustes(c);
        Prefs.Ubic u = Prefs.ubicacion(c);
        if (u == null) {
            if (forzar) avisoPrueba(c, "Falta la ubicación", "Abrí la app y elegí tu ubicación (GPS o a mano).");
            return;
        }
        if (!forzar && (a == null || !a.semanalOn)) return;
        try {
            Pronostico p = Datos.pronostico(c, u, true, 9000, forzar ? 0 : Datos.TTL_MS);
            Resumen.Texto t = Resumen.semanal(p, u.nombre);
            Notificador.mostrar(c, 1002, Notificador.CANAL_RESUMEN, t.titulo, t.corto, t.largo);
            if (!forzar) Prefs.marcarEnvio(c, "semanal", fechaHoy(System.currentTimeMillis()));
        } catch (IOException e) {
            Log.w(ETQ, "Resumen semanal sin datos: " + e.getMessage());
            if (forzar) avisoPrueba(c, "Sin datos del clima", "No se pudo bajar el pronóstico: " + Datos.ultimoError);
        }
    }

    /**
     * Android puede demorar o saltear una alarma (ahorro de batería, modo Doze). Esta revisión corre cada
     * 30 minutos: si el resumen de hoy ya debió salir (hasta 4 horas antes) y no salió, se envía ahora.
     * No se envía si el usuario cambió el horario después de que ese horario ya había pasado.
     */
    private static void ponerAlDia(Context c, Ajustes a) {
        long ahora = System.currentTimeMillis();
        String hoy = fechaHoy(ahora);
        long cambio = Prefs.ajustesMomento(c);
        TimeZone zona = TimeZone.getDefault();
        if (a.diarioOn && !hoy.equals(Prefs.envio(c, "diario"))) {
            long prog = Tiempo.hoyA(ahora, a.diarioH, a.diarioM, zona);
            if (ahora >= prog && ahora - prog <= 4 * HORA_MS && prog >= cambio) diario(c, false);
        }
        if (a.semanalOn && !hoy.equals(Prefs.envio(c, "semanal"))
                && Calendar.getInstance(zona).get(Calendar.DAY_OF_WEEK) == a.semanalDia) {
            long prog = Tiempo.hoyA(ahora, a.semanalH, a.semanalM, zona);
            if (ahora >= prog && ahora - prog <= 4 * HORA_MS && prog >= cambio) semanal(c, false);
        }
    }

    // ------------------------------------------------------------------
    // Alertas
    // ------------------------------------------------------------------

    static void alertas(Context c) {
        Ajustes a = Prefs.ajustes(c);
        Prefs.Ubic u = Prefs.ubicacion(c);
        if (a == null || u == null) return;
        // El widget se mantiene al día en cada revisión periódica (si hay uno en la pantalla de inicio)
        WidgetProvider.refrescarTodosYa(c, true);
        try {
            ponerAlDia(c, a);
        } catch (Throwable t) {
            Log.w(ETQ, "Resúmenes atrasados: " + t);
        }
        if (a.alertasClima) {
            try {
                alertasClima(c, u);
            } catch (Throwable t) {
                Log.w(ETQ, "Alertas del SMN: " + t);
            }
        }
        if (a.alertasInundaciones) {
            try {
                alertasInundaciones(c, u);
            } catch (Throwable t) {
                Log.w(ETQ, "Crecida de ríos: " + t);
            }
        }
        if (a.alertasSismos) {
            try {
                alertasSismos(c, u, a);
            } catch (Throwable t) {
                Log.w(ETQ, "Sismos: " + t);
            }
        }
    }

    private static String emojiNivel(String nivel) {
        if ("rojo".equals(nivel)) return "🔴";
        if ("naranja".equals(nivel)) return "🟠";
        return "🟡";
    }

    private static String hora(long ms, String patron) {
        return new SimpleDateFormat(patron, AR).format(new Date(ms));
    }

    private static void alertasClima(Context c, Prefs.Ubic u) {
        long ahora = System.currentTimeMillis();
        File cache = new File(c.getCacheDir(), "smn");
        Smn.Resultado r = Smn.consultar(cache, u.lat, u.lon, ahora, 7000, Http.RED);
        if (!r.ok) return;
        for (Smn.Alerta al : r.alertas) {
            if (al.desde > ahora + 48 * HORA_MS) continue; // se avisará más cerca de la fecha
            String clave = "smn|" + al.evento + "|" + al.nivel + "|" + (al.desde / (24 * HORA_MS));
            if (Prefs.yaAvisado(c, clave)) continue;
            mostrarAlertaSmn(c, u, al);
            Prefs.marcarAvisado(c, clave);
        }
    }

    /** El caudal se actualiza una vez por día: se consulta como mucho cada 3 horas y solo si hay un río importante cerca. */
    private static void alertasInundaciones(Context c, Prefs.Ubic u) throws IOException {
        revisarRio(c, u, false);
    }

    /**
     * Revisa el caudal del río cercano. forzar = true (botón de prueba): ignora el límite de 3 horas y el aviso
     * ya enviado, y siempre deja un texto con el resultado (también si no hay nada que avisar).
     */
    private static String revisarRio(Context c, Prefs.Ubic u, boolean forzar) throws IOException {
        double[] q = Prefs.crecida(c, u.lat, u.lon);
        if (q == null) {
            String m = "Sin umbrales de crecida guardados para esta ubicación (no hay un río importante a ~5 km, o falta abrir la solapa Avisos con internet para calcularlos).";
            Prefs.guardarEstadoRio(c, m);
            return m;
        }
        long ahora = System.currentTimeMillis();
        if (!forzar && ahora - Prefs.ultimoRio(c) < 3 * HORA_MS) return "";
        String json;
        try {
            json = Http.get(Inundaciones.url(u.lat, u.lon, Prefs.claveOm(c)), 8000);
        } catch (IOException e) {
            Prefs.guardarEstadoRio(c, "No se pudo consultar el servicio de ríos: " + e.getMessage());
            throw e;
        }
        Prefs.marcarRio(c);
        Inundaciones.Resultado r = Inundaciones.evaluar(json, q[0], q[1], q[2], hora(ahora, "yyyy-MM-dd"));
        if (!r.hayDatos) {
            String m = "El servicio de ríos no devolvió datos para esta ubicación.";
            Prefs.guardarEstadoRio(c, m);
            return m;
        }
        String[] nombres = {"normal", "amarilla", "naranja", "roja"};
        String m = "Caudal " + nombres[r.nivel] + ": pico previsto " + Math.round(r.pico) + " m³/s (crecida frecuente desde "
                + Math.round(q[0]) + " m³/s)";
        Prefs.guardarEstadoRio(c, m + " · revisado " + hora(ahora, "d/M HH:mm"));
        if (r.nivel < 1) return m + ". Por eso no hay aviso.";
        // Un aviso por nivel cada 4 días: no se repite aunque el pronóstico mueva el día del pico
        String clave = "rio|" + r.nivel + "|" + (ahora / (4 * 24 * HORA_MS));
        if (!forzar && Prefs.yaAvisado(c, clave)) return m;
        mostrarCrecida(c, u, r.nivel, r.pico, r.diaPico);
        Prefs.marcarAvisado(c, clave);
        return m;
    }

    static void mostrarCrecida(Context c, Prefs.Ubic u, int nivel, double pico, String diaPico) {
        String nombre = nivel >= 3 ? "roja" : nivel == 2 ? "naranja" : "amarilla";
        String titulo = emojiNivel(nivel >= 3 ? "rojo" : nivel == 2 ? "naranja" : "amarillo") + " Posible crecida del río cercano (" + nombre + ")";
        String cuando = diaPico.length() >= 10 ? diaPico.substring(8, 10) + "/" + diaPico.substring(5, 7) : "próximos días";
        String corto = u.nombre + " · pico previsto el " + cuando;
        String largo = "El modelo de ríos prevé que el caudal del río más grande cerca de " + u.nombre
                + " llegue a unos " + Math.round(pico) + " m³/s el " + cuando
                + ", por encima de lo habitual para ese lugar.\n\nQué hacer:\n" + Inundaciones.precauciones(nivel)
                + "\n\nEs una estimación del modelo GloFAS (Open-Meteo): no reemplaza a las alertas oficiales del INA"
                + " (ina.gob.ar) ni de Defensa Civil. Puede no corresponder al río que tenés en mente.";
        Notificador.mostrar(c, 3000 + nivel, Notificador.CANAL_CLIMA, titulo, corto, largo);
    }

    static void mostrarAlertaSmn(Context c, Prefs.Ubic u, Smn.Alerta al) {
        String titulo = emojiNivel(al.nivel) + " Alerta " + al.nivel + " por " + al.evento.toLowerCase(AR);
        String vigencia = "Desde " + hora(al.desde, "EEE d/M HH:mm")
                + (al.hasta > 0 ? " hasta " + hora(al.hasta, "EEE d/M HH:mm") : "");
        String corto = u.nombre + " · " + vigencia;
        StringBuilder largo = new StringBuilder();
        largo.append(al.titular);
        if (al.descripcion.length() > 0) largo.append("\n").append(al.descripcion);
        largo.append("\n").append(vigencia);
        largo.append("\n\nQué hacer:\n");
        largo.append(al.instruccion.length() > 0 ? al.instruccion : Precauciones.paraEvento(al.evento));
        largo.append("\n\nFuente: Servicio Meteorológico Nacional (smn.gob.ar/alertas)");
        Notificador.mostrar(c, 2000 + Math.abs((al.evento + al.nivel).hashCode() % 1000),
                Notificador.CANAL_CLIMA, titulo, corto, largo.toString());
    }

    private static void alertasSismos(Context c, Prefs.Ubic u, Ajustes a) throws IOException {
        long ahora = System.currentTimeMillis();
        Sismos.Sensibilidad s = Sismos.sensibilidad(a.sensibilidad);
        String json = Http.get(Sismos.url(u.lat, u.lon, Sismos.MAG_MINIMA, ahora - 6 * HORA_MS), 9000);
        List<Sismos.Evento> eventos = Sismos.parsear(json, u.lat, u.lon);
        for (Sismos.Evento e : eventos) {
            if (!Sismos.relevante(e, s) && !Sismos.riesgoTsunami(e)) continue;
            if (e.tiempo < ahora - 6 * HORA_MS) continue;
            String clave = "sismo|" + e.id;
            if (Prefs.yaAvisado(c, clave)) continue;
            mostrarSismo(c, e);
            Prefs.marcarAvisado(c, clave);
        }
    }

    static void mostrarSismo(Context c, Sismos.Evento e) {
        boolean tsunami = Sismos.riesgoTsunami(e);
        String mag = String.format(Locale.US, "%.1f", e.mag);
        String titulo = tsunami
                ? "🌊 Sismo M" + mag + " en el mar: posible riesgo de tsunami"
                : "🌎 Sismo M" + mag + " a " + Math.round(e.distanciaKm) + " km de tu ubicación";
        String corto = Sismos.lugarEs(e.lugar) + " · " + hora(e.tiempo, "d/M HH:mm");
        StringBuilder largo = new StringBuilder();
        largo.append("Magnitud ").append(mag).append(" · ").append(Sismos.lugarEs(e.lugar));
        largo.append("\nHora: ").append(hora(e.tiempo, "d/M HH:mm"));
        largo.append("\nProfundidad: ").append(Math.round(e.profundidadKm)).append(" km");
        largo.append("\nDistancia a tu ubicación: ").append(Math.round(e.distanciaKm)).append(" km");
        if (tsunami) largo.append("\n\n").append(Precauciones.tsunami());
        largo.append("\n\n").append(Precauciones.sismo());
        largo.append("\n\nDatos preliminares del USGS. Seguí siempre las indicaciones de Defensa Civil.");
        Notificador.mostrar(c, 3000 + Math.abs(e.id.hashCode() % 1000), Notificador.CANAL_SISMO,
                titulo, corto, largo.toString());
    }

    // ------------------------------------------------------------------
    // Pruebas (botón "Enviar notificación de prueba" de Ajustes)
    // ------------------------------------------------------------------

    static void prueba(Context c, String tipo) {
        Prefs.Ubic u = Prefs.ubicacion(c);
        if ("diario".equals(tipo)) {
            diario(c, true);
        } else if ("semanal".equals(tipo)) {
            semanal(c, true);
        } else if ("sismo".equals(tipo)) {
            Sismos.Evento e = new Sismos.Evento();
            e.id = "prueba";
            e.mag = 5.2;
            e.lugar = "45 km NE of Ejemplo, Argentina";
            e.tiempo = System.currentTimeMillis();
            e.profundidadKm = 35;
            e.distanciaKm = 120;
            Notificador.mostrar(c, 3999, Notificador.CANAL_SISMO,
                    "🌎 (Prueba) Sismo M5.2 a 120 km de tu ubicación",
                    Sismos.lugarEs(e.lugar) + " · " + hora(e.tiempo, "d/M HH:mm"),
                    "Esto es una notificación de prueba. Así se verá un aviso de sismo.\n\n" + Precauciones.sismo());
        } else if ("inundacion".equals(tipo)) {
            Prefs.Ubic ub = u != null ? u : new Prefs.Ubic();
            mostrarCrecida(c, ub, 2, 1850, hora(System.currentTimeMillis() + 2 * 24 * HORA_MS, "yyyy-MM-dd"));
        } else if ("rio".equals(tipo)) {
            // Revisión real del río con tus datos: dice el resultado aunque no haya nada que avisar
            if (u == null) { avisoPrueba(c, "Falta la ubicación", "Abrí la app y elegí tu ubicación (GPS o a mano)."); return; }
            try {
                String m = revisarRio(c, u, true);
                avisoPrueba(c, "Revisión del río cercano", m);
            } catch (IOException e) {
                avisoPrueba(c, "Revisión del río cercano", "No se pudo consultar el servicio de ríos: " + e.getMessage());
            }
        } else if ("alerta".equals(tipo)) {
            Smn.Alerta al = new Smn.Alerta();
            al.evento = "Tormentas";
            al.nivel = "naranja";
            al.titular = "(Prueba) Alerta por tormentas fuertes";
            al.descripcion = "Esto es una notificación de prueba. Así se verá una alerta del SMN.";
            al.instruccion = Precauciones.paraEvento("Tormentas");
            al.desde = System.currentTimeMillis();
            al.hasta = System.currentTimeMillis() + 3 * HORA_MS;
            Prefs.Ubic ub = u != null ? u : new Prefs.Ubic();
            mostrarAlertaSmn(c, ub, al);
        }
    }
}
