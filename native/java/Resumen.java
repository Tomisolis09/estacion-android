package __PKG__;

import java.util.ArrayList;
import java.util.List;

/** Arma los textos de las notificaciones de resumen (diario y semanal). */
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

    /** Resumen de hoy y mañana. */
    static Texto diario(Pronostico p, String lugar) {
        Texto t = new Texto();
        t.titulo = "📍 " + lugar + " · Hoy y mañana";
        if (p.dias() == 0) {
            t.corto = "No se pudo obtener el pronóstico.";
            t.largo = t.corto;
            return t;
        }
        boolean hayManiana = p.dias() > 1;
        StringBuilder corto = new StringBuilder();
        corto.append("Hoy ").append(tiempo(p, 0)).append(" 💧").append(r(p.probLluvia[0])).append("%");
        if (hayManiana) corto.append(" · Mañana ").append(tiempo(p, 1)).append(" 💧").append(r(p.probLluvia[1])).append("%");
        t.corto = corto.toString();

        StringBuilder largo = new StringBuilder();
        if (p.hayActual) {
            largo.append("Ahora: ").append(Textos.emoji(p.codigoActual, p.esDia)).append(" ")
                    .append(r(p.tempActual)).append("° (sensación ").append(r(p.sensacion)).append("°)\n");
        }
        largo.append("Hoy (").append(Textos.diaLargo(p.fecha[0])).append("): ").append(detalleDia(p, 0));
        if (hayManiana) {
            largo.append("\nMañana (").append(Textos.diaLargo(p.fecha[1])).append("): ").append(detalleDia(p, 1));
        }
        List<String> tipsHoy = Textos.consejos(p.tmax[0], p.tmin[0], p.probLluvia[0], p.mm[0], p.rafagaMax[0], p.uvMax[0], p.codigo[0]);
        if (!tipsHoy.isEmpty()) largo.append("\n\nHoy: ").append(Textos.unir(tipsHoy, " · "));
        if (hayManiana) {
            List<String> tipsMan = Textos.consejos(p.tmax[1], p.tmin[1], p.probLluvia[1], p.mm[1], p.rafagaMax[1], p.uvMax[1], p.codigo[1]);
            if (!tipsMan.isEmpty()) largo.append("\nMañana: ").append(Textos.unir(tipsMan, " · "));
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
            if (p.probLluvia[i] >= 60 || p.mm[i] >= 5) lluvia.add(d);
            if (p.rafagaMax[i] >= 60 || p.vientoMax[i] >= 40) viento.add(d);
        }
        largo.append("\n\n🔺 Más cálido: ").append(Textos.diaCorto(p.fecha[iMax])).append(" ").append(r(p.tmax[iMax])).append("°");
        largo.append("\n🔻 Más frío: ").append(Textos.diaCorto(p.fecha[iMin])).append(" ").append(r(p.tmin[iMin])).append("°");
        largo.append("\n🌧️ Lluvia probable: ").append(lluvia.isEmpty() ? "ningún día" : Textos.unir(lluvia, ", "));
        if (!viento.isEmpty()) largo.append("\n💨 Viento fuerte: ").append(Textos.unir(viento, ", "));
        t.corto = corto.toString();
        t.largo = largo.toString();
        return t;
    }
}
