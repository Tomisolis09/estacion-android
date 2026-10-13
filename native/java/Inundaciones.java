package __PKG__;

import java.util.List;
import java.util.Map;

/**
 * Crecida de ríos: compara el caudal que prevé el modelo GloFAS (vía Open-Meteo) con las crecidas históricas
 * de ese lugar, que la app ya calculó y guardó (q2, q5 y q20 = crecidas que ocurren en promedio cada 2, 5 y 20 años).
 * Es una estimación del modelo: no reemplaza a las alertas del INA ni de Defensa Civil.
 */
final class Inundaciones {

    private Inundaciones() {
    }

    static final class Resultado {
        /** 0 = normal, 1 = amarilla, 2 = naranja, 3 = roja. */
        int nivel;
        double pico;
        double actual;
        /** Fecha (aaaa-mm-dd) del pico previsto. */
        String diaPico = "";
        boolean hayDatos;
    }

    static String url(double lat, double lon, String clave) {
        boolean pago = clave != null && clave.length() > 0;
        return "https://" + (pago ? "customer-" : "") + "flood-api.open-meteo.com/v1/flood?latitude=" + lat + "&longitude=" + lon
                + "&daily=river_discharge&past_days=3&forecast_days=10&timezone=GMT" + (pago ? "&apikey=" + clave : "");
    }

    /** Evalúa hoy y los 6 días siguientes. hoy = "aaaa-mm-dd". */
    static Resultado evaluar(String json, double q2, double q5, double q20, String hoy) {
        Resultado r = new Resultado();
        Object raiz = Json.parse(json);
        Map<String, Object> d = Json.obj(Json.get(raiz, "daily"));
        List<Object> tiempos = Json.lista(d.get("time"));
        List<Object> caudal = Json.lista(d.get("river_discharge"));
        double actual = Double.NaN;
        double pico = Double.NaN;
        int contados = 0;
        for (int i = 0; i < tiempos.size(); i++) {
            double v = Json.numEn(caudal, i, Double.NaN);
            if (Double.isNaN(v)) continue;
            String dia = Json.strEn(tiempos, i, "");
            if (dia.compareTo(hoy) <= 0) actual = v;
            if (dia.compareTo(hoy) >= 0 && contados < 7) {
                contados++;
                if (Double.isNaN(pico) || v > pico) {
                    pico = v;
                    r.diaPico = dia;
                }
            }
        }
        if (Double.isNaN(pico)) return r;
        r.hayDatos = true;
        r.pico = pico;
        r.actual = Double.isNaN(actual) ? pico : actual;
        r.nivel = pico >= q20 ? 3 : pico >= q5 ? 2 : pico >= q2 ? 1 : 0;
        return r;
    }

    static String precauciones(int nivel) {
        if (nivel >= 3) {
            return "• Riesgo de crecida grave. Si estás en zona baja o cerca del río, seguí las órdenes de evacuación sin demoras.\n"
                    + "• Llamá al 103 (Defensa Civil) o al 911 si hay peligro.\n"
                    + "• No vuelvas a la zona hasta que las autoridades lo indiquen.\n"
                    + "• Alejate de cables caídos y no toques artefactos eléctricos mojados.";
        }
        if (nivel == 2) {
            return "• Alejate de la costa y de zonas bajas cercanas al río. Preparate por si hay que evacuar.\n"
                    + "• Dejá a mano documentos, medicamentos, linterna, batería externa y agua.\n"
                    + "• Subí objetos de valor y cortá la luz en sectores que puedan inundarse.\n"
                    + "• No cruces zonas inundadas: 30 cm de agua en movimiento pueden arrastrar un vehículo.";
        }
        return "• Mantenete informado: seguí las indicaciones de Defensa Civil y del INA (ina.gob.ar).\n"
                + "• No acampes ni dejes vehículos cerca de la orilla o en cauces secos.\n"
                + "• Con lluvia, evitá cruzar ríos, arroyos y calles anegadas.";
    }
}
