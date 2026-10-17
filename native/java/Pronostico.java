package __PKG__;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

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

    // Datos por hora (pueden faltar si el pronóstico guardado es de una versión anterior de la app)
    String[] hTiempo = new String[0];
    double[] hTemp = new double[0];
    double[] hProb = new double[0];
    double[] hMm = new double[0];
    int[] hCod = new int[0];
    /** Diferencia horaria del lugar con UTC, en segundos; null si el pronóstico no la trae. */
    Integer utcSeg = null;

    /** Desde esta probabilidad (%) o estos milímetros se considera que "se anuncia lluvia" y se avisa de salir con paraguas. */
    static final double PROB_LLUVIA = 40;
    static final double MM_LLUVIA_HORA = 0.5;
    static final double MM_LLUVIA_DIA = 1;

    boolean hayActual = false;
    double tempActual;
    double sensacion;
    int codigoActual;
    boolean esDia = true;

    int dias() {
        return fecha.length;
    }

    boolean hayHoras() {
        return hTiempo.length > 0;
    }

    static boolean anunciaLluvia(double prob, double mm) {
        return prob >= PROB_LLUVIA || mm >= MM_LLUVIA_DIA;
    }

    /** "aaaa-mm-ddTHH:mm" en la hora del lugar del pronóstico, para el instante ahoraMs. */
    String ahoraLocal(long ahoraMs) {
        int off = utcSeg != null ? utcSeg : TimeZone.getDefault().getOffset(ahoraMs) / 1000;
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ahoraMs + off * 1000L));
    }

    /** Posición de "aaaa-mm-dd" en el pronóstico diario, o -1. */
    int indiceDia(String dia) {
        for (int i = 0; i < fecha.length; i++) if (fecha[i].startsWith(dia)) return i;
        return -1;
    }

    /** Posición de "aaaa-mm-ddTHH:00" en el pronóstico por hora, o -1. */
    int indiceHora(String hora) {
        for (int i = 0; i < hTiempo.length; i++) if (hTiempo[i].equals(hora)) return i;
        return -1;
    }

    /** Lluvia anunciada para un lapso del día. */
    static final class Lluvia {
        boolean hay;
        /** true si se calculó con datos por hora; si no, con el total del día. */
        boolean usaHoras;
        int hDesde = -1;
        int hHasta = -1;
        double probMax;
        double mm;
    }

    /** Lluvia anunciada entre dos horas locales (aaaa-mm-ddTHH:mm). Si "hasta" cae justo en punto, esa hora no cuenta. */
    Lluvia lluviaEntre(String desdeLocal, String hastaLocal) {
        Lluvia r = new Lluvia();
        if (desdeLocal == null || hastaLocal == null || desdeLocal.length() < 16 || hastaLocal.length() < 16) return r;
        String d13 = desdeLocal.substring(0, 13), h13 = hastaLocal.substring(0, 13);
        boolean finEnPunto = hastaLocal.endsWith(":00");
        for (int i = 0; i < hTiempo.length; i++) {
            String t = hTiempo[i];
            if (t.length() < 13) continue;
            String t13 = t.substring(0, 13);
            int cmpH = t13.compareTo(h13);
            if (t13.compareTo(d13) < 0 || cmpH > 0 || (cmpH == 0 && finEnPunto)) continue;
            r.usaHoras = true;
            if (hProb[i] >= PROB_LLUVIA || hMm[i] >= MM_LLUVIA_HORA) {
                int h = Integer.parseInt(t.substring(11, 13));
                if (r.hDesde < 0) r.hDesde = h;
                r.hHasta = h;
                r.hay = true;
                r.probMax = Math.max(r.probMax, hProb[i]);
                r.mm += hMm[i];
            }
        }
        return r;
    }

    /** Lluvia que empieza pronto. */
    static final class Pronto {
        /** Minutos que faltan para que empiece. */
        int minutos;
        /** "aaaa-mm-ddTHH:00" de la hora en que empieza. */
        String hora;
        double prob;
        double mm;
    }

    private boolean horaLluviosa(int i) {
        return hProb[i] >= PROB_LLUVIA || hMm[i] >= MM_LLUVIA_HORA;
    }

    /**
     * Si ahora no se anuncia lluvia pero empieza dentro de "ventanaMin" minutos (según los datos por hora), la devuelve.
     * Los datos son por hora: el aviso es aproximado y no un radar de lluvia inmediata.
     */
    Pronto lluviaPronto(String ahoraLocal, int ventanaMin) {
        if (ahoraLocal == null || ahoraLocal.length() < 16 || !hayHoras()) return null;
        int i = indiceHora(ahoraLocal.substring(0, 13) + ":00");
        if (i < 0 || horaLluviosa(i)) return null;
        int min = Integer.parseInt(ahoraLocal.substring(14, 16));
        for (int k = 1; k <= 2; k++) {
            int faltan = (60 - min) + 60 * (k - 1);
            if (faltan > ventanaMin || i + k >= hTiempo.length) break;
            if (horaLluviosa(i + k)) {
                Pronto r = new Pronto();
                r.minutos = faltan;
                r.hora = hTiempo[i + k];
                r.prob = hProb[i + k];
                r.mm = hMm[i + k];
                return r;
            }
        }
        return null;
    }

    /** Lluvia anunciada desde "ahoraLocal" (aaaa-mm-ddTHH:mm) hasta el final de ese mismo día. */
    Lluvia lluviaRestoDelDia(String ahoraLocal) {
        Lluvia r = new Lluvia();
        if (ahoraLocal == null || ahoraLocal.length() < 13) return r;
        String dia = ahoraLocal.substring(0, 10);
        int h0 = Integer.parseInt(ahoraLocal.substring(11, 13));
        boolean hayDia = false;
        for (int i = 0; i < hTiempo.length; i++) {
            String t = hTiempo[i];
            if (t.length() < 13 || !t.startsWith(dia)) continue;
            hayDia = true;
            int h = Integer.parseInt(t.substring(11, 13));
            if (h < h0) continue;
            if (hProb[i] >= PROB_LLUVIA || hMm[i] >= MM_LLUVIA_HORA) {
                if (r.hDesde < 0) r.hDesde = h;
                r.hHasta = h;
                r.hay = true;
                r.probMax = Math.max(r.probMax, hProb[i]);
                r.mm += hMm[i];
            }
        }
        if (hayDia) {
            r.usaHoras = true;
            return r;
        }
        int i = indiceDia(dia);
        if (i >= 0 && anunciaLluvia(probLluvia[i], mm[i])) {
            r.hay = true;
            r.probMax = probLluvia[i];
            r.mm = mm[i];
        }
        return r;
    }

    /** Lluvia anunciada durante todo el día "aaaa-mm-dd". */
    Lluvia lluviaDelDia(String dia) {
        return lluviaRestoDelDia(dia + "T00:00");
    }

    static final String PARAMETROS =
            "current=temperature_2m,apparent_temperature,weather_code,is_day"
                    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,"
                    + "precipitation_probability_max,precipitation_sum,wind_speed_10m_max,"
                    + "wind_gusts_10m_max,uv_index_max"
                    + "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&timezone=auto";

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

        Object off = Json.get(raiz, "utc_offset_seconds");
        if (off instanceof Number) p.utcSeg = ((Number) off).intValue();

        Map<String, Object> hr = Json.obj(Json.get(raiz, "hourly"));
        List<Object> ht = Json.lista(hr.get("time"));
        int nh = ht.size();
        p.hTiempo = new String[nh];
        p.hTemp = new double[nh];
        p.hProb = new double[nh];
        p.hMm = new double[nh];
        p.hCod = new int[nh];
        List<Object> htt = Json.lista(hr.get("temperature_2m"));
        List<Object> htp = Json.lista(hr.get("precipitation_probability"));
        List<Object> htm = Json.lista(hr.get("precipitation"));
        List<Object> htc = Json.lista(hr.get("weather_code"));
        for (int i = 0; i < nh; i++) {
            p.hTiempo[i] = Json.strEn(ht, i, "");
            p.hTemp[i] = Json.numEn(htt, i, 0);
            p.hProb[i] = Json.numEn(htp, i, 0);
            p.hMm[i] = Json.numEn(htm, i, 0);
            p.hCod[i] = (int) Json.numEn(htc, i, 0);
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
