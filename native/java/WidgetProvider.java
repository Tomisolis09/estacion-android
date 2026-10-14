package __PKG__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Widget de pantalla de inicio: temperatura actual, ubicación y próximos 3 días. */
public class WidgetProvider extends AppWidgetProvider {

    static final String ACCION_REFRESCAR = "__PKG__.WIDGET_REFRESCAR";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        actualizar(context.getApplicationContext(), ids, true, goAsync());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle opciones) {
        super.onAppWidgetOptionsChanged(context, manager, id, opciones);
        actualizar(context.getApplicationContext(), new int[]{id}, false, null);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        actualizar(context.getApplicationContext(), null, true, null);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACCION_REFRESCAR.equals(intent.getAction())) {
            actualizar(context.getApplicationContext(), null, true, goAsync());
            return;
        }
        super.onReceive(context, intent);
    }

    /** Actualiza todos los widgets en segundo plano (sin esperar). */
    static void refrescarTodos(Context c, boolean descargar) {
        actualizar(c.getApplicationContext(), null, descargar, null);
    }

    /** Igual, pero espera a terminar. Solo desde un hilo de segundo plano (alarmas). */
    static void refrescarTodosYa(Context c, boolean descargar) {
        trabajar(c.getApplicationContext(), null, descargar);
    }

    private static void actualizar(final Context c, final int[] idsPedidos, final boolean descargar,
                                   final PendingResult pendiente) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    trabajar(c, idsPedidos, descargar);
                } finally {
                    if (pendiente != null) pendiente.finish();
                }
            }
        }).start();
    }

    private static void trabajar(Context c, int[] idsPedidos, boolean descargar) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = idsPedidos != null ? idsPedidos
                    : m.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
            if (ids == null || ids.length == 0) return;
            Prefs.Ubic u = Prefs.ubicacion(c);
            Pronostico p = null;
            String estado;
            if (u == null) {
                estado = "sin ubicación guardada (abrí la app)";
            } else {
                // 1) Se dibuja ya mismo con lo último guardado, sin esperar a internet
                if (descargar) {
                    try {
                        pintar(c, m, ids, u, Datos.pronostico(c, u, false));
                    } catch (Exception e) {
                        // todavía no hay copia guardada
                    }
                }
                // 2) Se intenta bajar el pronóstico nuevo (tiempo corto: Android corta el receptor a los ~10 s)
                try {
                    Datos.ultimoError = "";
                    p = Datos.pronostico(c, u, descargar, 6000);
                    estado = Datos.ultimoError.length() > 0 ? "con datos guardados (" + Datos.ultimoError + ")" : "ok";
                } catch (Exception e) {
                    estado = "sin datos: " + e.getMessage() + " " + Datos.ultimoError;
                    Log.w("EstacionClima", "Widget sin datos: " + e.getMessage());
                }
            }
            String entrega = pintar(c, m, ids, u, p);
            Prefs.guardarEstadoWidget(c, estado + " · " + entrega + " · " + new SimpleDateFormat("d/M HH:mm", Locale.US).format(new Date()));
        } catch (Throwable t) {
            Log.e("EstacionClima", "Widget", t);
            try {
                Prefs.guardarEstadoWidget(c, "error: " + t);
            } catch (Throwable ignorado) {
                // nada más que hacer
            }
        }
    }

    /** Dibuja los widgets y devuelve cuántos se entregaron bien (y el primer error, si lo hubo). */
    private static String pintar(Context c, AppWidgetManager m, int[] ids, Prefs.Ubic u, Pronostico p) {
        int bien = 0;
        String error = "";
        for (int id : ids) {
            try {
                m.updateAppWidget(id, construir(c, u, p));
                bien++;
            } catch (Throwable t) {
                Log.e("EstacionClima", "Widget " + id, t);
                if (error.length() == 0) error = String.valueOf(t);
            }
        }
        return bien + " de " + ids.length + " entregados" + (error.length() > 0 ? " (error: " + error + ")" : "");
    }

    private static int fondo(Pronostico p) {
        if (p == null || !p.hayActual) return R.drawable.widget_fondo_dia;
        int c = p.codigoActual;
        if (c >= 95) return R.drawable.widget_fondo_tormenta;
        if (!p.esDia) return R.drawable.widget_fondo_noche;
        if (c == 51 || c == 53 || c == 55 || c == 56 || c == 57 || c == 61 || c == 63 || c == 65
                || c == 66 || c == 67 || c == 80 || c == 81 || c == 82) return R.drawable.widget_fondo_lluvia;
        if (c == 71 || c == 73 || c == 75 || c == 77 || c == 85 || c == 86 || c == 45 || c == 48) {
            return R.drawable.widget_fondo_nieve;
        }
        if (c == 3 || c == 2) return R.drawable.widget_fondo_nublado;
        return R.drawable.widget_fondo_dia;
    }

    static RemoteViews construir(Context c, Prefs.Ubic u, Pronostico p) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_clima);
        v.setInt(R.id.w_root, "setBackgroundResource", fondo(p));

        if (u == null) {
            v.setTextViewText(R.id.w_nombre, "Elegí tu ubicación");
            v.setTextViewText(R.id.w_desc, "Abrí la app para empezar");
            v.setTextViewText(R.id.w_temp, "--°");
            v.setTextViewText(R.id.w_icono, "🌤️");
            v.setTextViewText(R.id.w_minmax, "");
            v.setTextViewText(R.id.w_hora, "");
            limpiarDias(v);
        } else {
            v.setTextViewText(R.id.w_nombre, "📍 " + u.nombre);
            if (p == null || p.dias() == 0) {
                v.setTextViewText(R.id.w_desc, "Sin conexión");
                v.setTextViewText(R.id.w_temp, "--°");
                v.setTextViewText(R.id.w_icono, "📡");
                v.setTextViewText(R.id.w_minmax, "");
                v.setTextViewText(R.id.w_hora, "");
                limpiarDias(v);
            } else {
                int cod = p.hayActual ? p.codigoActual : p.codigo[0];
                boolean dia = !p.hayActual || p.esDia;
                double temp = p.hayActual ? p.tempActual : (p.tmax[0] + p.tmin[0]) / 2;
                v.setTextViewText(R.id.w_icono, Textos.emoji(cod, dia));
                v.setTextViewText(R.id.w_temp, Math.round(temp) + "°");
                v.setTextViewText(R.id.w_desc, Textos.describir(cod) + " · 💧" + Math.round(p.probLluvia[0]) + "%");
                v.setTextViewText(R.id.w_minmax, "↑" + Math.round(p.tmax[0]) + "°  ↓" + Math.round(p.tmin[0]) + "°");
                long ts = Prefs.climaMomento(c);
                v.setTextViewText(R.id.w_hora, ts > 0
                        ? new SimpleDateFormat("HH:mm", Locale.US).format(new Date(ts)) : "");
                int[] nombres = {R.id.d1_nombre, R.id.d2_nombre, R.id.d3_nombre};
                int[] iconos = {R.id.d1_icono, R.id.d2_icono, R.id.d3_icono};
                int[] temps = {R.id.d1_temp, R.id.d2_temp, R.id.d3_temp};
                for (int k = 0; k < 3; k++) {
                    int i = k + 1; // mañana, pasado y el siguiente
                    if (i < p.dias()) {
                        v.setTextViewText(nombres[k], Textos.diaCorto(p.fecha[i]));
                        v.setTextViewText(iconos[k], Textos.emoji(p.codigo[i], true));
                        v.setTextViewText(temps[k], Math.round(p.tmax[i]) + "°/" + Math.round(p.tmin[i]) + "°");
                    } else {
                        v.setTextViewText(nombres[k], "");
                        v.setTextViewText(iconos[k], "");
                        v.setTextViewText(temps[k], "");
                    }
                }
            }
        }

        v.setOnClickPendingIntent(R.id.w_root, Notificador.abrirApp(c));
        Intent refrescar = new Intent(c, WidgetProvider.class);
        refrescar.setAction(ACCION_REFRESCAR);
        v.setOnClickPendingIntent(R.id.w_refrescar, PendingIntent.getBroadcast(c, 77, refrescar,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    private static void limpiarDias(RemoteViews v) {
        int[] ids = {R.id.d1_nombre, R.id.d1_icono, R.id.d1_temp, R.id.d2_nombre, R.id.d2_icono,
                R.id.d2_temp, R.id.d3_nombre, R.id.d3_icono, R.id.d3_temp};
        for (int id : ids) v.setTextViewText(id, "");
    }
}
