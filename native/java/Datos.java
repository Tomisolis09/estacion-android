package __PKG__;

import android.content.Context;
import java.io.IOException;

/** Obtiene el pronóstico (de internet o del último guardado). */
final class Datos {

    private Datos() {}

    static final int DIAS = 8;

    /** Un pronóstico guardado de hace menos de este tiempo se reutiliza en vez de volver a bajarlo (el modelo cambia cada hora). */
    static final long TTL_MS = 40L * 60 * 1000;

    /**
     * Pronóstico de 8 días. Si descargar es true intenta bajarlo de internet; si falla
     * (o es false) usa el último guardado para esa ubicación.
     */
    /** Último motivo por el que falló una descarga (para el diagnóstico). */
    static volatile String ultimoError = "";

    static Pronostico pronostico(Context c, Prefs.Ubic u, boolean descargar) throws IOException {
        return pronostico(c, u, descargar, 9000);
    }

    static Pronostico pronostico(Context c, Prefs.Ubic u, boolean descargar, int timeoutMs) throws IOException {
        return pronostico(c, u, descargar, timeoutMs, TTL_MS);
    }

    /** maxEdadMs = 0 obliga a descargar (botones de prueba); si no, se reutiliza el guardado si es del mismo lugar y reciente. */
    static Pronostico pronostico(Context c, Prefs.Ubic u, boolean descargar, int timeoutMs, long maxEdadMs) throws IOException {
        if (descargar && maxEdadMs > 0 && System.currentTimeMillis() - Prefs.climaMomento(c) < maxEdadMs
                && Prefs.climaGuardado(c, u.lat, u.lon) != null) {
            descargar = false;
        }
        if (descargar) {
            try {
                String json = Http.get(Pronostico.url(u.lat, u.lon, DIAS, Prefs.claveOm(c)), timeoutMs);
                Pronostico p = Pronostico.desdeJson(json);
                if (p.dias() > 0) {
                    Prefs.guardarClima(c, json, u.lat, u.lon);
                    return p;
                }
            } catch (IOException e) {
                ultimoError = "descarga: " + e.getMessage();
            } catch (RuntimeException e) {
                ultimoError = "respuesta dañada: " + e.getMessage();
            }
        }
        String guardado = Prefs.climaGuardado(c, u.lat, u.lon);
        if (guardado != null) {
            try {
                return Pronostico.desdeJson(guardado);
            } catch (RuntimeException e) {
                // caché dañado
            }
        }
        throw new IOException("Sin datos del clima");
    }
}
