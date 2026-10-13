package __PKG__;

import java.util.List;
import java.util.Map;

/** Pronóstico de Open-Meteo reducido a lo que usan el widget y las notificaciones. */
final class Pronostico {

    String[] fecha = new String[0];
    int[] codigo = new int[0];
    double[] tmax = new double[0];
    double[] tmin = new double[0];
    double[] probLluvia = new double[0];
    double[] mm = new double[0];
    double[] vientoMax = new double[0];
    double[] rafagaMax = new double[0];
    double[] uvMax = new double[0];

    boolean hayActual = false;
    double tempActual;
    double sensacion;
    int codigoActual;
    boolean esDia = true;

    int dias() {
        return fecha.length;
    }

    static final String PARAMETROS =
            "current=temperature_2m,apparent_temperature,weather_code,is_day"
                    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,"
                    + "precipitation_probability_max,precipitation_sum,wind_speed_10m_max,"
                    + "wind_gusts_10m_max,uv_index_max&timezone=auto";

    static String url(double lat, double lon, int dias) {
        return url(lat, lon, dias, "");
    }

    /** Con clave comercial de Open-Meteo se usa el servidor de clientes. */
    static String url(double lat, double lon, int dias, String clave) {
        boolean pago = clave != null && clave.length() > 0;
        return "https://" + (pago ? "customer-" : "") + "api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon
                + "&" + PARAMETROS + "&forecast_days=" + dias + (pago ? "&apikey=" + clave : "");
    }

    static Pronostico desdeJson(String texto) {
        Object raiz = Json.parse(texto);
        Pronostico p = new Pronostico();

        Map<String, Object> actual = Json.obj(Json.get(raiz, "current"));
        if (actual.containsKey("temperature_2m")) {
            p.hayActual = true;
            p.tempActual = Json.num(actual.get("temperature_2m"), 0);
            p.sensacion = Json.num(actual.get("apparent_temperature"), p.tempActual);
            p.codigoActual = (int) Json.num(actual.get("weather_code"), 0);
            p.esDia = Json.num(actual.get("is_day"), 1) == 1;
        }

        Map<String, Object> d = Json.obj(Json.get(raiz, "daily"));
        List<Object> tiempos = Json.lista(d.get("time"));
        int n = tiempos.size();
        p.fecha = new String[n];
        p.codigo = new int[n];
        p.tmax = new double[n];
        p.tmin = new double[n];
        p.probLluvia = new double[n];
        p.mm = new double[n];
        p.vientoMax = new double[n];
        p.rafagaMax = new double[n];
        p.uvMax = new double[n];
        List<Object> cod = Json.lista(d.get("weather_code"));
        List<Object> tx = Json.lista(d.get("temperature_2m_max"));
        List<Object> tn = Json.lista(d.get("temperature_2m_min"));
        List<Object> pl = Json.lista(d.get("precipitation_probability_max"));
        List<Object> ps = Json.lista(d.get("precipitation_sum"));
        List<Object> vm = Json.lista(d.get("wind_speed_10m_max"));
        List<Object> rm = Json.lista(d.get("wind_gusts_10m_max"));
        List<Object> uv = Json.lista(d.get("uv_index_max"));
        for (int i = 0; i < n; i++) {
            p.fecha[i] = Json.strEn(tiempos, i, "");
            p.codigo[i] = (int) Json.numEn(cod, i, 0);
            p.tmax[i] = Json.numEn(tx, i, 0);
            p.tmin[i] = Json.numEn(tn, i, 0);
            p.probLluvia[i] = Json.numEn(pl, i, 0);
            p.mm[i] = Json.numEn(ps, i, 0);
            p.vientoMax[i] = Json.numEn(vm, i, 0);
            p.rafagaMax[i] = Json.numEn(rm, i, 0);
            p.uvMax[i] = Json.numEn(uv, i, 0);
        }
        return p;
    }
}
