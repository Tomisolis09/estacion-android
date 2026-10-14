package __PKG__;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

/** Puente entre la app web y las funciones nativas (widget, alarmas, notificaciones, alertas). */
@CapacitorPlugin(
        name = "EstacionNativo",
        permissions = {
                @Permission(alias = "notificaciones", strings = {"android.permission.POST_NOTIFICATIONS"})
        })
public class EstacionNativoPlugin extends Plugin {

    /** Guarda ajustes y ubicación, reprograma las alarmas y actualiza el widget. */
    @PluginMethod
    public void sincronizar(PluginCall call) {
        Context c = getContext();
        JSObject ajustes = call.getObject("ajustes");
        JSObject ubic = call.getObject("ubicacion");
        JSObject clima = call.getObject("clima");
        if (ajustes != null) Prefs.guardarAjustes(c, ajustes.toString());
        boolean climaNuevo = false;
        if (ubic != null && ubic.has("lat") && ubic.has("lon")) {
            Prefs.guardarUbicacion(c, ubic.optDouble("lat"), ubic.optDouble("lon"), ubic.optString("nombre", "Mi ubicación"));
            // El pronóstico que la app ya bajó se comparte: el widget y los avisos lo tienen al instante
            if (clima != null && clima.has("daily") && clima.has("current")) {
                Long t = call.getLong("climaTs", null);
                Prefs.guardarClima(c, clima.toString(), ubic.optDouble("lat"), ubic.optDouble("lon"),
                        t != null ? t : System.currentTimeMillis());
                climaNuevo = true;
            }
        }
        Prefs.guardarClaveOm(c, call.getString("omClave", ""));
        JSObject crecida = call.getObject("crecida");
        if (crecida != null && ubic != null && ubic.has("lat") && ubic.has("lon") && crecida.has("q2")
                && crecida.has("q5") && crecida.has("q20")) {
            Prefs.guardarCrecida(c, ubic.optDouble("lat"), ubic.optDouble("lon"),
                    crecida.optDouble("q2"), crecida.optDouble("q5"), crecida.optDouble("q20"));
        }
        Programador.reprogramar(c);
        WidgetProvider.refrescarTodos(c, !climaNuevo);
        JSObject r = new JSObject();
        r.put("notificaciones", Notificador.permitido(c));
        call.resolve(r);
    }

    /** Datos para saber por qué no llegan avisos o el widget no muestra información. */
    @PluginMethod
    public void diagnostico(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("notificaciones", Notificador.permitido(c));
        r.put("canalesBloqueados", Notificador.canalesBloqueados(c));
        r.put("android", Build.VERSION.SDK_INT);
        Prefs.Ubic u = Prefs.ubicacion(c);
        r.put("ubicacion", u == null ? "" : u.nombre);
        r.put("climaMs", Prefs.climaMomento(c));
        int widgets = 0;
        try {
            int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
            widgets = ids == null ? 0 : ids.length;
        } catch (RuntimeException e) {
            widgets = -1;
        }
        r.put("widgets", widgets);
        r.put("widgetEstado", Prefs.estadoWidget(c));
        boolean sinAhorro = true;
        if (Build.VERSION.SDK_INT >= 23) {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            sinAhorro = pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        }
        r.put("sinAhorroBateria", sinAhorro);
        Prefs.Ubic ub = Prefs.ubicacion(c);
        r.put("crecidaGuardada", ub != null && Prefs.crecida(c, ub.lat, ub.lon) != null);
        r.put("rioMs", Prefs.ultimoRio(c));
        r.put("rioEstado", Prefs.estadoRio(c));
        r.put("ultimoDiario", Prefs.envio(c, "diario"));
        r.put("ultimoSemanal", Prefs.envio(c, "semanal"));
        call.resolve(r);
    }

    /** Abre la pantalla de Android donde se saca a la app del ahorro de batería. */
    @PluginMethod
    public void abrirAjustesBateria(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = Build.VERSION.SDK_INT >= 23
                    ? new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("No se pudo abrir: " + e.getMessage());
        }
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("notificaciones", Notificador.permitido(getContext()));
        r.put("android", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    /** True si es la versión de prueba (APK debug): ahí los anuncios son siempre de prueba. */
    @PluginMethod
    public void esDepuracion(PluginCall call) {
        boolean dbg = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        JSObject r = new JSObject();
        r.put("depuracion", dbg);
        call.resolve(r);
    }

    @PluginMethod
    public void pedirPermisoNotificaciones(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notificaciones") == PermissionState.GRANTED) {
            responderPermiso(call);
            return;
        }
        requestPermissionForAlias("notificaciones", call, "tras");
    }

    @PermissionCallback
    private void tras(PluginCall call) {
        responderPermiso(call);
    }

    private void responderPermiso(PluginCall call) {
        JSObject r = new JSObject();
        r.put("concedido", Notificador.permitido(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAjustesNotificaciones(PluginCall call) {
        Context c = getContext();
        Intent i;
        if (Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + c.getPackageName()));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        c.startActivity(i);
        call.resolve();
    }

    /** Envía una notificación de prueba: diario, semanal, sismo o alerta. */
    @PluginMethod
    public void probar(PluginCall call) {
        Trabajos.prueba(getContext(), call.getString("tipo", "diario"));
        call.resolve();
    }

    /** Alertas oficiales del SMN que afectan a la ubicación indicada. */
    @PluginMethod
    public void alertasSmn(PluginCall call) {
        try {
            double lat = call.getDouble("lat", 0.0);
            double lon = call.getDouble("lon", 0.0);
            long ahora = System.currentTimeMillis();
            Smn.Resultado r = Smn.consultar(new File(getContext().getCacheDir(), "smn"), lat, lon, ahora, 7000, Http.RED);
            call.resolve(new JSObject(Smn.aJson(r, ahora)));
        } catch (Exception e) {
            call.reject("No se pudieron consultar las alertas: " + e.getMessage());
        }
    }

    /** Sismos recientes (USGS). Se piden desde Java para no depender de CORS en el WebView. */
    @PluginMethod
    public void sismos(PluginCall call) {
        try {
            double lat = call.getDouble("lat", 0.0);
            double lon = call.getDouble("lon", 0.0);
            double minMag = call.getDouble("minMag", Sismos.MAG_MINIMA);
            int dias = call.getInt("dias", 3);
            long desde = System.currentTimeMillis() - dias * 24L * 3600L * 1000L;
            String json = Http.get(Sismos.url(lat, lon, minMag, desde), 9000);
            JSObject r = new JSObject();
            r.put("json", json);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudieron consultar los sismos: " + e.getMessage());
        }
    }

    /** Pide a Android que agregue el widget a la pantalla de inicio (Android 8 o más). */
    @PluginMethod
    public void fijarWidget(PluginCall call) {
        boolean pedido = false;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                AppWidgetManager m = AppWidgetManager.getInstance(getContext());
                if (m != null && m.isRequestPinAppWidgetSupported()) {
                    pedido = m.requestPinAppWidget(new ComponentName(getContext(), WidgetProvider.class), null, null);
                }
            }
        } catch (RuntimeException e) {
            pedido = false;
        }
        JSObject r = new JSObject();
        r.put("solicitado", pedido);
        call.resolve(r);
    }

    /** Abre un enlace https en el navegador del teléfono. */
    @PluginMethod
    public void abrirUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Dirección no válida");
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
