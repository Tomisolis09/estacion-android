package __PKG__;

import java.util.ArrayList;
import java.util.List;

/** Arma los textos de las notificaciones de resumen (diario, repetido durante el día y semanal). */
final class Resumen {

    private Resumen() {}

    static final class Texto {
        String titulo;
        String corto;
        String largo;
    }

    private static long r(double v) {
        return Math.round(v);
    }

    private static String tiempo(Pronostico p, int i) {
        return Textos.emoji(p.codigo[i], true) + " " + r(p.tmax[i]) + "°/" + r(p.tmin[i]) + "°";
    }

    private static String detalleDia(Pronostico p, int i) {
        StringBuilder sb = new StringBuilder();
        sb.append(Textos.describir(p.codigo[i])).append(". Máx ").append(r(p.tmax[i]))
                .append("°, mín ").append(r(p.tmin[i])).append("°. ");
        sb.append("Lluvia ").append(r(p.probLluvia[i])).append("%");
        if (p.mm[i] >= 0.5) sb.append(" (").append(Math.round(p.mm[i])).append(" mm)");
        sb.append(", viento hasta ").append(r(Math.max(p.vientoMax[i], 0))).append(" km/h");
        if (p.uvMax[i] >= 6) sb.append(", UV ").append(r(p.uvMax[i])).append(" (").append(Textos.nivelUv(p.uvMax[i])).append(")");
        sb.append(".");
        return sb.toString();
    }

    /** "lluvia probable de 16 a 20 h (hasta 70 %, unos 3 mm)". */
    static String textoLluvia(Pronostico.Lluvia l) {
        StringBuilder sb = new StringBuilder("lluvia probable ");
        if (l.usaHoras && l.hDesde >= 0) {
            if (l.hHasta == l.hDesde) sb.append("a las ").append(l.hDesde).append(" h");
            else sb.append("de ").append(l.hDesde).append(" a ").append(l.hHasta + 1).append(" h");
        } else {
            sb.append("durante el día");
        }
        sb.append(" (hasta ").append(r(l.probMax)).append(" %");
        if (l.mm >= 1) sb.append(", unos ").append(r(l.mm)).append(" mm");
        return sb.append(")").toString();
    }

    /** Los consejos del día sin el del paraguas cuando ya se dijo aparte con más detalle. */
    private static List<String> sinParaguas(List<String> tips) {
        List<String> r = new ArrayList<String>();
        for (String t : tips) if (!t.startsWith("☂️")) r.add(t);
        return r;
    }

    /** Resumen de hoy y mañana. */
    static Texto diario(Pronostico p, String lugar) {
        return diario(p, lugar, System.currentTimeMillis());
    }

    static Texto diario(Pronostico p, String lugar, long ahoraMs) {
        Texto t = new Texto();
        t.titulo = "📍 " + lugar + " · Hoy y mañana";
        if (p.dias() == 0) {
            t.corto = "No se pudo obtener el pronóstico.";
            t.largo = t.corto;
            return t;
        }
        boolean hayManiana = p.dias() > 1;
        Pronostico.Lluvia lluviaHoy = p.lluviaRestoDelDia(p.ahoraLocal(ahoraMs));
        Pronostico.Lluvia lluviaManiana = hayManiana ? p.lluviaDelDia(p.fecha[1]) : null;
        boolean paraguasManiana = lluviaManiana != null && lluviaManiana.hay;
        StringBuilder corto = new StringBuilder();
        corto.append("Hoy ").append(tiempo(p, 0)).append(" 💧").append(r(p.probLluvia[0])).append("%");
        if (hayManiana) corto.append(" · Mañana ").append(tiempo(p, 1)).append(" 💧").append(r(p.probLluvia[1])).append("%");
        if (lluviaHoy.hay) corto.append(" · ☂️ Salí con paraguas");
        else if (paraguasManiana) corto.append(" · ☂️ Mañana llevá paraguas");
        t.corto = corto.toString();

        StringBuilder largo = new StringBuilder();
        if (lluviaHoy.hay) largo.append("☂️ Hoy salí con paraguas: ").append(textoLluvia(lluviaHoy)).append(".\n");
        if (p.hayActual) {
            largo.append("Ahora: ").append(Textos.emoji(p.codigoActual, p.esDia)).append(" ")
                    .append(r(p.tempActual)).append("° (sensación ").append(r(p.sensacion)).append("°)\n");
        }
        largo.append("Hoy (").append(Textos.diaLargo(p.fecha[0])).append("): ").append(detalleDia(p, 0));
        if (hayManiana) {
            largo.append("\nMañana (").append(Textos.diaLargo(p.fecha[1])).append("): ").append(detalleDia(p, 1));
        }
        List<String> tipsHoy = Textos.consejos(p.tmax[0], p.tmin[0], p.probLluvia[0], p.mm[0], p.rafagaMax[0], p.uvMax[0], p.codigo[0]);
        if (lluviaHoy.hay) tipsHoy = sinParaguas(tipsHoy);
        if (!tipsHoy.isEmpty()) largo.append("\n\nHoy: ").append(Textos.unir(tipsHoy, " · "));
        if (hayManiana) {
            List<String> tipsMan = Textos.consejos(p.tmax[1], p.tmin[1], p.probLluvia[1], p.mm[1], p.rafagaMax[1], p.uvMax[1], p.codigo[1]);
            if (paraguasManiana) tipsMan = sinParaguas(tipsMan);
            if (!tipsMan.isEmpty()) largo.append("\nMañana: ").append(Textos.unir(tipsMan, " · "));
        }
        if (paraguasManiana) largo.append("\n☂️ Mañana también llevá paraguas: ").append(textoLluvia(lluviaManiana)).append(".");
        t.largo = largo.toString();
        return t;
    }

    /** Clima dentro de 3, 6 y 9 horas ("18 h 🌧️ 19° 💧80% · 21 h ☁️ 16°"). Vacío si no hay datos por hora. */
    private static String proximasHoras(Pronostico p, String ahoraLocal) {
        int i0 = p.indiceHora(ahoraLocal.substring(0, 13) + ":00");
        if (i0 < 0) return "";
        StringBuilder sb = new StringBuilder();
        for (int salto = 3; salto <= 9; salto += 3) {
            int i = i0 + salto;
            if (i >= p.hTiempo.length) break;
            int h = Integer.parseInt(p.hTiempo[i].substring(11, 13));
            if (sb.length() > 0) sb.append(" · ");
            sb.append(h).append(" h ").append(Textos.emoji(p.hCod[i], h >= 7 && h < 20)).append(" ").append(r(p.hTemp[i])).append("°");
            if (p.hProb[i] >= Pronostico.PROB_LLUVIA) sb.append(" 💧").append(r(p.hProb[i])).append("%");
        }
        return sb.toString();
    }

    /** Aviso del clima que se repite durante el día (cada 4 o 5 horas): ahora, próximas horas y paraguas. */
    static Texto parcial(Pronostico p, String lugar, long ahoraMs) {
        Texto t = new Texto();
        String ahora = p.ahoraLocal(ahoraMs);
        t.titulo = "📍 " + lugar + " · Clima de las " + ahora.substring(11, 16);
        if (!p.hayActual && p.dias() == 0) {
            t.corto = "No se pudo obtener el pronóstico.";
            t.largo = t.corto;
            return t;
        }
        Pronostico.Lluvia lluvia = p.lluviaRestoDelDia(ahora);
        int hoy = p.indiceDia(ahora.substring(0, 10));
        int sig = hoy >= 0 && hoy + 1 < p.dias() ? hoy + 1 : -1;
        int hora = Integer.parseInt(ahora.substring(11, 13));

        List<String> corto = new ArrayList<String>();
        if (p.hayActual) corto.add(Textos.emoji(p.codigoActual, p.esDia) + " " + r(p.tempActual) + "°");
        if (hoy >= 0) corto.add("máx " + r(p.tmax[hoy]) + "° · mín " + r(p.tmin[hoy]) + "°");
        corto.add(lluvia.hay ? "☂️ Salí con paraguas" : "Sin lluvia prevista");
        t.corto = Textos.unir(corto, " · ");

        StringBuilder largo = new StringBuilder();
        if (p.hayActual) {
            largo.append("Ahora: ").append(Textos.emoji(p.codigoActual, p.esDia)).append(" ").append(r(p.tempActual))
                    .append("° (sensación ").append(r(p.sensacion)).append("°), ").append(Textos.describir(p.codigoActual));
        }
        String prox = p.hayHoras() ? proximasHoras(p, ahora) : "";
        if (prox.length() > 0) largo.append(largo.length() > 0 ? "\n" : "").append("Próximas horas: ").append(prox);
        largo.append(largo.length() > 0 ? "\n" : "");
        if (lluvia.hay) largo.append("☂️ Salí con paraguas: ").append(textoLluvia(lluvia)).append(".");
        else largo.append("Sin lluvia prevista en lo que queda del día.");
        if (hoy >= 0) {
            largo.append("\nHoy: máx ").append(r(p.tmax[hoy])).append("°, mín ").append(r(p.tmin[hoy])).append("°, viento hasta ")
                    .append(r(Math.max(p.vientoMax[hoy], 0))).append(" km/h");
            if (p.uvMax[hoy] >= 6 && hora < 17) {
                largo.append(", UV ").append(r(p.uvMax[hoy])).append(" (").append(Textos.nivelUv(p.uvMax[hoy])).append(")");
            }
            largo.append(".");
        }
        // Por la tarde ya interesa lo que viene mañana
        if (hora >= 17 && sig >= 0) {
            largo.append("\nMañana (").append(Textos.diaLargo(p.fecha[sig])).append("): ").append(detalleDia(p, sig));
            Pronostico.Lluvia man = p.lluviaDelDia(p.fecha[sig]);
            if (man.hay) largo.append("\n☂️ Mañana también llevá paraguas: ").append(textoLluvia(man)).append(".");
        }
        if (hoy >= 0) {
            List<String> tips = Textos.consejos(p.tmax[hoy], p.tmin[hoy], p.probLluvia[hoy], p.mm[hoy], p.rafagaMax[hoy], p.uvMax[hoy], p.codigo[hoy]);
            tips = sinParaguas(tips);
            if (!tips.isEmpty() && hora < 17) largo.append("\n").append(Textos.unir(tips, " · "));
        }
        t.largo = largo.toString();
        return t;
    }

    /** Resumen de la semana que empieza mañana (hasta 7 días). */
    static Texto semanal(Pronostico p, String lugar) {
        Texto t = new Texto();
        t.titulo = "🗓️ La semana en " + lugar;
        int desde = p.dias() > 1 ? 1 : 0;
        int hasta = Math.min(p.dias(), desde + 7);
        if (hasta <= desde) {
            t.corto = "No se pudo obtener el pronóstico.";
            t.largo = t.corto;
            return t;
        }
        StringBuilder corto = new StringBuilder();
        StringBuilder largo = new StringBuilder();
        int iMax = desde, iMin = desde;
        List<String> lluvia = new ArrayList<String>();
        List<String> viento = new ArrayList<String>();
        for (int i = desde; i < hasta; i++) {
            String d = Textos.diaCorto(p.fecha[i]);
            if (i > desde) corto.append(" · ");
            corto.append(d).append(" ").append(Textos.emoji(p.codigo[i], true)).append(r(p.tmax[i])).append("°");
            if (i > desde) largo.append("\n");
            largo.append(Textos.primeraMayuscula(Textos.diaLargo(p.fecha[i]))).append(": ")
                    .append(tiempo(p, i)).append("  💧").append(r(p.probLluvia[i])).append("%");
            if (p.tmax[i] > p.tmax[iMax]) iMax = i;
            if (p.tmin[i] < p.tmin[iMin]) iMin = i;
            if (Pronostico.anunciaLluvia(p.probLluvia[i], p.mm[i])) lluvia.add(d);
            if (p.rafagaMax[i] >= 60 || p.vientoMax[i] >= 40) viento.add(d);
        }
        largo.append("\n\n🔺 Más cálido: ").append(Textos.diaCorto(p.fecha[iMax])).append(" ").append(r(p.tmax[iMax])).append("°");
        largo.append("\n🔻 Más frío: ").append(Textos.diaCorto(p.fecha[iMin])).append(" ").append(r(p.tmin[iMin])).append("°");
        if (lluvia.isEmpty()) largo.append("\n🌧️ Lluvia probable: ningún día");
        else largo.append("\n☂️ Llevá paraguas: ").append(Textos.unir(lluvia, ", "));
        if (!viento.isEmpty()) largo.append("\n💨 Viento fuerte: ").append(Textos.unir(viento, ", "));
        t.corto = corto.toString();
        t.largo = largo.toString();
        return t;
    }

    /** Aviso de lluvia que empieza pronto. */
    static Texto lluviaPronto(String lugar, Pronostico.Pronto r) {
        Texto t = new Texto();
        String h = r.hora.length() >= 16 ? r.hora.substring(11, 16) : r.hora;
        t.titulo = "☔ " + lugar + " · Se viene la lluvia";
        t.corto = "Se anuncia lluvia para las " + h + " (en unos " + r.minutos + " min). Salí con paraguas.";
        t.largo = t.corto + "\nProbabilidad: " + r(r.prob) + " %" + (r.mm >= 0.1 ? ", unos " + (r.mm < 10 ? String.valueOf(Math.round(r.mm * 10) / 10.0).replace('.', ',') : String.valueOf(r(r.mm))) + " mm en esa hora" : "")
                + ".\nEs una estimación por hora: la lluvia puede adelantarse o demorarse un poco.";
        return t;
    }
}
