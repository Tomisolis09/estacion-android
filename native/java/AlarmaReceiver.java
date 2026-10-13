package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Recibe las alarmas programadas (resumen diario, semanal y revisión de alertas). */
public class AlarmaReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(final Context context, Intent intent) {
        final String accion = intent == null ? null : intent.getAction();
        if (accion == null) return;
        final PendingResult pendiente = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    // Primero se programa la siguiente, así la cadena no se corta si algo falla
                    Programador.reprogramar(app);
                    Trabajos.ejecutar(app, accion);
                } catch (Throwable t) {
                    Log.e("EstacionClima", "Alarma " + accion, t);
                } finally {
                    pendiente.finish();
                }
            }
        }).start();
    }
}
