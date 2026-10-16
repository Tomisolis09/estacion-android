package __PKG__;

import java.util.Calendar;
import java.util.TimeZone;

/** Cálculo de próximos horarios para las alarmas. */
final class Tiempo {

    private Tiempo() {}

    /**
     * Próxima vez (en milisegundos) que ocurre hh:mm, estrictamente después de
     * "ahora". Si diaSemana es Calendar.SUNDAY..SATURDAY solo cuenta ese día;
     * si es 0 cuenta todos los días.
     */
    static long proxima(long ahora, int hh, int mm, int diaSemana, TimeZone zona) {
        Calendar c = Calendar.getInstance(zona);
        c.setTimeInMillis(ahora);
        c.set(Calendar.HOUR_OF_DAY, hh);
        c.set(Calendar.MINUTE, mm);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        for (int k = 0; k < 9; k++) {
            boolean dia = diaSemana == 0 || c.get(Calendar.DAY_OF_WEEK) == diaSemana;
            if (dia && c.getTimeInMillis() > ahora) return c.getTimeInMillis();
            c.add(Calendar.DAY_OF_MONTH, 1);
            c.set(Calendar.HOUR_OF_DAY, hh);
            c.set(Calendar.MINUTE, mm);
        }
        return ahora + 24L * 3600 * 1000;
    }

    /**
     * Momentos de hoy en que se repite el resumen del clima: la hora del resumen diario + cada 4 o 5 horas, sin pasar de la
     * hora de fin. No incluye el primero (ese es el resumen diario común).
     */
    static long[] repeticionesDeHoy(long ahora, int hh, int mm, int cadaHoras, int hastaH, int hastaM, TimeZone zona) {
        if (cadaHoras <= 0) return new long[0];
        long fin = hoyA(ahora, hastaH, hastaM, zona);
        Calendar c = Calendar.getInstance(zona);
        c.setTimeInMillis(hoyA(ahora, hh, mm, zona));
        long[] tmp = new long[12];
        int n = 0;
        for (int k = 1; k <= 12; k++) {
            c.add(Calendar.HOUR_OF_DAY, cadaHoras);
            if (c.getTimeInMillis() > fin) break;
            tmp[n++] = c.getTimeInMillis();
        }
        long[] r = new long[n];
        System.arraycopy(tmp, 0, r, 0, n);
        return r;
    }

    /** Próxima repetición de hoy estrictamente después de "ahora", o -1 si ya no queda ninguna hoy. */
    static long proximaRepeticion(long ahora, int hh, int mm, int cadaHoras, int hastaH, int hastaM, TimeZone zona) {
        long[] r = repeticionesDeHoy(ahora, hh, mm, cadaHoras, hastaH, hastaM, zona);
        for (int i = 0; i < r.length; i++) if (r[i] > ahora) return r[i];
        return -1;
    }

    /** Hoy a las hh:mm (puede ser un momento ya pasado). */
    static long hoyA(long ahora, int hh, int mm, TimeZone zona) {
        Calendar c = Calendar.getInstance(zona);
        c.setTimeInMillis(ahora);
        c.set(Calendar.HOUR_OF_DAY, hh);
        c.set(Calendar.MINUTE, mm);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** Pasa "07:30" a {7, 30}. Si el texto no sirve devuelve los valores por defecto. */
    static int[] hora(String texto, int hhDef, int mmDef) {
        try {
            if (texto != null) {
                String[] p = texto.trim().split(":");
                if (p.length >= 2) {
                    int h = Integer.parseInt(p[0].trim());
                    int m = Integer.parseInt(p[1].trim());
                    if (h >= 0 && h < 24 && m >= 0 && m < 60) return new int[]{h, m};
                }
            }
        } catch (NumberFormatException e) {
            // se usa el valor por defecto
        }
        return new int[]{hhDef, mmDef};
    }
}
