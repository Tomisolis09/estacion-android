package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Vuelve a programar las alarmas al encender el teléfono, actualizar la app o cambiar la hora. */
public class ArranqueReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        final PendingResult pendiente = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Programador.reprogramar(app);
                    WidgetProvider.refrescarTodos(app, true);
                } catch (Throwable t) {
                    Log.e("EstacionClima", "Arranque", t);
                } finally {
                    pendiente.finish();
                }
            }
        }).start();
    }
}
