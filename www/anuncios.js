// Anuncios (AdMob). Solo corre dentro de la app Android; en el navegador no hace nada.
// En la versión de prueba (APK) los anuncios son siempre de prueba, automáticamente.
// En la versión para Play Store (AAB) se usan los anuncios reales. No hace falta editar nada al publicar.
(function () {
  var CONFIG = {
    FORZAR_PRUEBA: false, // ponelo en true solo si querés ver anuncios de prueba también en la versión publicada
    BANNER_ID_REAL: "ca-app-pub-7520034420780164/9952951521",
    BANNER_ID_PRUEBA: "ca-app-pub-3940256099942544/6300978111"
  };
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var AdMob = (cap.Plugins && cap.Plugins.AdMob) || (cap.registerPlugin && cap.registerPlugin("AdMob"));
  if (!AdMob) return;

  var st = document.createElement("style");
  st.textContent = "main{padding-bottom:calc(24px + var(--ad,0px))}";
  document.head.appendChild(st);

  // true = anuncios de prueba. Ante cualquier duda se usan los de prueba (más seguro para la cuenta de AdMob).
  async function esPrueba() {
    if (CONFIG.FORZAR_PRUEBA) return true;
    try {
      var en = window.EST_NATIVO;
      if (!en) return true;
      var r = await en.esDepuracion();
      return !r || r.depuracion !== false;
    } catch (e) { return true; }
  }

  async function iniciar() {
    try {
      var prueba = await esPrueba();
      try {
        var info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === "REQUIRED") await AdMob.showConsentForm();
      } catch (e) {}
      await AdMob.initialize({ initializeForTesting: prueba });
      AdMob.addListener("bannerAdSizeChanged", function (s) {
        document.documentElement.style.setProperty("--ad", Math.round((s && s.height) || 0) + "px");
      });
      var id = prueba ? CONFIG.BANNER_ID_PRUEBA : CONFIG.BANNER_ID_REAL;
      if (!id) return;
      var nav = document.getElementById("tabs");
      var margen = nav ? Math.round(nav.getBoundingClientRect().height) : 64;
      await AdMob.showBanner({
        adId: id, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER",
        margin: margen, isTesting: prueba
      });
    } catch (e) { console.warn("Anuncios no disponibles", e); }
  }
  window.addEventListener("load", iniciar);
})();
