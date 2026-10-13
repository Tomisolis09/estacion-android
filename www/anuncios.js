// Anuncios (AdMob). Solo corre dentro de la app Android; en el navegador no hace nada.
// En la versión de prueba (APK) los anuncios son siempre de prueba, automáticamente.
// En la versión para Play Store (AAB) se usan los anuncios reales.
//
// CICLO (se repite siempre):
//   · BANNER: aparece 1 minuto y se va.
//   · Pasan 3 minutos sin anuncios y vuelve a aparecer.
//   · PANTALLA COMPLETA (o video: AdMob decide si muestra imagen o video): como máximo UNO por cada
//     ventana de 1 minuto, y solo cuando el usuario cambia de solapa o cierra una hoja (así no interrumpe).
//     Nunca se muestra si hay una alerta naranja/roja, un sismo fuerte o un tsunami en pantalla.
//   · VIDEO CON PREMIO (opcional): botón en Ajustes; el usuario elige verlo y a cambio no ve anuncios 30 min.
(function () {
  var CONFIG = {
    FORZAR_PRUEBA: false, // ponelo en true solo si querés ver anuncios de prueba también en la versión publicada

    VISIBLE_MS: 60 * 1000,        // cuánto tiempo está el banner
    OCULTO_MS: 3 * 60 * 1000,     // cuánto tiempo pasa sin anuncios antes de volver
    PAUSA_PREMIO_MS: 30 * 60 * 1000,

    // Banner
    BANNER_ID_REAL: "ca-app-pub-7520034420780164/9952951521",
    BANNER_ID_PRUEBA: "ca-app-pub-3940256099942544/6300978111",
    // Pantalla completa / video. Creá estas unidades en AdMob (Anuncios > Unidades de anuncios) y pegá el ID acá.
    // Mientras estén vacías, en la versión publicada solo se muestra el banner (en la de prueba se ven igual).
    INTERSTICIAL_ID_REAL: "",
    INTERSTICIAL_ID_PRUEBA: "ca-app-pub-3940256099942544/1033173712",
    // Video con premio (el usuario lo elige).
    PREMIO_ID_REAL: "",
    PREMIO_ID_PRUEBA: "ca-app-pub-3940256099942544/5224354917"
  };

  var cap = window.Capacitor;
  var API = { transicion: function () {}, videoDisponible: function () { return false; }, videoPremio: function () { return Promise.resolve({ ok: false }); } };
  window.ANUNCIOS = API;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var AdMob = (cap.Plugins && cap.Plugins.AdMob) || (cap.registerPlugin && cap.registerPlugin("AdMob"));
  if (!AdMob) return;

  var st = document.createElement("style");
  st.textContent = "main{padding-bottom:calc(24px + var(--ad,0px))}";
  document.head.appendChild(st);

  var prueba = true;          // ante cualquier duda se usan anuncios de prueba (más seguro para la cuenta de AdMob)
  var listo = false;          // AdMob ya inició
  var t0 = Date.now();        // inicio del ciclo
  var bannerVisible = false;
  var pantallaMostradaEnEstaVentana = false;
  var inter = { listo: false, cargando: false, mostrando: false };
  var pausaHasta = 0;
  try { pausaHasta = Number(localStorage.getItem("anuncios_pausa")) || 0; } catch (e) {}

  function idBanner() { return prueba ? CONFIG.BANNER_ID_PRUEBA : CONFIG.BANNER_ID_REAL; }
  function idInter() { return prueba ? CONFIG.INTERSTICIAL_ID_PRUEBA : CONFIG.INTERSTICIAL_ID_REAL; }
  function idPremio() { return prueba ? CONFIG.PREMIO_ID_PRUEBA : CONFIG.PREMIO_ID_REAL; }
  function altoAnuncio(px) { document.documentElement.style.setProperty("--ad", Math.round(px || 0) + "px"); }

  async function esPrueba() {
    if (CONFIG.FORZAR_PRUEBA) return true;
    try {
      var en = window.EST_NATIVO;
      if (!en) return true;
      var r = await en.esDepuracion();
      return !r || r.depuracion !== false;
    } catch (e) { return true; }
  }

  // ---------- banner ----------
  async function mostrarBanner() {
    var id = idBanner();
    if (!id || bannerVisible) return;
    bannerVisible = true; // se marca antes para no pedirlo dos veces
    try {
      var nav = document.getElementById("tabs");
      var margen = nav ? Math.round(nav.getBoundingClientRect().height) : 64;
      await AdMob.showBanner({ adId: id, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: margen, isTesting: prueba });
    } catch (e) { bannerVisible = false; console.warn("Banner no disponible", e); }
  }
  async function ocultarBanner() {
    if (!bannerVisible) return;
    bannerVisible = false;
    altoAnuncio(0);
    try { await AdMob.removeBanner(); } catch (e) {}
  }

  // ---------- pantalla completa / video ----------
  async function prepararInter() {
    var id = idInter();
    if (!id || inter.listo || inter.cargando || inter.mostrando) return;
    inter.cargando = true;
    try { await AdMob.prepareInterstitial({ adId: id, isTesting: prueba }); inter.listo = true; }
    catch (e) { inter.listo = false; }
    inter.cargando = false;
  }
  function puedeInterrumpir() {
    if (document.hidden) return false;
    try { return !window.ANUNCIOS_PERMITIR_PANTALLA_COMPLETA || window.ANUNCIOS_PERMITIR_PANTALLA_COMPLETA() !== false; }
    catch (e) { return false; }
  }
  // La app la llama al cambiar de solapa o cerrar una hoja (momentos naturales para un anuncio)
  API.transicion = function () {
    if (!listo || !bannerVisible || pantallaMostradaEnEstaVentana || !inter.listo || inter.mostrando) return;
    if (Date.now() < pausaHasta || !puedeInterrumpir()) return;
    pantallaMostradaEnEstaVentana = true;
    inter.mostrando = true; inter.listo = false;
    AdMob.showInterstitial().catch(function () {}).then(function () { inter.mostrando = false; });
  };

  // ---------- video con premio (lo elige el usuario) ----------
  API.videoDisponible = function () { return listo && !!idPremio(); };
  API.videoPremio = async function () {
    if (!API.videoDisponible()) return { ok: false };
    try {
      await AdMob.prepareRewardVideoAd({ adId: idPremio(), isTesting: prueba });
      var r = await AdMob.showRewardVideoAd();
      if (r) { darPausa(); return { ok: true }; }
      return { ok: false };
    } catch (e) { return { ok: false }; }
  };
  function darPausa() {
    pausaHasta = Date.now() + CONFIG.PAUSA_PREMIO_MS;
    try { localStorage.setItem("anuncios_pausa", String(pausaHasta)); } catch (e) {}
    ocultarBanner();
  }

  // ---------- reloj del ciclo ----------
  // Se calcula con la hora real (no con temporizadores sueltos), así no se descontrola si Android frena la app.
  async function tic() {
    if (!listo) return;
    var ahora = Date.now();
    if (ahora < pausaHasta) { t0 = pausaHasta; return; }
    var pos = (ahora - t0) % (CONFIG.VISIBLE_MS + CONFIG.OCULTO_MS);
    var debeVerse = pos < CONFIG.VISIBLE_MS;
    if (debeVerse && !bannerVisible) {
      pantallaMostradaEnEstaVentana = false; // ventana nueva: vuelve a haber un anuncio de pantalla completa disponible
      await mostrarBanner();
    } else if (!debeVerse && bannerVisible) {
      await ocultarBanner();
    }
    if (!debeVerse) prepararInter(); // se carga durante los 3 minutos sin anuncios, listo para la próxima ventana
  }

  async function iniciar() {
    try {
      prueba = await esPrueba();
      try {
        var info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === "REQUIRED") await AdMob.showConsentForm();
      } catch (e) {}
      await AdMob.initialize({ initializeForTesting: prueba });
      AdMob.addListener("bannerAdSizeChanged", function (s) { if (bannerVisible) altoAnuncio(s && s.height); });
      AdMob.addListener("interstitialAdDismissed", function () { inter.mostrando = false; });
      AdMob.addListener("interstitialAdFailedToShow", function () { inter.mostrando = false; });
      listo = true;
      t0 = Date.now();
      prepararInter();
      tic();
      setInterval(tic, 3000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) tic(); });
    } catch (e) { console.warn("Anuncios no disponibles", e); }
  }
  window.addEventListener("load", iniciar);
})();
