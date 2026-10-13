package __PKG__;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

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

    static void diario(Context c, boolean forzar) {
        Ajustes a = Prefs.ajustes(c);
        Prefs.Ubic u = Prefs.ubicacion(c);
        if (u == null || (!forzar && (a == null || !a.diarioOn))) return;
        try {
            Pronostico p = Datos.pronostico(c, u, true);
            Resumen.Texto t = Resumen.diario(p, u.nombre);
            Notificador.mostrar(c, 1001, Notificador.CANAL_RESUMEN, t.titulo, t.corto, t.largo);
        } catch (IOException e) {
            Log.w(ETQ, "Resumen diario sin datos: " + e.getMessage());
        }
        WidgetProvider.refrescarTodosYa(c, false);
    }

    static void semanal(Context c, boolean forzar) {
        Ajustes a = Prefs.ajustes(c);
        Prefs.Ubic u = Prefs.ubicacion(c);
        if (u == null || (!forzar && (a == null || !a.semanalOn))) return;
        try {
            Pronostico p = Datos.pronostico(c, u, true);
            Resumen.Texto t = Resumen.semanal(p, u.nombre);
            Notificador.mostrar(c, 1002, Notificador.CANAL_RESUMEN, t.titulo, t.corto, t.largo);
        } catch (IOException e) {
            Log.w(ETQ, "Resumen semanal sin datos: " + e.getMessage());
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
        if (a.alertasClima) {
            try {
                alertasClima(c, u);
            } catch (Throwable t) {
                Log.w(ETQ, "Alertas del SMN: " + t);
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
