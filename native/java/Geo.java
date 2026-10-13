package __PKG__;

/** Cálculos geográficos simples (distancia y pertenencia a zonas). */
final class Geo {

    private Geo() {}

    private static final double RADIO_TIERRA_KM = 6371.0088;

    /** Distancia en km entre dos puntos (fórmula de haversine). */
    static double distanciaKm(double lat1, double lon1, double lat2, double lon2) {
        double f1 = Math.toRadians(lat1);
        double f2 = Math.toRadians(lat2);
        double df = Math.toRadians(lat2 - lat1);
        double dl = Math.toRadians(lon2 - lon1);
        double a = Math.sin(df / 2) * Math.sin(df / 2)
                + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * RADIO_TIERRA_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Punto dentro de un polígono (ray casting). Coordenadas en grados: lat[], lon[]. */
    static boolean puntoEnPoligono(double lat, double lon, double[] lats, double[] lons) {
        int n = Math.min(lats.length, lons.length);
        if (n < 3) return false;
        boolean dentro = false;
        for (int i = 0, j = n - 1; i < n; j = i++) {
            double yi = lats[i], xi = lons[i];
            double yj = lats[j], xj = lons[j];
            boolean cruza = ((yi > lat) != (yj > lat))
                    && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (cruza) dentro = !dentro;
        }
        return dentro;
    }

    /** Rumbo en 8 puntos cardinales desde el punto 1 hacia el punto 2 (N, NE, E...). */
    static String rumbo(double lat1, double lon1, double lat2, double lon2) {
        double f1 = Math.toRadians(lat1), f2 = Math.toRadians(lat2);
        double dl = Math.toRadians(lon2 - lon1);
        double y = Math.sin(dl) * Math.cos(f2);
        double x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
        double grados = (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
        String[] p = {"N", "NE", "E", "SE", "S", "SO", "O", "NO"};
        return p[(int) ((grados / 45) + 0.5) % 8];
    }
}
