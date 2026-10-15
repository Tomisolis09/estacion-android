# Estación Meteorológica v4.4 – Android

Novedades: widget (temperatura, ubicación y próximos 3 días), notificaciones diarias y semanales configurables,
ubicación por GPS, solapa Actividades, alertas oficiales del SMN, sismos y posible tsunami (solo cerca de la costa),
con notificaciones y precauciones.

## A. Cómo actualizar tu repositorio de GitHub
1. Entrá a tu repositorio y tocá **Add file > Upload files**.
2. Arrastrá estas cosas del zip (reemplazan a las anteriores):
   - la carpeta **`www`** (completa)
   - la carpeta **`native`** (es NUEVA, completa: tiene `java` y `res`)
   - la carpeta **`scripts`** (reemplaza `preparar-android.sh`)
   - los archivos **`package.json`**, **`PRIVACIDAD.md`** y **`LEEME.md`**
3. **No toques** `.github/workflows/android.yml` (ya está bien como lo tenés).
4. Tocá **Commit changes** y entrá a **Actions**. Esperá 6-10 minutos.
5. (Opcional) Dentro de `www` borrá el archivo viejo `logica.js`: ya no se usa.

Si la compilación falla (cruz roja), tocá la corrida, abrí el paso que falló y copiame el mensaje de error.

## B. Probar en tu celular (APK)
Descargá **apk-de-prueba**, instalalo y probá:
1. Al abrir aparece la bienvenida: tocá **Usar mi ubicación (GPS)**, aceptá el permiso y elegí horarios.
2. Aceptá el permiso de **notificaciones**.
3. ⚙️ Ajustes > **Probar notificaciones**: tocá las cuatro y verificá que lleguen.
4. ⚙️ Ajustes > **Agregar widget**, o mantené presionada la pantalla de inicio > Widgets > "Estación".
5. Solapa **Avisos**: debería decir si hay alertas del SMN y sismos cerca.

## C. Qué tener en cuenta (límites reales)
- **Ubicación:** se actualiza con el GPS **cuando abrís la app**. El widget y las notificaciones usan la última ubicación guardada
  (no pedimos ubicación en segundo plano porque Google Play lo exige con una revisión especial). Si viajás lejos, abrí la app una vez.
- **Horarios:** Android puede demorar unos minutos las notificaciones para ahorrar batería. En algunos celulares (Xiaomi, Samsung,
  Huawei, Oppo) hay que desactivar el ahorro de batería para la app para que lleguen puntuales.
- **Alertas oficiales (SMN):** se leen del servicio público del SMN. Las probé con datos de ejemplo pero **no pude probarlas
  contra el servicio real** desde mi entorno. Si en Avisos nunca aparece nada o dice que no se pudieron consultar, avisame.
- **Tsunami:** solo se avisa si estás a menos de ~100 km de la costa y el USGS marca un sismo grande en el mar. Es un indicador,
  no una confirmación. **Sismos:** solo si fueron lo bastante cerca y fuertes como para sentirse donde estás.
- La app **no es oficial**; hay avisos en pantalla. Mantené esa aclaración en la ficha de Play Store.

## D. Firmar y subir a Play Store
Igual que antes: el workflow firma el **aab-para-play-store** con tus secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`).
(Esta versión no tiene anuncios; ver la sección "Anuncios" más abajo.)
Antes de publicar actualizá en Play Console:
1. **Seguridad de los datos:** ubicación (precisa y aproximada) recopilada y compartida con servicios de terceros para el
   funcionamiento de la app; no se guarda en servidores propios; sin identificadores de publicidad.
2. **Política de privacidad:** republicá el nuevo `PRIVACIDAD.md`.
3. **Contenido de la app:** contiene anuncios = No.
4. Descripción: agregá "No es una app oficial. Alertas del Servicio Meteorológico Nacional (CC BY 4.0) y sismos del USGS".
5. Subí capturas nuevas (Hoy, Actividades, Avisos, Widget).

## E. Novedades de esta versión (arreglos + anuncios)
**Widget**
- La app ahora le pasa al widget el pronóstico que ya descargó: aparece al instante, sin depender de que el widget tenga internet.
- El widget se dibuja primero con lo último guardado y después intenta actualizar (con tiempo límite corto para que Android no lo corte).

**Notificaciones**
- Si Android demora o saltea una alarma, la revisión de cada 30 minutos envía el resumen del día que quedó atrasado (hasta 4 h después del horario).
- En ⚙️ Ajustes > Probar notificaciones, si algo falla ahora llega una notificación de prueba que explica el motivo, y la pantalla muestra el resultado.
- **⚙️ Ajustes > 🔍 Diagnóstico**: muestra permiso de notificaciones, canales silenciados, ubicación guardada, último pronóstico, estado del widget y ahorro de batería. Si algo sigue fallando, copiame ese texto.

**Anuncios (ciclo)**
- **Banner:** 1 minuto visible, 3 minutos sin anuncios, y vuelve (se repite). Los tiempos están en `www/anuncios.js` (`VISIBLE_MS` y `OCULTO_MS`).
- **Pantalla completa / video:** un anuncio como máximo por cada ventana de 1 minuto, cuando la persona cambia de solapa o cierra una hoja. AdMob decide si muestra imagen o video. No se muestra si hay una alerta naranja/roja, sismo fuerte o tsunami.
- **Video con premio (opcional):** botón en Ajustes; quien lo mira no ve anuncios por 30 minutos.
- Un anuncio de pantalla completa **no se puede cortar a 1 minuto desde la app**: lo cierra el usuario cuando AdMob lo permite. Por política de AdMob tampoco se pueden forzar anuncios de pantalla completa o video en cualquier momento (ni sobre una alerta).
- **Para activarlos en la versión de Play Store** creá en AdMob una unidad *Intersticial* y una *Con premio*, y pegá sus IDs en `INTERSTICIAL_ID_REAL` y `PREMIO_ID_REAL` (`www/anuncios.js`). Mientras estén vacíos, en la versión publicada solo sale el banner. En el APK de prueba se ven siempre con anuncios de prueba.

**Actividades personalizadas**
- Al instalar, la bienvenida pregunta qué deportes o actividades hace la persona (21 opciones) y permite **agregar otras a su manera** (nombre, emoji y "se parece a…", que define cómo se calcula el mejor horario). La solapa Actividades muestra solo las suyas. Se cambian cuando quiera desde ✏️ Personalizar o ⚙️ Ajustes > Mis deportes y actividades. Si no elige ninguna, se muestran todas.
- Nuevas: caminata, tenis y pádel, yoga/gimnasia, escalada, golf, skate y patín, moto, equitación.

**Sol y Luna** (solapas Hoy y Actividades, para el día elegido)
- Salida y puesta del Sol y de la Luna, horas de luz, fase lunar con % iluminado y las próximas fases (nueva, cuarto creciente, llena, cuarto menguante). Se calcula en el teléfono, sin internet. Precisión: sol ±2 min, fases ±1 hora. El dibujo de la Luna está espejado para el hemisferio sur.

**Alertas de tormentas y crecida de ríos**
- Las alertas oficiales del SMN (amarilla, naranja y roja) para tu ubicación ya generan notificación (⚙️ Ajustes > Alertas meteorológicas). Se revisan cada 30 minutos con la app cerrada. Probalo con el botón "Alerta del SMN".
- **Crecida de ríos e inundaciones (nuevo):** si hay un río importante a menos de unos 5 km, la app compara el caudal que prevé el modelo GloFAS (vía Open-Meteo) con las crecidas históricas de ese lugar (1990-2022): cada ~2 años = amarilla, cada ~5 = naranja, cada ~20 = roja. Avisa por notificación (máximo una por nivel cada 4 días) y lo muestra en la solapa Avisos. Si no hay un río grande cerca, no avisa. Es una estimación: no reemplaza al INA ni a Defensa Civil. Botón de prueba: "Aviso de crecida".
- Las alertas meteorológicas (tormentas, lluvias, viento, calor, frío, etc.) son **solo las oficiales del SMN**: ya no se muestran alertas "estimadas" con el pronóstico. El banner de Hoy, el punto de la solapa Avisos y el aviso del día en Actividades usan únicamente alertas del SMN (más sismos y la crecida de ríos, que se muestra aparte y marcada como estimación).

## Si no llega el aviso de crecida
1. Al pie de cada pantalla figura la versión (por ejemplo v3.8): confirmá que tenés instalada la última.
2. ⚙️ Ajustes > Probar notificaciones > **Aviso de crecida** (ejemplo) y **Revisar río ahora** (consulta real; te manda una notificación con el resultado, aunque no haya crecida).
3. ⚙️ Ajustes > 🔍 Diagnóstico: mirá "Umbrales de crecida" y "Última revisión de ríos".
Solo hay aviso real si hay un río importante a ~5 km y el modelo prevé un caudal sobre la crecida frecuente (cada ~2 años). Los umbrales se calculan al abrir la solapa Avisos con internet.

## Solapa Planetas (nueva)
Muestra Venus, Júpiter, Marte, Saturno y Mercurio: si se ven esta noche desde tu ubicación (horario, dirección, altura y brillo) y una tira con los próximos 14 días (punto verde = se ve). Tocá un día para ver el detalle de ese día. Se calcula en el teléfono, sin internet (`www/planetas.js`). Cuenta como "visible" si el planeta está a más de 5° sobre el horizonte con el cielo oscuro (Sol a más de 4° bajo el horizonte). No tiene en cuenta nubes ni luces de la ciudad.

## Pendientes antes de publicar (los tenés que hacer vos)
1. Publicar `PRIVACIDAD.md` en una URL pública (por ejemplo GitHub Pages), pegarla en `POLITICA_URL` (`www/nucleo.js`) y en Play Console.
2. En Play Console: **contiene anuncios = No**, Seguridad de los datos (ubicación precisa y aproximada: recopilada y compartida con servicios para el funcionamiento de la app; sin ID de publicidad), público objetivo 13+ y ficha con atribuciones.
3. Open-Meteo: sin anuncios ni suscripciones el servicio gratuito alcanza (ver abajo). Si más adelante activás anuncios, hace falta un plan comercial.

## Licencia de Open-Meteo
- Según sus términos, el servicio **gratuito** es para uso **no comercial**: una app **sin anuncios ni suscripciones** cuenta como no comercial. Si agregás anuncios (o cobrás), pasa a ser comercial y necesitás un plan pago (open-meteo.com/en/pricing; los precios los ves ahí, no figuran en este documento). Ante la duda, escribí a info@open-meteo.com.
- El límite gratuito es de 10.000 llamadas por día, 5.000 por hora y 600 por minuto por **dirección IP** (cada celular tiene la suya) y 300.000 por mes. Open-Meteo no tiene panel de estadísticas de uso para el plan gratuito.
- Al contratar un plan te dan una **clave**: pegala en `www/nucleo.js`, en `OPEN_METEO_CLAVE = ""`. Con eso la app usa sola el servidor de clientes (`customer-api.open-meteo.com`). Sin clave sigue con el servicio gratuito. La clave queda dentro de la app (cualquiera que la desarme podría verla).
- Open-Meteo pide **atribución** (CC BY 4.0): ya figura en ⚙️ Ajustes. Mencionalo también en la ficha de Play Store.

## Anuncios (desactivados por ahora)
En esta versión **no hay anuncios**: no se incluye AdMob en la app, no se pide el ID de publicidad y la política de privacidad no los menciona. Para volver a activarlos más adelante:
1. `package.json`: agregá `"@capacitor-community/admob": "8.2.1"` en `dependencies`.
2. `scripts/preparar-android.sh`: poné `USAR_ADMOB=1`.
3. `www/anuncios.js`: poné `ACTIVOS: true` (los IDs de AdMob ya están cargados; los de pantalla completa y con premio se crean en AdMob).
4. `PRIVACIDAD.md`: agregá en "Servicios de terceros": *Google AdMob: muestra anuncios. Puede recopilar y usar el identificador de publicidad de tu dispositivo, la dirección IP, datos de uso de la app e información del dispositivo para mostrar anuncios y medir su rendimiento, y puede personalizarlos si lo permitís. Más información: https://policies.google.com/technologies/ads* y quitá "No mostramos anuncios…".
5. Contratá un plan de Open-Meteo y pegá la clave en `OPEN_METEO_CLAVE`.
6. Play Console: contiene anuncios = Sí, declarar el ID de publicidad en Seguridad de los datos.
Nunca toques los anuncios reales desde tu propio celular: podés suspender tu cuenta de AdMob.

## Opiniones y errores
- **⚙️ Ajustes > Opiniones y errores:** ⭐ calificar en Play Store, 🐞 reportar un error y 💡 enviar una sugerencia. Los dos últimos abren la app de correo del teléfono con el mensaje armado (versión de la app, modelo del teléfono y pantalla; sin ubicación) hacia el correo de `CONTACTO_EMAIL` (`www/nucleo.js`). La persona revisa y envía.
- **Tarjeta en "Hoy":** aparece **cada 5 veces que se abre la app**: 👍 la lleva a calificar en Play Store, 😕 a escribirte por correo, "Ahora no" (o ignorarla) la vuelve a mostrar 5 aperturas después y "No preguntar más" la saca para siempre. Quien ya calificó o escribió no la vuelve a ver. En **⚙️ Ajustes > Opiniones y errores** hay un interruptor "Recordarme dar mi opinión" para apagarla o prenderla de nuevo (al prenderla, vuelve a aparecer 5 aperturas después).
- Las reseñas de Play Store las ves y respondés desde Play Console > *Calificaciones y reseñas*; los errores (cierres inesperados) en *Calidad > Android vitals*.
- Cuando cambies de correo, editá `CONTACTO_EMAIL` en `www/nucleo.js` y el contacto de `PRIVACIDAD.md`.

## Menos llamadas (caché)
- **Pronóstico:** si el guardado es del mismo lugar y tiene menos de 30 minutos, al abrir la app o volver a ella no se vuelve a bajar. El botón de actualizar (arriba) fuerza una descarga, con un mínimo de 2 minutos entre una y otra.
- **Widget y avisos en segundo plano:** reutilizan el pronóstico guardado si tiene menos de 40 minutos (antes bajaban uno nuevo cada 30).
- **Ríos:** la consulta se guarda 3 horas, también si cerrás la app. Las crecidas históricas se calculan una sola vez por lugar.
- **Búsqueda de ciudades:** no repite la misma consulta; **nombre del lugar:** se reutiliza si no te moviste más de 1 km.
- Cálculo aproximado por persona y por día: abriendo la app ~5 veces: 5 pronósticos como máximo (menos si abre seguido) + con widget unos 24 más; con avisos de ríos hasta ~8 más.

## Cómo se actualiza la ubicación por GPS
- Se busca al abrir la app, **al volver a ella** (también con el evento `resume` de Android) y **cada 5 minutos** mientras está abierta. Solo cambia la ubicación si te moviste más de **2 km** (`GPS_MOVIMIENTO_KM` en `www/app.js`).
- Debajo del nombre del lugar se ve la hora de la última actualización ("Ubicación por GPS · actualizada 08:12"). Si falla, lo dice; en **⚙️ Ajustes > Diagnóstico** figura la "Última búsqueda de GPS" con el motivo.
- Con la app **cerrada** no se actualiza: widget y notificaciones usan la última ubicación guardada. Pedir ubicación en segundo plano exige un permiso especial de Google Play (con revisión), por eso no se usa. Abrí la app si viajaste lejos.

## GPS más rápido
- Se pide el permiso primero y sin reloj (antes corría el tiempo mientras se leía el cartel de Android).
- Primero se usa la última ubicación conocida / de red (8 s); si no alcanza, el GPS preciso (15 s). Todo tiene un límite, así que no queda "buscando" para siempre.
- El pronóstico se muestra con el nombre del lugar más cercano sin conexión y el nombre exacto se completa después.
- Si no se puede actualizar la ubicación, se sigue usando la última guardada.
