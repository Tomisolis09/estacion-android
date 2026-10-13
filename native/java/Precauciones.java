package __PKG__;

/** Recomendaciones generales por tipo de fenómeno, para cuando el aviso oficial no trae instrucciones. */
final class Precauciones {

    private Precauciones() {}

    static String paraEvento(String evento) {
        String e = evento == null ? "" : evento.toLowerCase();
        if (e.contains("tormenta")) {
            return "1. Quedate en un lugar cerrado y seguro.\n"
                    + "2. Evitá refugiarte bajo árboles, postes o carteles.\n"
                    + "3. Alejate de ríos, arroyos y zonas inundables.\n"
                    + "4. Desenchufá aparatos eléctricos y no uses el teléfono con cable.\n"
                    + "5. Si conducís, reducí la velocidad y no cruces calles anegadas.";
        }
        if (e.contains("viento") || e.contains("zonda")) {
            return "1. Evitá salir si no es necesario.\n"
                    + "2. Asegurá objetos que puedan volar (macetas, toldos, chapas).\n"
                    + "3. Mantené puertas y ventanas cerradas.\n"
                    + "4. No te refugies bajo árboles, carteles o postes.\n"
                    + "5. Conducí con precaución, sobre todo en rutas abiertas.";
        }
        if (e.contains("nev")) {
            return "1. Evitá viajar; si lo hacés, llevá cadenas, abrigo y provisiones.\n"
                    + "2. Informate del estado de las rutas antes de salir.\n"
                    + "3. Abrigate en capas y protegé extremidades.\n"
                    + "4. Cuidado con el hielo en veredas y calles.";
        }
        if (e.contains("lluvia")) {
            return "1. Evitá circular por calles anegadas.\n"
                    + "2. Alejate de cursos de agua y zonas bajas.\n"
                    + "3. Despejá desagües y canaletas si es seguro hacerlo.\n"
                    + "4. Reducí la velocidad y aumentá la distancia al conducir.";
        }
        if (e.contains("calor")) {
            return "1. Tomá agua seguido, aunque no tengas sed.\n"
                    + "2. Evitá el sol entre las 11 y las 17 h.\n"
                    + "3. Usá ropa clara y liviana, sombrero y protector solar.\n"
                    + "4. Cuidá especialmente a bebés, mayores y mascotas.";
        }
        if (e.contains("frío") || e.contains("frio") || e.contains("helada")) {
            return "1. Abrigate bien y protegé cabeza, manos y pies.\n"
                    + "2. Ventilá los ambientes aunque uses calefacción (monóxido de carbono).\n"
                    + "3. Cuidá a mayores, niños y personas en situación de calle.\n"
                    + "4. Protegé cañerías y plantas de las heladas.";
        }
        if (e.contains("niebla")) {
            return "1. Reducí la velocidad y usá luces bajas.\n"
                    + "2. Aumentá la distancia con el vehículo de adelante.\n"
                    + "3. Si la visibilidad es mínima, detenete en un lugar seguro.";
        }
        return "1. Informate en smn.gob.ar/alertas y en los canales de Defensa Civil.\n"
                + "2. Evitá actividades al aire libre si no son necesarias.\n"
                + "3. Seguí las indicaciones de las autoridades.";
    }

    static String sismo() {
        return "Si sentís un temblor: mantené la calma, alejate de ventanas y objetos que puedan caer, "
                + "agachate, cubrite y sostenete. No uses ascensores. Cuando pase, revisá si hay heridos o fugas de gas.";
    }

    static String tsunami() {
        return "Si estás en la costa: alejate del mar hacia terreno elevado y no esperes a ver la ola. "
                + "Seguí las indicaciones de Defensa Civil y del Servicio de Hidrografía Naval.";
    }
}
