package __PKG__;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Avisos "antes de tu actividad": la app los calcula con su pronóstico y la parte nativa los envía a su hora. */
final class Recordatorios {

    private Recordatorios() {}

    static final long TARDE_MAX_MS = 90L * 60 * 1000;

    static final class Item {
        String id;
        long fire;
        long inicio;
        long fin;
        String titulo;
        String corto;
        String largo;
    }

    static List<Item> parse(String json) {
        List<Item> out = new ArrayList<Item>();
        if (json == null || json.length() == 0) return out;
        try {
            List<Object> l = Json.lista(Json.parse(json));
            for (Object o : l) {
                Item it = new Item();
                it.id = Json.str(Json.get(o, "id"), null);
                it.fire = (long) Json.num(Json.get(o, "fire"), 0);
                it.inicio = (long) Json.num(Json.get(o, "inicio"), 0);
                it.fin = (long) Json.num(Json.get(o, "fin"), it.inicio);
                it.titulo = Json.str(Json.get(o, "titulo"), "");
                it.corto = Json.str(Json.get(o, "corto"), "");
                it.largo = Json.str(Json.get(o, "largo"), it.corto);
                if (it.id != null && it.fire > 0 && it.inicio > 0) out.add(it);
            }
        } catch (RuntimeException e) {
            // JSON dañado: no hay avisos
        }
        return out;
    }

    /** Los que ya deben salir: pasó su hora (hasta 90 min antes), la actividad todavía no empezó y no se enviaron. */
    static List<Item> vencidos(List<Item> items, long ahora, Set<String> enviados) {
        List<Item> out = new ArrayList<Item>();
        for (Item it : items) {
            if (enviados.contains(it.id)) continue;
            if (it.fire <= ahora && ahora - it.fire <= TARDE_MAX_MS && ahora < it.inicio) out.add(it);
        }
        return out;
    }

    /** Hora del próximo aviso pendiente (posterior a "ahora"), o -1. */
    static long proximo(List<Item> items, long ahora, Set<String> enviados) {
        long mejor = -1;
        for (Item it : items) {
            if (enviados.contains(it.id) || it.fire <= ahora) continue;
            if (mejor < 0 || it.fire < mejor) mejor = it.fire;
        }
        return mejor;
    }
}
