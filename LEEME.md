# Estación Meteorológica – versión Android

La app web está en `www/`. GitHub la convierte en APK y AAB automáticamente.
Play Store pide **AAB** (no APK); el APK sirve para probar en tu celular.

## 1. Subir a GitHub
Creá un repositorio nuevo (ej. `estacion-android`) y subí todo el contenido de esta carpeta
(`www`, `assets`, `.github`, `package.json`, `capacitor.config.json`, `.gitignore`).
Al subirlo, entrá a la pestaña **Actions** y esperá unos 5-8 minutos a que termine la compilación.

## 2. Probar el APK
En el resultado de la compilación, descargá **apk-de-prueba**, descomprimí el zip,
pasá `app-debug.apk` al celular e instalalo (hay que permitir "instalar apps desconocidas").

## 3. Crear tu clave de firma (una sola vez, guardala bien)
En una computadora con Java:

    keytool -genkeypair -v -keystore clave.jks -alias estacion -keyalg RSA -keysize 2048 -validity 10000

Pasala a base64:  Linux/Mac `base64 -w0 clave.jks`  ·  Windows PowerShell
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("clave.jks"))`

En GitHub: Settings > Secrets and variables > Actions > New repository secret:
- `KEYSTORE_BASE64`: el texto base64
- `KEYSTORE_PASSWORD`: la contraseña que elegiste
- `KEY_ALIAS`: `estacion`

Si perdés `clave.jks` no podés actualizar la app. Guardala fuera de GitHub (nube privada o pendrive).

## 4. Subir a Play Store
1. Cuenta de desarrollador en https://play.google.com/console (pago único de USD 25).
2. Crear app > subir `app-release.aab` (artifact **aab-para-play-store**) a una pista de prueba.
3. Activar "Play App Signing" cuando lo pida. Tu clave actúa como clave de subida.
4. Completar la ficha: descripción, capturas del celular, ícono 512x512 (`www/icon-512.png`),
   gráfico de funciones 1024x500, categoría "Clima".
5. Política de privacidad: publicá `PRIVACIDAD.md` (por ejemplo con GitHub Pages) y pegá el link.
   En "Seguridad de los datos" declará ubicación aproximada, usada solo para el pronóstico.
6. Las cuentas personales nuevas deben hacer una prueba cerrada con 12 testers durante 14 días
   antes de pasar a producción. Verificá los requisitos actuales en la consola.

Cada vez que subas cambios, el `versionCode` sube solo, así que Play acepta la actualización.
