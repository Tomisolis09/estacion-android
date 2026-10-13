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

## Anuncios (AdMob)
Tus IDs reales ya están cargados (`scripts/preparar-android.sh` y `www/anuncios.js`). Nunca toques los anuncios reales
desde tu propio celular: podés suspender tu cuenta de AdMob.
