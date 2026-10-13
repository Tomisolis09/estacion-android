package __PKG__;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lector de JSON mínimo (sin dependencias). Devuelve Map, List, String, Double,
 * Boolean o null. Se usa para leer las respuestas de Open-Meteo y USGS y los
 * ajustes que manda la app web.
 */
final class Json {

    private Json() {}

    static Object parse(String texto) {
        if (texto == null) throw new IllegalArgumentException("JSON vacío");
        Lector l = new Lector(texto);
        l.espacios();
        Object v = l.valor();
        l.espacios();
        if (l.i != texto.length()) throw l.error("Texto sobrante");
        return v;
    }

    // ---------- ayudas de lectura (tolerantes a datos faltantes) ----------

    @SuppressWarnings("unchecked")
    static Map<String, Object> obj(Object o) {
        return (o instanceof Map) ? (Map<String, Object>) o : new LinkedHashMap<String, Object>();
    }

    @SuppressWarnings("unchecked")
    static List<Object> lista(Object o) {
        return (o instanceof List) ? (List<Object>) o : new ArrayList<Object>();
    }

    static Object get(Object o, String clave) {
        if (o instanceof Map) return ((Map<?, ?>) o).get(clave);
        return null;
    }

    static String str(Object o, String def) {
        return (o instanceof String) ? (String) o : def;
    }

    static double num(Object o, double def) {
        return (o instanceof Double) ? ((Double) o).doubleValue() : def;
    }

    static boolean bool(Object o, boolean def) {
        return (o instanceof Boolean) ? ((Boolean) o).booleanValue() : def;
    }

    /** Valor numérico de la posición i de una lista, o def si falta o es null. */
    static double numEn(List<Object> l, int i, double def) {
        if (l == null || i < 0 || i >= l.size()) return def;
        return num(l.get(i), def);
    }

    static String strEn(List<Object> l, int i, String def) {
        if (l == null || i < 0 || i >= l.size()) return def;
        return str(l.get(i), def);
    }

    // ---------- escritura ----------

    static String comillas(String s) {
        StringBuilder sb = new StringBuilder(s == null ? 2 : s.length() + 2);
        sb.append('"');
        if (s != null) {
            for (int k = 0; k < s.length(); k++) {
                char c = s.charAt(k);
                switch (c) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                        else sb.append(c);
                }
            }
        }
        sb.append('"');
        return sb.toString();
    }

    // ---------- analizador ----------

    private static final class Lector {
        final String s;
        int i = 0;

        Lector(String s) { this.s = s; }

        IllegalArgumentException error(String msg) {
            return new IllegalArgumentException(msg + " (posición " + i + ")");
        }

        void espacios() {
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == ' ' || c == '\n' || c == '\r' || c == '\t' || c == '﻿') i++;
                else break;
            }
        }

        Object valor() {
            if (i >= s.length()) throw error("Fin inesperado");
            char c = s.charAt(i);
            if (c == '{') return objeto();
            if (c == '[') return arreglo();
            if (c == '"') return cadena();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            if (s.startsWith("NaN", i)) { i += 3; return null; }
            return numero();
        }

        Map<String, Object> objeto() {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            i++; // {
            espacios();
            if (i < s.length() && s.charAt(i) == '}') { i++; return m; }
            while (true) {
                espacios();
                if (i >= s.length() || s.charAt(i) != '"') throw error("Se esperaba una clave");
                String k = cadena();
                espacios();
                if (i >= s.length() || s.charAt(i) != ':') throw error("Se esperaba ':'");
                i++;
                espacios();
                m.put(k, valor());
                espacios();
                if (i >= s.length()) throw error("Objeto sin cerrar");
                char c = s.charAt(i++);
                if (c == ',') continue;
                if (c == '}') return m;
                throw error("Se esperaba ',' o '}'");
            }
        }

        List<Object> arreglo() {
            List<Object> l = new ArrayList<Object>();
            i++; // [
            espacios();
            if (i < s.length() && s.charAt(i) == ']') { i++; return l; }
            while (true) {
                espacios();
                l.add(valor());
                espacios();
                if (i >= s.length()) throw error("Lista sin cerrar");
                char c = s.charAt(i++);
                if (c == ',') continue;
                if (c == ']') return l;
                throw error("Se esperaba ',' o ']'");
            }
        }

        String cadena() {
            StringBuilder sb = new StringBuilder();
            i++; // "
            while (true) {
                if (i >= s.length()) throw error("Texto sin cerrar");
                char c = s.charAt(i++);
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                if (i >= s.length()) throw error("Escape incompleto");
                char e = s.charAt(i++);
                switch (e) {
                    case '"': sb.append('"'); break;
                    case '\\': sb.append('\\'); break;
                    case '/': sb.append('/'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        if (i + 4 > s.length()) throw error("Escape \\u incompleto");
                        sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default: throw error("Escape desconocido");
                }
            }
        }

        Double numero() {
            int ini = i;
            while (i < s.length()) {
                char c = s.charAt(i);
                if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') i++;
                else break;
            }
            if (ini == i) throw error("Valor no reconocido");
            try {
                return Double.valueOf(s.substring(ini, i));
            } catch (NumberFormatException e) {
                throw error("Número inválido");
            }
        }
    }
}
