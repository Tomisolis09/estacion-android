package __PKG__;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Alertas oficiales del Servicio Meteorológico Nacional (SMN), publicadas en
 * formato CAP. Se filtran por la ubicación del usuario con los polígonos de cada
 * alerta. Fuente: https://ssl.smn.gob.ar/CAP/AR.php (Servicio Meteorológico Nacional).
 */
final class Smn {

    private Smn() {}

    static final String FEED = "https://ssl.smn.gob.ar/CAP/AR.php";
    static final long VIGENCIA_CACHE_MS = 6L * 3600 * 1000;

    /** Cualquier archivo .xml del dominio del SMN que aparezca en el listado (RSS o página). */
    private static final Pattern ENLACE = Pattern.compile(
            "https?://(?:[A-Za-z0-9\\-]+\\.)?smn\\.gob\\.ar/[^\\s\"'<>\\]\\[]+?\\.xml", Pattern.CASE_INSENSITIVE);
    /** Respaldo: contenido de <guid> o <link> si el listado no trae archivos .xml a la vista. */
    private static final Pattern ENLACE_ITEM = Pattern.compile(
            "<(?:guid|link)[^>]*>\\s*(?:<!\\[CDATA\\[)?\\s*(https?://(?:[A-Za-z0-9\\-]+\\.)?smn\\.gob\\.ar/[^\\s<\\]]+)",
            Pattern.CASE_INSENSITIVE);
    static final int MAX_ENLACES = 60;

    // ------------------------------------------------------------------
    // Modelo
    // ------------------------------------------------------------------

    static final class Zona {
        double[] lat = new double[0];
        double[] lon = new double[0];
        boolean circulo;
        double clat;
        double clon;
        double radioKm;

        boolean contiene(double la, double lo) {
            if (circulo) return Geo.distanciaKm(la, lo, clat, clon) <= radioKm;
            return Geo.puntoEnPoligono(la, lo, lat, lon);
        }
    }

    static final class Alerta {
        String id = "";
        String evento = "";
        String severidad = "";
        String nivel = "amarillo";
        String titular = "";
        String descripcion = "";
        String instruccion = "";
        String url = "";
        long desde;
        long hasta;
        List<Zona> zonas = new ArrayList<Zona>();

        boolean aplica(double la, double lo) {
            for (Zona z : zonas) if (z.contiene(la, lo)) return true;
            return false;
        }
    }

    static final class Resultado {
        boolean ok;
        String error = "";
        int pendientes;
        List<Alerta> alertas = new ArrayList<Alerta>();
    }

    static int rango(String nivel) {
        if ("rojo".equals(nivel)) return 3;
        if ("naranja".equals(nivel)) return 2;
        return 1;
    }

    private static final Pattern COLOR = Pattern.compile("\\b(amarill[oa]|naranja|roj[oa])\\b", Pattern.CASE_INSENSITIVE);

    /** Si el titular, el evento o un parámetro nombran el color ("Alerta naranja..."), se usa ese. */
    static String nivelPorTexto(String texto) {
        if (texto == null) return null;
        Matcher m = COLOR.matcher(texto);
        String color = null;
        int mejor = 0;
        while (m.find()) {
            String c = m.group(1).toLowerCase(Locale.US);
            String n = c.startsWith("roj") ? "rojo" : c.startsWith("naranja") ? "naranja" : "amarillo";
            if (rango(n) > mejor) {
                mejor = rango(n);
                color = n;
            }
        }
        return color;
    }

    /** Severidad CAP -> color del SMN. */
    static String nivelDe(String severidad) {
        if ("Extreme".equalsIgnoreCase(severidad)) return "rojo";
        if ("Severe".equalsIgnoreCase(severidad)) return "naranja";
        return "amarillo";
    }

    // ------------------------------------------------------------------
    // Lectura del listado y de cada alerta
    // ------------------------------------------------------------------

    /**
     * Enlaces a los archivos CAP. Funciona tanto si el listado llega como RSS o como página web.
     * Solo acepta direcciones del dominio smn.gob.ar y las pasa siempre a https.
     */
    static List<String> extraerEnlaces(String cuerpo) {
        Set<String> r = new LinkedHashSet<String>();
        if (cuerpo != null) {
            Matcher m = ENLACE.matcher(cuerpo);
            while (m.find() && r.size() < MAX_ENLACES) r.add(https(m.group()));
            if (r.isEmpty()) {
                Matcher g = ENLACE_ITEM.matcher(cuerpo);
                while (g.find() && r.size() < MAX_ENLACES) {
                    String u = https(g.group(1).trim());
                    if (!u.equals(FEED) && !u.toLowerCase(Locale.US).contains("/rss")) r.add(u);
                }
            }
        }
        return new ArrayList<String>(r);
    }

    private static String https(String url) {
        return url.regionMatches(true, 0, "http://", 0, 7) ? "https://" + url.substring(7) : url;
    }

    private static NodeList etiquetas(Element padre, String etiqueta) {
        return padre.getElementsByTagNameNS("*", etiqueta);
    }

    private static Element hijo(Element padre, String etiqueta) {
        NodeList l = etiquetas(padre, etiqueta);
        return l.getLength() > 0 ? (Element) l.item(0) : null;
    }

    private static String texto(Element padre, String etiqueta) {
        Element e = hijo(padre, etiqueta);
        if (e == null) return "";
        String t = e.getTextContent();
        return t == null ? "" : t.trim();
    }

    /** Fecha ISO 8601 con zona ("2026-10-13T15:00:00-03:00") a milisegundos. 0 si no se entiende. */
    static long fechaIso(String s) {
        if (s == null) return 0;
        s = s.trim();
        if (s.length() < 19) return 0;
        String base = s.substring(0, 19);
        String zona = s.substring(19);
        if (zona.startsWith(".")) {
            int k = 1;
            while (k < zona.length() && Character.isDigit(zona.charAt(k))) k++;
            zona = zona.substring(k);
        }
        if (zona.length() == 0 || "Z".equals(zona)) zona = "+0000";
        else zona = zona.replace(":", "");
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US);
            f.setLenient(false);
            return f.parse(base + zona).getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    private static void leerZonas(Element info, Alerta a) {
        NodeList areas = etiquetas(info, "area");
        for (int i = 0; i < areas.getLength(); i++) {
            Element area = (Element) areas.item(i);
            NodeList pol = etiquetas(area, "polygon");
            for (int k = 0; k < pol.getLength(); k++) {
                Zona z = poligono(pol.item(k).getTextContent());
                if (z != null) a.zonas.add(z);
            }
            NodeList cir = etiquetas(area, "circle");
            for (int k = 0; k < cir.getLength(); k++) {
                Zona z = circulo(cir.item(k).getTextContent());
                if (z != null) a.zonas.add(z);
            }
        }
    }

    /** "lat,lon lat,lon ..." */
    static Zona poligono(String texto) {
        if (texto == null) return null;
        String[] puntos = texto.trim().split("\\s+");
        double[] la = new double[puntos.length];
        double[] lo = new double[puntos.length];
        int n = 0;
        for (String p : puntos) {
            String[] par = p.split(",");
            if (par.length < 2) continue;
            try {
                la[n] = Double.parseDouble(par[0]);
                lo[n] = Double.parseDouble(par[1]);
                n++;
            } catch (NumberFormatException e) {
                // punto inválido, se ignora
            }
        }
        if (n < 3) return null;
        Zona z = new Zona();
        z.lat = new double[n];
        z.lon = new double[n];
        System.arraycopy(la, 0, z.lat, 0, n);
        System.arraycopy(lo, 0, z.lon, 0, n);
        return z;
    }

    /** "lat,lon radio_km" */
    static Zona circulo(String texto) {
        if (texto == null) return null;
        try {
            String[] p = texto.trim().split("\\s+");
            String[] par = p[0].split(",");
            Zona z = new Zona();
            z.circulo = true;
            z.clat = Double.parseDouble(par[0]);
            z.clon = Double.parseDouble(par[1]);
            z.radioKm = Double.parseDouble(p[1]);
            return z;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * Convierte un archivo CAP en alertas. Descarta las canceladas, las que no son
     * reales ("Actual") y las ya vencidas.
     */
    static List<Alerta> parsearCap(String xml, String url, long ahora) {
        List<Alerta> r = new ArrayList<Alerta>();
        if (xml == null) return r;
        if (xml.contains("<!DOCTYPE") || xml.contains("<!ENTITY")) return r; // no se aceptan DTD
        Document doc;
        try {
            DocumentBuilderFactory fab = DocumentBuilderFactory.newInstance();
            fab.setNamespaceAware(true);
            DocumentBuilder db = fab.newDocumentBuilder();
            InputStream in = new ByteArrayInputStream(xml.getBytes("UTF-8"));
            doc = db.parse(in);
        } catch (Exception e) {
            return r;
        }
        Element raiz = doc.getDocumentElement();
        if (raiz == null) return r;
        String id = texto(raiz, "identifier");
        String estado = texto(raiz, "status");
        String tipo = texto(raiz, "msgType");
        if (!"Actual".equalsIgnoreCase(estado)) return r;
        if ("Cancel".equalsIgnoreCase(tipo)) return r;

        NodeList infos = etiquetas(raiz, "info");
        for (int i = 0; i < infos.getLength(); i++) {
            Node nodo = infos.item(i);
            if (!(nodo instanceof Element)) continue;
            Element info = (Element) nodo;
            Alerta a = new Alerta();
            a.id = id + "#" + i;
            a.evento = texto(info, "event");
            a.severidad = texto(info, "severity");
            a.titular = texto(info, "headline");
            String pistas = a.titular + " " + a.evento;
            NodeList params = etiquetas(info, "parameter");
            for (int k = 0; k < params.getLength(); k++) pistas += " " + params.item(k).getTextContent();
            String porTexto = nivelPorTexto(pistas);
            a.nivel = porTexto != null ? porTexto : nivelDe(a.severidad);
            a.descripcion = texto(info, "description");
            a.instruccion = texto(info, "instruction");
            a.url = url;
            String ini = texto(info, "onset");
            if (ini.length() == 0) ini = texto(info, "effective");
            a.desde = fechaIso(ini);
            if (a.desde == 0) a.desde = fechaIso(texto(raiz, "sent"));
            a.hasta = fechaIso(texto(info, "expires"));
            if (a.hasta != 0 && a.hasta < ahora) continue;
            leerZonas(info, a);
            if (a.zonas.isEmpty()) continue;
            if (a.titular.length() == 0) a.titular = a.evento;
            r.add(a);
        }
        return r;
    }

    // ------------------------------------------------------------------
    // Consulta completa
    // ------------------------------------------------------------------

    private static String leerArchivo(File f) throws IOException {
        InputStream in = new FileInputStream(f);
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), "UTF-8");
        } finally {
            in.close();
        }
    }

    private static void escribirArchivo(File f, String texto) {
        try {
            FileOutputStream out = new FileOutputStream(f);
            try {
                out.write(texto.getBytes("UTF-8"));
            } finally {
                out.close();
            }
        } catch (IOException e) {
            // sin caché: se descargará de nuevo la próxima vez
        }
    }

    /** Nombre seguro para guardar en el caché (sin rutas ni caracteres raros). */
    static String nombreArchivo(String url) {
        String n = url.substring(url.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._\\-]", "_");
        if (n.length() > 120) n = n.substring(n.length() - 120);
        if (!n.toLowerCase(Locale.US).endsWith(".xml")) n = n + "_" + Integer.toHexString(url.hashCode()) + ".xml";
        return n;
    }

    /**
     * Alertas vigentes que afectan a (lat, lon). Los archivos CAP ya descargados se
     * guardan en "cache"; si no alcanza el tiempo para bajar todos, los que faltan
     * se completan en la próxima consulta.
     */
    static Resultado consultar(File cache, double lat, double lon, long ahora,
                               long limiteMs, final Http.Descarga red) {
        Resultado res = new Resultado();
        String listado;
        try {
            listado = red.get(FEED);
        } catch (IOException e) {
            res.error = String.valueOf(e.getMessage());
            return res;
        }
        List<String> enlaces = extraerEnlaces(listado);
        if (cache != null && !cache.exists()) cache.mkdirs();
        final File carpeta = cache;
        final long hoy = ahora;

        List<Callable<String>> tareas = new ArrayList<Callable<String>>();
        for (final String u : enlaces) {
            tareas.add(new Callable<String>() {
                @Override
                public String call() throws Exception {
                    File f = carpeta == null ? null : new File(carpeta, nombreArchivo(u));
                    if (f != null && f.exists() && hoy - f.lastModified() < VIGENCIA_CACHE_MS && f.length() > 0) {
                        return leerArchivo(f);
                    }
                    String xml = red.get(u);
                    if (f != null) escribirArchivo(f, xml);
                    return xml;
                }
            });
        }

        ExecutorService ex = Executors.newFixedThreadPool(6);
        try {
            List<Future<String>> futuros = ex.invokeAll(tareas, limiteMs, TimeUnit.MILLISECONDS);
            for (int i = 0; i < futuros.size(); i++) {
                Future<String> f = futuros.get(i);
                String xml = null;
                if (!f.isCancelled()) {
                    try {
                        xml = f.get();
                    } catch (Exception e) {
                        xml = null;
                    }
                }
                if (xml == null) {
                    res.pendientes++;
                    continue;
                }
                for (Alerta a : parsearCap(xml, enlaces.get(i), ahora)) {
                    if (a.aplica(lat, lon)) res.alertas.add(a);
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            res.error = "Interrumpido";
            return res;
        } finally {
            ex.shutdownNow();
        }

        // Se borran del caché los archivos que ya no figuran en el listado
        if (cache != null && !enlaces.isEmpty()) {
            Set<String> vigentes = new LinkedHashSet<String>();
            for (String u : enlaces) vigentes.add(nombreArchivo(u));
            File[] viejos = cache.listFiles();
            if (viejos != null) {
                for (File f : viejos) {
                    if (f.getName().endsWith(".xml") && !vigentes.contains(f.getName())) f.delete();
                }
            }
        }

        Collections.sort(res.alertas, new Comparator<Alerta>() {
            @Override
            public int compare(Alerta a, Alerta b) {
                int d = rango(b.nivel) - rango(a.nivel);
                if (d != 0) return d;
                return a.desde < b.desde ? -1 : (a.desde > b.desde ? 1 : 0);
            }
        });
        res.ok = true;
        return res;
    }

    /** Alertas en JSON para la pantalla de la app. */
    static String aJson(Resultado r, long ahora) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"ok\":").append(r.ok).append(",\"pendientes\":").append(r.pendientes)
                .append(",\"error\":").append(Json.comillas(r.error))
                .append(",\"consultadoEn\":").append(ahora).append(",\"alertas\":[");
        for (int i = 0; i < r.alertas.size(); i++) {
            Alerta a = r.alertas.get(i);
            if (i > 0) sb.append(',');
            sb.append("{\"id\":").append(Json.comillas(a.id))
                    .append(",\"evento\":").append(Json.comillas(a.evento))
                    .append(",\"nivel\":").append(Json.comillas(a.nivel))
                    .append(",\"severidad\":").append(Json.comillas(a.severidad))
                    .append(",\"titular\":").append(Json.comillas(a.titular))
                    .append(",\"descripcion\":").append(Json.comillas(a.descripcion))
                    .append(",\"instruccion\":").append(Json.comillas(a.instruccion))
                    .append(",\"desde\":").append(a.desde)
                    .append(",\"hasta\":").append(a.hasta)
                    .append('}');
        }
        sb.append("]}");
        return sb.toString();
    }
}
