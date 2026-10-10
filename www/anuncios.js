// Anuncios (AdMob). Solo corre dentro de la app Android; en el navegador no hace nada.
// Para publicar con anuncios reales: poné PRUEBA en false y pegá tu ID de bloque de banner.
(function () {
  var CONFIG = {
    PRUEBA: true,
    BANNER_ID_REAL: "",   // ej. "ca-app-pub-1234567890123456/1234567890"
    BANNER_ID_PRUEBA: "ca-app-pub-3940256099942544/6300978111"
  };
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var AdMob = (cap.Plugins && cap.Plugins.AdMob) || (cap.registerPlugin && cap.registerPlugin("AdMob"));
  if (!AdMob) return;

  var st = document.createElement("style");
  st.textContent = "main{padding-bottom:calc(24px + var(--ad,0px))}";
  document.head.appendChild(st);

  async function iniciar() {
    try {
      try {
        var info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === "REQUIRED") await AdMob.showConsentForm();
      } catch (e) {}
      await AdMob.initialize({ initializeForTesting: CONFIG.PRUEBA });
      AdMob.addListener("bannerAdSizeChanged", function (s) {
        document.documentElement.style.setProperty("--ad", Math.round((s && s.height) || 0) + "px");
      });
      var id = CONFIG.PRUEBA ? CONFIG.BANNER_ID_PRUEBA : CONFIG.BANNER_ID_REAL;
      if (!id) return;
      var nav = document.getElementById("tabs");
      var margen = nav ? Math.round(nav.getBoundingClientRect().height) : 64;
      await AdMob.showBanner({
        adId: id, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER",
        margin: margen, isTesting: CONFIG.PRUEBA
      });
    } catch (e) { console.warn("Anuncios no disponibles", e); }
  }
  window.addEventListener("load", iniciar);
})();
