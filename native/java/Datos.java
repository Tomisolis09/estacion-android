package __PKG__;

import android.content.Context;
import java.io.IOException;

/** Obtiene el pronóstico (de internet o del último guardado). */
final class Datos {

    private Datos() {}

    static final int DIAS = 8;

    /**
     * Pronóstico de 8 días. Si descargar es true intenta bajarlo de internet; si falla
     * (o es false) usa el último guardado para esa ubicación.
     */
    static Pronostico pronostico(Context c, Prefs.Ubic u, boolean descargar) throws IOException {
        if (descargar) {
            try {
                String json = Http.get(Pronostico.url(u.lat, u.lon, DIAS), 9000);
                Pronostico p = Pronostico.desdeJson(json);
                if (p.dias() > 0) {
                    Prefs.guardarClima(c, json, u.lat, u.lon);
                    return p;
                }
            } catch (IOException e) {
                // se usa lo guardado
            } catch (RuntimeException e) {
                // respuesta dañada: se usa lo guardado
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
