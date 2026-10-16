package __PKG__;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Descarga de texto por HTTPS. */
final class Http {

    private Http() {}

    static final String USER_AGENT = "EstacionMeteorologica/4.7 (Android)";
    private static final int MAX_BYTES = 4 * 1024 * 1024;

    /** Cómo se descargan los textos; en las pruebas se reemplaza por datos de ejemplo. */
    interface Descarga {
        String get(String url) throws IOException;
    }

    static final Descarga RED = new Descarga() {
        @Override
        public String get(String url) throws IOException {
            return Http.get(url, 8000);
        }
    };

    static String get(String direccion, int timeoutMs) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(direccion).openConnection();
        try {
            c.setConnectTimeout(timeoutMs);
            c.setReadTimeout(timeoutMs);
            c.setRequestProperty("User-Agent", USER_AGENT);
            c.setRequestProperty("Accept", "application/json, application/xml, text/xml, text/html, */*");
            int codigo = c.getResponseCode();
            if (codigo != 200) throw new IOException("HTTP " + codigo);
            InputStream in = c.getInputStream();
            try {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_BYTES) throw new IOException("Respuesta demasiado grande");
                }
                return new String(out.toByteArray(), "UTF-8");
            } finally {
                in.close();
            }
        } finally {
            c.disconnect();
        }
    }
}
