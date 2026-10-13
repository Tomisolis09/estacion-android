package __PKG__;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;

/** Textos en español: descripciones del clima, días y consejos. */
final class Textos {

    private Textos() {}

    static final String[] DIAS = {"domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"};
    static final String[] DIAS_CORTOS = {"Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"};

    static String describir(int c) {
        switch (c) {
            case 0: return "Despejado";
            case 1: return "Mayormente despejado";
            case 2: return "Parcialmente nublado";
            case 3: return "Nublado";
            case 45: return "Niebla";
            case 48: return "Niebla con escarcha";
            case 51: return "Llovizna débil";
            case 53: return "Llovizna";
            case 55: return "Llovizna intensa";
            case 56: return "Llovizna helada";
            case 57: return "Llovizna helada intensa";
            case 61: return "Lluvia débil";
            case 63: return "Lluvia";
            case 65: return "Lluvia fuerte";
            case 66: return "Lluvia helada";
            case 67: return "Lluvia helada fuerte";
            case 71: return "Nevada débil";
            case 73: return "Nevada";
            case 75: return "Nevada fuerte";
            case 77: return "Granizo fino";
            case 80: return "Chubascos débiles";
            case 81: return "Chubascos";
            case 82: return "Chubascos violentos";
            case 85: return "Chubascos de nieve";
            case 86: return "Chubascos de nieve fuertes";
            case 95: return "Tormenta";
            case 96: return "Tormenta con granizo";
            case 99: return "Tormenta con granizo fuerte";
            default: return "Variable";
        }
    }

    static String emoji(int c, boolean dia) {
        if (c == 0) return dia ? "☀️" : "🌙";
        if (c == 1) return dia ? "🌤️" : "🌙";
        if (c == 2) return dia ? "⛅" : "☁️";
        if (c == 3) return "☁️";
        if (c == 45 || c == 48) return "🌫️";
        if (c == 51 || c == 53 || c == 80) return "🌦️";
        if (c == 55 || c == 56 || c == 57 || c == 61 || c == 63 || c == 65 || c == 66 || c == 67 || c == 81) return "🌧️";
        if (c == 71 || c == 73 || c == 85) return "🌨️";
        if (c == 75 || c == 77 || c == 86) return "❄️";
        if (c == 82 || c >= 95) return "⛈️";
        return "🌤️";
    }

    /** Día de la semana (Calendar.SUNDAY = 1 ... SATURDAY = 7) de "2026-10-11". */
    static int diaSemana(String fecha) {
        try {
            String[] p = fecha.substring(0, 10).split("-");
            Calendar c = new GregorianCalendar(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            return c.get(Calendar.DAY_OF_WEEK);
        } catch (Exception e) {
            return Calendar.SUNDAY;
        }
    }

    static String diaLargo(String fecha) {
        return DIAS[diaSemana(fecha) - 1];
    }

    static String diaCorto(String fecha) {
        return DIAS_CORTOS[diaSemana(fecha) - 1];
    }

    static String primeraMayuscula(String s) {
        if (s == null || s.length() == 0) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    static String nivelUv(double uv) {
        if (uv < 3) return "bajo";
        if (uv < 6) return "moderado";
        if (uv < 8) return "alto";
        if (uv < 11) return "muy alto";
        return "extremo";
    }

    /** Hasta 3 consejos cortos para un día. */
    static List<String> consejos(double tmax, double tmin, double probLluvia, double mm,
                                 double rafaga, double uv, int codigo) {
        List<String> r = new ArrayList<String>();
        if (codigo >= 95) r.add("⛈️ Tormentas: evitá zonas abiertas");
        else if (probLluvia >= 60 || mm >= 5) r.add("☂️ Llevá paraguas");
        if (tmax >= 33) r.add("💧 Hidratate y evitá el mediodía");
        if (tmin <= 3) r.add("🧥 Abrigate bien: posible helada");
        if (uv >= 6) r.add("🧴 Usá protector solar");
        if (rafaga >= 60) r.add("💨 Ráfagas fuertes: cuidado con objetos sueltos");
        while (r.size() > 3) r.remove(r.size() - 1);
        return r;
    }

    static String unir(List<String> partes, String separador) {
        StringBuilder sb = new StringBuilder();
        for (int k = 0; k < partes.size(); k++) {
            if (k > 0) sb.append(separador);
            sb.append(partes.get(k));
        }
        return sb.toString();
    }
}
