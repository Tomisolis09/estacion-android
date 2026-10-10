#!/bin/bash
# Se ejecuta en GitHub después de crear el proyecto Android.
# Para cambiar al ID real de AdMob, reemplazá el valor de ADMOB_APP_ID (formato ca-app-pub-XXXX~YYYY).
set -e
ADMOB_APP_ID="ca-app-pub-3940256099942544~3347511713"   # ID de PRUEBA de Google

MANIFEST=android/app/src/main/AndroidManifest.xml
# permisos de ubicación
sed -i 's#</manifest>#    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n</manifest>#' "$MANIFEST"
# ID de AdMob (obligatorio para que la app no se cierre al iniciar)
sed -i "s#</application>#    <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$ADMOB_APP_ID\" />\n    </application>#" "$MANIFEST"
# íconos
npx capacitor-assets generate --android
# número de versión: sube solo en cada compilación
sed -i "s/versionCode 1/versionCode ${GITHUB_RUN_NUMBER:-1}/" android/app/build.gradle
sed -i "s/versionName \"1.0\"/versionName \"1.0.${GITHUB_RUN_NUMBER:-1}\"/" android/app/build.gradle
