package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Crea los canales y muestra las notificaciones. */
final class Notificador {

    private Notificador() {}

    static final String CANAL_RESUMEN = "resumen";
    static final String CANAL_CLIMA = "alerta_clima";
    static final String CANAL_SISMO = "alerta_sismo";

    static void canales(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel resumen = new NotificationChannel(CANAL_RESUMEN, "Resumen del clima",
                NotificationManager.IMPORTANCE_DEFAULT);
        resumen.setDescription("Resumen diario y semanal del pronóstico");
        NotificationChannel clima = new NotificationChannel(CANAL_CLIMA, "Alertas meteorológicas",
                NotificationManager.IMPORTANCE_HIGH);
        clima.setDescription("Alertas oficiales del SMN por tormentas, viento, nevadas y más");
        NotificationChannel sismo = new NotificationChannel(CANAL_SISMO, "Sismos y tsunamis",
                NotificationManager.IMPORTANCE_HIGH);
        sismo.setDescription("Avisos de sismos cercanos y posible riesgo de tsunami");
        nm.createNotificationChannel(resumen);
        nm.createNotificationChannel(clima);
        nm.createNotificationChannel(sismo);
    }

    /** True si el usuario permite notificaciones de esta app. */
    static boolean permitido(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        if (Build.VERSION.SDK_INT >= 24) return nm.areNotificationsEnabled();
        return true;
    }

    /** Nombres de los canales que el usuario silenció por completo (vacío si no hay ninguno). */
    static String canalesBloqueados(Context c) {
        if (Build.VERSION.SDK_INT < 26) return "";
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return "";
        StringBuilder sb = new StringBuilder();
        String[] ids = {CANAL_RESUMEN, CANAL_CLIMA, CANAL_SISMO};
        for (String id : ids) {
            NotificationChannel ch = nm.getNotificationChannel(id);
            if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(ch.getName());
            }
        }
        return sb.toString();
    }

    static PendingIntent abrirApp(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent();
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void mostrar(Context c, int id, String canal, String titulo, String corto, String largo) {
        if (!permitido(c)) return;
        canales(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, canal)
                : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_clima)
                .setContentTitle(titulo)
                .setContentText(corto)
                .setStyle(new Notification.BigTextStyle().bigText(largo))
                .setAutoCancel(true)
                .setContentIntent(abrirApp(c));
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFF2563EB);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(CANAL_RESUMEN.equals(canal) ? Notification.PRIORITY_DEFAULT : Notification.PRIORITY_HIGH);
        }
        nm.notify(id, b.build());
    }
}
