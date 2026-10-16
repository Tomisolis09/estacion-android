package __PKG__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.TimeZone;

/** Programa las alarmas del resumen diario, el semanal y la revisión periódica (alertas y widget). */
final class Programador {

    private Programador() {}

    static final String ACCION_DIARIO = "__PKG__.RESUMEN_DIARIO";
    static final String ACCION_SEMANAL = "__PKG__.RESUMEN_SEMANAL";
    static final String ACCION_ALERTAS = "__PKG__.REVISAR_ALERTAS";
    static final String ACCION_REPETIDO = "__PKG__.RESUMEN_REPETIDO";

    static final long INTERVALO_ALERTAS_MS = 30L * 60 * 1000;

    private static PendingIntent pendiente(Context c, int codigo, String accion, int banderas) {
        Intent i = new Intent(c, AlarmaReceiver.class);
        i.setAction(accion);
        return PendingIntent.getBroadcast(c, codigo, i, banderas | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void poner(Context c, AlarmManager am, int codigo, String accion, long momento) {
        PendingIntent pi = pendiente(c, codigo, accion, PendingIntent.FLAG_UPDATE_CURRENT);
        if (Build.VERSION.SDK_INT >= 23) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, momento, pi);
        } else {
            am.set(AlarmManager.RTC_WAKEUP, momento, pi);
        }
    }

    private static void quitar(Context c, AlarmManager am, int codigo, String accion) {
        PendingIntent pi = pendiente(c, codigo, accion, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    /** Vuelve a programar todo según los ajustes guardados. */
    static void reprogramar(Context c) {
        Notificador.canales(c);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Ajustes a = Prefs.ajustes(c);
        if (a == null) {
            quitar(c, am, 1, ACCION_DIARIO);
            quitar(c, am, 2, ACCION_SEMANAL);
            quitar(c, am, 3, ACCION_ALERTAS);
            quitar(c, am, 4, ACCION_REPETIDO);
            return;
        }
        long ahora = System.currentTimeMillis();
        TimeZone zona = TimeZone.getDefault();
        if (a.diarioOn) poner(c, am, 1, ACCION_DIARIO, Tiempo.proxima(ahora, a.diarioH, a.diarioM, 0, zona));
        else quitar(c, am, 1, ACCION_DIARIO);
        if (a.semanalOn) poner(c, am, 2, ACCION_SEMANAL, Tiempo.proxima(ahora, a.semanalH, a.semanalM, a.semanalDia, zona));
        else quitar(c, am, 2, ACCION_SEMANAL);
        // Resumen del clima que se repite cada 4 o 5 horas (solo si el resumen diario está activado)
        long prox = a.diarioOn && a.diarioCada > 0
                ? Tiempo.proximaRepeticion(ahora, a.diarioH, a.diarioM, a.diarioCada, a.diarioHastaH, a.diarioHastaM, zona) : -1;
        if (prox > 0) poner(c, am, 4, ACCION_REPETIDO, prox);
        else quitar(c, am, 4, ACCION_REPETIDO);
        // Cada 30 minutos: revisa alertas (si están activadas) y mantiene al día el widget
        poner(c, am, 3, ACCION_ALERTAS, ahora + INTERVALO_ALERTAS_MS);
    }
}
