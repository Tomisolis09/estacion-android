#!/bin/bash
# Se ejecuta en GitHub después de crear el proyecto Android (npx cap add android).
# Copia el código nativo (widget, notificaciones, alertas), ajusta el manifiesto, íconos y versión.
# Para cambiar el ID real de AdMob, reemplazá el valor de ADMOB_APP_ID (formato ca-app-pub-XXXX~YYYY).
set -e
ADMOB_APP_ID="ca-app-pub-7520034420780164~2580808090"
# 0 = sin anuncios (versión actual: no se agrega AdMob al manifiesto). 1 = con anuncios (ver LEEME.md > "Anuncios")
USAR_ADMOB=0

MANIFEST=android/app/src/main/AndroidManifest.xml
[ -f "$MANIFEST" ] || { echo "ERROR: no existe $MANIFEST (¿falló 'npx cap add android'?)"; exit 1; }

# 1) Código nativo: se copia con el nombre de paquete (appId) de la app
APP_ID=$(python3 -c "import json;print(json.load(open('capacitor.config.json'))['appId'])")
[ -n "$APP_ID" ] || { echo "ERROR: no se pudo leer appId de capacitor.config.json"; exit 1; }
DEST="android/app/src/main/java/$(echo "$APP_ID" | tr . /)"
mkdir -p "$DEST"
for f in native/java/*.java; do
  sed "s/__PKG__/$APP_ID/g" "$f" > "$DEST/$(basename "$f")"
done
echo "Código nativo copiado a $DEST ($(ls native/java/*.java | wc -l) archivos)"

# 2) Recursos (diseño del widget, íconos, textos)
cp -r native/res/. android/app/src/main/res/

# 3) Manifiesto: permisos, widget, receptores de alarmas y AdMob
APP_ID="$APP_ID" ADMOB_APP_ID="$ADMOB_APP_ID" USAR_ADMOB="$USAR_ADMOB" MANIFEST="$MANIFEST" python3 - <<'PY'
import os, re
p = os.environ["MANIFEST"]
s = open(p, encoding="utf-8").read()

permisos = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
]
falta = [x for x in permisos if x not in s]
if falta:
    bloque = "".join('    <uses-permission android:name="%s" />\n' % x for x in falta)
    s = s.replace("</manifest>", bloque + "</manifest>", 1)

if "EstacionManifest" not in s:
    receptores = '''
        <!-- EstacionManifest: alarmas, reinicio y widget -->
        <receiver android:name=".AlarmaReceiver" android:exported="false" />
        <receiver android:name=".ArranqueReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
        <receiver android:name=".WidgetProvider" android:exported="true" android:label="Estación Meteorológica">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_clima_info" />
        </receiver>
'''
    s = s.replace("</application>", receptores + "    </application>", 1)

if os.environ.get("USAR_ADMOB") == "1" and "com.google.android.gms.ads.APPLICATION_ID" not in s:
    meta = '        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s" />\n' % os.environ["ADMOB_APP_ID"]
    s = s.replace("</application>", meta + "    </application>", 1)

open(p, "w", encoding="utf-8").write(s)
print("Manifiesto actualizado")
PY

# Verificaciones: si algo no quedó, se corta acá para no publicar una app incompleta
CLAVES=(".WidgetProvider" ".AlarmaReceiver" ".ArranqueReceiver" "ACCESS_FINE_LOCATION" "POST_NOTIFICATIONS")
[ "$USAR_ADMOB" = "1" ] && CLAVES+=("com.google.android.gms.ads.APPLICATION_ID")
for clave in "${CLAVES[@]}"; do
  grep -q "$clave" "$MANIFEST" || { echo "ERROR: falta $clave en el manifiesto"; exit 1; }
done
# El MainActivity propio debe registrar el plugin nativo
grep -q "registerPlugin(EstacionNativoPlugin.class)" "$DEST/MainActivity.java" || { echo "ERROR: MainActivity sin el plugin"; exit 1; }

# 4) Íconos
npx capacitor-assets generate --android

# 5) Número de versión: sube solo en cada compilación
GRADLE=android/app/build.gradle
VC="${GITHUB_RUN_NUMBER:-1}"
sed -i -E "s/versionCode [0-9]+/versionCode $VC/" "$GRADLE"
sed -i -E "s/versionName \"[^\"]*\"/versionName \"4.4.$VC\"/" "$GRADLE"
grep -q "versionCode $VC" "$GRADLE" || echo "AVISO: no se pudo actualizar el versionCode en build.gradle (revisalo a mano antes de subir a Play Store)"
grep -q "versionName \"4.4.$VC\"" "$GRADLE" || echo "AVISO: no se pudo actualizar el versionName"
echo "Listo: versión 4.4.$VC"
