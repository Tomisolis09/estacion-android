package __PKG__;

/**
 * Lista de avisos ya enviados (para no repetirlos). Se guarda como texto:
 * una línea por aviso, "clave<TAB>momento".
 */
final class Registro {

    private Registro() {}

    static boolean contiene(String registro, String clave) {
        if (registro == null || clave == null) return false;
        String[] lineas = registro.split("\n");
        for (String l : lineas) {
            int t = l.indexOf('\t');
            if (t > 0 && l.substring(0, t).equals(clave)) return true;
        }
        return false;
    }

    /** Agrega la clave y descarta las que tienen más de maxEdadMs. */
    static String agregar(String registro, String clave, long ahora, long maxEdadMs) {
        StringBuilder sb = new StringBuilder();
        if (registro != null) {
            for (String l : registro.split("\n")) {
                int t = l.indexOf('\t');
                if (t <= 0) continue;
                try {
                    long ts = Long.parseLong(l.substring(t + 1).trim());
                    if (ahora - ts <= maxEdadMs && !l.substring(0, t).equals(clave)) sb.append(l).append('\n');
                } catch (NumberFormatException e) {
                    // línea dañada: se descarta
                }
            }
        }
        sb.append(clave.replace('\t', ' ').replace('\n', ' ')).append('\t').append(ahora).append('\n');
        return sb.toString();
    }
}
