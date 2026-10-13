package __PKG__;

import java.util.Calendar;
import java.util.Map;

/** Ajustes del usuario que importan para el trabajo en segundo plano. */
final class Ajustes {

    boolean diarioOn = true;
    int diarioH = 7;
    int diarioM = 30;
    boolean semanalOn = true;
    /** Calendar.SUNDAY (1) ... Calendar.SATURDAY (7). Por defecto, domingo. */
    int semanalDia = Calendar.SUNDAY;
    int semanalH = 20;
    int semanalM = 0;
    boolean alertasClima = true;
    boolean alertasSismos = true;
    /** "todos", "moderada" o "fuerte": qué sismos generan aviso (igual que en la app). */
    String sensibilidad = "moderada";

    static Ajustes desdeJson(String texto) {
        Ajustes a = new Ajustes();
        if (texto == null) return a;
        try {
            Object raiz = Json.parse(texto);
            Map<String, Object> notif = Json.obj(Json.get(raiz, "notif"));
            Map<String, Object> diario = Json.obj(notif.get("diario"));
            Map<String, Object> semanal = Json.obj(notif.get("semanal"));
            Map<String, Object> alertas = Json.obj(Json.get(raiz, "alertas"));
            a.diarioOn = Json.bool(diario.get("on"), a.diarioOn);
            int[] d = Tiempo.hora(Json.str(diario.get("hora"), null), a.diarioH, a.diarioM);
            a.diarioH = d[0];
            a.diarioM = d[1];
            a.semanalOn = Json.bool(semanal.get("on"), a.semanalOn);
            // La app manda el día como en JavaScript: 0 = domingo ... 6 = sábado
            int diaJs = (int) Json.num(semanal.get("dia"), 0);
            if (diaJs >= 0 && diaJs <= 6) a.semanalDia = Calendar.SUNDAY + diaJs;
            int[] s = Tiempo.hora(Json.str(semanal.get("hora"), null), a.semanalH, a.semanalM);
            a.semanalH = s[0];
            a.semanalM = s[1];
            a.alertasClima = Json.bool(alertas.get("clima"), a.alertasClima);
            a.alertasSismos = Json.bool(alertas.get("sismos"), a.alertasSismos);
            String sens = Json.str(alertas.get("sens"), a.sensibilidad);
            a.sensibilidad = ("todos".equals(sens) || "fuerte".equals(sens)) ? sens : "moderada";
        } catch (RuntimeException e) {
            // JSON dañado: se usan los valores por defecto
        }
        return a;
    }
}
