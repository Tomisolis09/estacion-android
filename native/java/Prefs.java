package __PKG__;

import android.content.Context;
import android.content.SharedPreferences;

/** Datos que comparten la app, el widget y las notificaciones. */
final class Prefs {

    private Prefs() {}

    static final class Ubic {
        double lat;
        double lon;
        String nombre = "Mi ubicación";
    }

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("estacion_prefs", Context.MODE_PRIVATE);
    }

    static void guardarAjustes(Context c, String json) {
        SharedPreferences p = sp(c);
        // Se anota cuándo cambiaron los ajustes (sirve para no avisar "de más" un horario que ya pasó hoy)
        if (!json.equals(p.getString("ajustes", null))) {
            p.edit().putString("ajustes", json).putLong("ajustes_ts", System.currentTimeMillis()).apply();
        }
    }

    static long ajustesMomento(Context c) {
        return sp(c).getLong("ajustes_ts", 0);
    }

    /** Último día (aaaammdd) en que se envió el resumen "diario" o "semanal". */
    static String envio(Context c, String tipo) {
        return sp(c).getString("envio_" + tipo, "");
    }

    static void marcarEnvio(Context c, String tipo, String dia) {
        sp(c).edit().putString("envio_" + tipo, dia).apply();
    }

    /** Avisos "antes de tu actividad" calculados por la app (JSON). */
    static void guardarRecordatorios(Context c, String json) {
        sp(c).edit().putString("recordatorios", json == null ? "" : json).apply();
    }

    static String recordatorios(Context c) {
        return sp(c).getString("recordatorios", "");
    }

    /** Identificadores de los avisos de actividad ya enviados (los últimos 40). */
    static java.util.Set<String> enviadosActividad(Context c) {
        java.util.Set<String> s = new java.util.HashSet<String>();
        String t = sp(c).getString("envio_actividades", "");
        if (t.length() > 0) for (String x : t.split("\n")) if (x.length() > 0) s.add(x);
        return s;
    }

    static void marcarActividadEnviada(Context c, String id) {
        String t = sp(c).getString("envio_actividades", "");
        java.util.List<String> l = new java.util.ArrayList<String>();
        if (t.length() > 0) for (String x : t.split("\n")) if (x.length() > 0 && !x.equals(id)) l.add(x);
        l.add(id);
        while (l.size() > 40) l.remove(0);
        StringBuilder sb = new StringBuilder();
        for (String x : l) sb.append(x).append('\n');
        sp(c).edit().putString("envio_actividades", sb.toString()).apply();
    }

    static void guardarEstadoWidget(Context c, String texto) {
        sp(c).edit().putString("widget_estado", texto).apply();
    }

    static String estadoWidget(Context c) {
        return sp(c).getString("widget_estado", "todavía no se actualizó");
    }

    /** null si el usuario todavía no terminó la configuración inicial. */
    static Ajustes ajustes(Context c) {
        String j = sp(c).getString("ajustes", null);
        return j == null ? null : Ajustes.desdeJson(j);
    }

    static void guardarUbicacion(Context c, double lat, double lon, String nombre) {
        sp(c).edit()
                .putString("lat", Double.toString(lat))
                .putString("lon", Double.toString(lon))
                .putString("nombre", nombre == null || nombre.length() == 0 ? "Mi ubicación" : nombre)
                .apply();
    }

    static Ubic ubicacion(Context c) {
        SharedPreferences p = sp(c);
        String la = p.getString("lat", null);
        String lo = p.getString("lon", null);
        if (la == null || lo == null) return null;
        try {
            Ubic u = new Ubic();
            u.lat = Double.parseDouble(la);
            u.lon = Double.parseDouble(lo);
            u.nombre = p.getString("nombre", "Mi ubicación");
            return u;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static void guardarClima(Context c, String json, double lat, double lon) {
        guardarClima(c, json, lat, lon, System.currentTimeMillis());
    }

    /** ts = cuándo se bajó realmente ese pronóstico (la app lo informa; así no parece más nuevo de lo que es). */
    static void guardarClima(Context c, String json, double lat, double lon, long ts) {
        sp(c).edit()
                .putString("clima_json", json)
                .putString("clima_lat", Double.toString(lat))
                .putString("clima_lon", Double.toString(lon))
                .putLong("clima_ts", ts)
                .apply();
    }

    /** Último pronóstico guardado, solo si es de (casi) la misma ubicación. */
    static String climaGuardado(Context c, double lat, double lon) {
        SharedPreferences p = sp(c);
        String json = p.getString("clima_json", null);
        if (json == null) return null;
        try {
            double la = Double.parseDouble(p.getString("clima_lat", "999"));
            double lo = Double.parseDouble(p.getString("clima_lon", "999"));
            if (Math.abs(la - lat) > 0.05 || Math.abs(lo - lon) > 0.05) return null;
        } catch (NumberFormatException e) {
            return null;
        }
        return json;
    }

    /** Crecidas de 2, 5 y 20 años del río cercano (las calcula la app para esa ubicación). */
    static void guardarCrecida(Context c, double lat, double lon, double q2, double q5, double q20) {
        sp(c).edit()
                .putString("crecida", q2 + "|" + q5 + "|" + q20 + "|" + lat + "|" + lon)
                .apply();
    }

    static void borrarCrecida(Context c) {
        sp(c).edit().remove("crecida").apply();
    }

    /** {q2, q5, q20}, solo si fueron calculados para (casi) la misma ubicación; si no, null. */
    static double[] crecida(Context c, double lat, double lon) {
        String t = sp(c).getString("crecida", null);
        if (t == null) return null;
        try {
            String[] p = t.split("\\|");
            if (p.length < 5) return null;
            if (Math.abs(Double.parseDouble(p[3]) - lat) > 0.05 || Math.abs(Double.parseDouble(p[4]) - lon) > 0.05) return null;
            return new double[]{Double.parseDouble(p[0]), Double.parseDouble(p[1]), Double.parseDouble(p[2])};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Clave comercial de Open-Meteo (vacía = servicio gratuito). Solo letras, números, guion y guion bajo. */
    static void guardarClaveOm(Context c, String clave) {
        String limpia = clave == null ? "" : clave.replaceAll("[^A-Za-z0-9_\\-]", "");
        sp(c).edit().putString("om_clave", limpia).apply();
    }

    static String claveOm(Context c) {
        return sp(c).getString("om_clave", "");
    }

    static long ultimoRio(Context c) {
        return sp(c).getLong("rio_ts", 0);
    }

    /** Resultado de la última revisión de ríos (para el Diagnóstico). */
    static void guardarEstadoRio(Context c, String texto) {
        sp(c).edit().putString("rio_estado", texto).apply();
    }

    static String estadoRio(Context c) {
        return sp(c).getString("rio_estado", "");
    }

    static void marcarRio(Context c) {
        sp(c).edit().putLong("rio_ts", System.currentTimeMillis()).apply();
    }

    static long climaMomento(Context c) {
        return sp(c).getLong("clima_ts", 0);
    }

    static boolean yaAvisado(Context c, String clave) {
        return Registro.contiene(sp(c).getString("avisados", ""), clave);
    }

    static void marcarAvisado(Context c, String clave) {
        String nuevo = Registro.agregar(sp(c).getString("avisados", ""), clave,
                System.currentTimeMillis(), 4L * 24 * 3600 * 1000);
        sp(c).edit().putString("avisados", nuevo).apply();
    }
}
