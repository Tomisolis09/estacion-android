# Estación Meteorológica v2 – Android

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
6. En la versión APK los anuncios son siempre de **prueba** (automático).

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
En la versión de Play Store los anuncios son **reales** automáticamente (no hace falta editar `anuncios.js`).
Antes de publicar actualizá en Play Console:
1. **Seguridad de los datos:** ubicación (precisa y aproximada) recopilada y compartida con servicios de terceros para el
   funcionamiento de la app; no se guarda en servidores propios; identificadores de dispositivo/publicidad por AdMob.
2. **Política de privacidad:** republicá el nuevo `PRIVACIDAD.md`.
3. **Contenido de la app:** contiene anuncios = Sí.
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

## Anuncios (AdMob)
Tus IDs reales ya están cargados (`scripts/preparar-android.sh` y `www/anuncios.js`). Nunca toques los anuncios reales
desde tu propio celular: podés suspender tu cuenta de AdMob.
