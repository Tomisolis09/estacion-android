package __PKG__;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Sismos recientes cerca de una ubicación, desde el servicio público del USGS. */
final class Sismos {

    private Sismos() {}

    static final class Evento {
        String id;
        double mag;
        String lugar;
        long tiempo;
        double lat;
        double lon;
        double profundidadKm;
        boolean tsunami;
        String url;
        double distanciaKm;
        /** True si quien consulta está a menos de COSTA_KM de la costa: solo ahí tiene sentido avisar de tsunami. */
        boolean usuarioCostero;
    }

    /**
     * Qué sismos generan aviso. Cada tramo es {radio en km, magnitud mínima}: alcanza con
     * cumplir uno. Son los mismos valores que usa la pantalla de Avisos de la app (nucleo.js).
     */
    static final class Sensibilidad {
        final double[][] tramos;

        Sensibilidad(double[][] tramos) {
            this.tramos = tramos;
        }
    }

    /** Magnitud mínima que se pide al USGS (el tramo más sensible). */
    static final double MAG_MINIMA = 4.5;
    /** Radio de consulta al USGS: cubre el aviso de posible tsunami (hasta 2000 km). */
    static final double RADIO_CONSULTA_KM = 2000;

    static final double COSTA_KM = 100;
    /** Puntos de referencia de la costa atlántica argentina y la costa del Pacífico chileno [lat, lon]. */
    static final double[][] COSTA = {{-34.6, -58.4}, {-34.9, -57.9}, {-36.6, -56.7}, {-37.9, -57.5}, {-38.0, -57.55}, {-38.55, -58.7}, {-39.0, -61.4}, {-40.8, -63.0}, {-40.8, -65.1}, {-42.0, -63.8}, {-42.77, -65.04}, {-43.3, -65.1}, {-44.8, -65.7}, {-45.87, -67.5}, {-47.75, -65.9}, {-49.3, -67.7}, {-51.6, -69.0}, {-52.4, -68.4}, {-53.8, -67.7}, {-54.8, -68.3}, {-34.9, -54.9}, {-18.5, -70.3}, {-20.2, -70.1}, {-23.65, -70.4}, {-27.4, -70.9}, {-29.9, -71.3}, {-33.05, -71.6}, {-33.6, -71.6}, {-35.4, -72.5}, {-36.8, -73.1}, {-39.8, -73.4}, {-41.5, -73.0}, {-43.1, -73.7}, {-46.6, -75.4}, {-50.0, -75.5}, {-53.0, -70.9}};

    static boolean cercaDeCosta(double lat, double lon) {
        for (double[] p : COSTA) {
            if (Geo.distanciaKm(lat, lon, p[0], p[1]) <= COSTA_KM) return true;
        }
        return false;
    }

    static Sensibilidad sensibilidad(String nombre) {
        if ("todos".equals(nombre)) {
            return new Sensibilidad(new double[][]{{300, 4.5}, {700, 5.5}, {800, 6.5}});
        }
        if ("fuerte".equals(nombre)) {
            return new Sensibilidad(new double[][]{{400, 5.5}, {800, 6.5}});
        }
        return new Sensibilidad(new double[][]{{300, 5.0}, {700, 5.5}, {800, 6.5}});
    }

    static String url(double lat, double lon, double minMag, long desdeMs) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"
                + "&latitude=" + lat + "&longitude=" + lon
                + "&maxradiuskm=" + (int) RADIO_CONSULTA_KM
                + "&minmagnitude=" + minMag
                + "&starttime=" + f.format(new Date(desdeMs))
                + "&orderby=time&limit=200";
    }

    static List<Evento> parsear(String json, double lat, double lon) {
        List<Evento> r = new ArrayList<Evento>();
        boolean costero = cercaDeCosta(lat, lon);
        Object raiz = Json.parse(json);
        for (Object f : Json.lista(Json.get(raiz, "features"))) {
            Object p = Json.get(f, "properties");
            List<Object> c = Json.lista(Json.get(Json.get(f, "geometry"), "coordinates"));
            if (c.size() < 2 || !(Json.get(p, "mag") instanceof Double)) continue;
            Evento e = new Evento();
            e.id = Json.str(Json.get(f, "id"), "");
            e.mag = Json.num(Json.get(p, "mag"), 0);
            e.lugar = Json.str(Json.get(p, "place"), "");
            e.tiempo = (long) Json.num(Json.get(p, "time"), 0);
            e.lon = Json.numEn(c, 0, 0);
            e.lat = Json.numEn(c, 1, 0);
            e.profundidadKm = Json.numEn(c, 2, 0);
            e.tsunami = Json.num(Json.get(p, "tsunami"), 0) == 1;
            e.url = Json.str(Json.get(p, "url"), "");
            e.distanciaKm = Geo.distanciaKm(lat, lon, e.lat, e.lon);
            e.usuarioCostero = costero;
            if (e.id.length() == 0) continue;
            r.add(e);
        }
        Collections.sort(r, new Comparator<Evento>() {
            @Override
            public int compare(Evento a, Evento b) {
                return a.tiempo < b.tiempo ? 1 : (a.tiempo > b.tiempo ? -1 : 0);
            }
        });
        return r;
    }

    static boolean relevante(Evento e, Sensibilidad s) {
        for (double[] t : s.tramos) {
            if (e.distanciaKm <= t[0] && e.mag >= t[1]) return true;
        }
        return false;
    }

    /** Sismo grande en el mar con aviso de tsunami asociado (marca del USGS/NOAA), para quien está cerca de la costa. */
    static boolean riesgoTsunami(Evento e) {
        return e.usuarioCostero && e.tsunami && e.mag >= 6.0 && e.distanciaKm <= 2000;
    }

    private static final Pattern LUGAR = Pattern.compile("^(\\d+)\\s*km\\s+([NSEW]{1,3})\\s+of\\s+(.+)$");

    /** "39 km NE of Calama, Chile" -> "39 km al NE de Calama, Chile". */
    static String lugarEs(String lugar) {
        if (lugar == null) return "";
        Matcher m = LUGAR.matcher(lugar.trim());
        if (!m.matches()) return lugar;
        String dir = m.group(2).replace('W', 'O');
        return m.group(1) + " km al " + dir + " de " + m.group(3);
    }
}
