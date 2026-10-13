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
        sp(c).edit().putString("ajustes", json).apply();
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
        sp(c).edit()
                .putString("clima_json", json)
                .putString("clima_lat", Double.toString(lat))
                .putString("clima_lon", Double.toString(lon))
                .putLong("clima_ts", System.currentTimeMillis())
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
