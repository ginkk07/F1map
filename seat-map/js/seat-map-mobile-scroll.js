/* =========================================================
   Seat Map Mobile Scroll
   ---------------------------------------------------------
   手機版地圖放大與滑動：
   1. 小於 mobileQuery 時啟用 .is-mobile-map-scroll
   2. 地圖 SVG 由 CSS 放大，.map-svg-wrap 負責 overflow scroll
   3. SVG 載入後自動捲到中心，避免手機一開始只看到角落
   4. 桌機版不介入
   ========================================================= */

function createNoopController() {
  return {
    init() {},
    refresh() {},
    center() {}
  };
}

export function createSeatMapMobileScroll({
  wrapRoot,
  mobileQuery = "(max-width: 768px)",
  centerOnInit = true
}) {
  if (!wrapRoot) {
    console.warn("[SeatMapMobileScroll] 找不到 .map-svg-wrap，略過手機地圖滑動功能。");
    return createNoopController();
  }

  const mediaQuery = window.matchMedia(mobileQuery);
  let initialized = false;
  let centeredOnce = false;

  function isMobile() {
    return mediaQuery.matches;
  }

  function center() {
    if (!isMobile()) return;

    const maxScrollLeft = Math.max(0, wrapRoot.scrollWidth - wrapRoot.clientWidth);
    const maxScrollTop = Math.max(0, wrapRoot.scrollHeight - wrapRoot.clientHeight);

    wrapRoot.scrollLeft = Math.round(maxScrollLeft / 2);
    wrapRoot.scrollTop = Math.round(maxScrollTop / 2);
  }

  function centerAfterLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(center);
    });
  }

  function applyState() {
    wrapRoot.classList.toggle("is-mobile-map-scroll", isMobile());

    if (!isMobile()) {
      centeredOnce = false;
      wrapRoot.scrollLeft = 0;
      wrapRoot.scrollTop = 0;
      return;
    }

    if (centerOnInit && !centeredOnce) {
      centeredOnce = true;
      centerAfterLayout();
    }
  }

  function refresh() {
    applyState();

    if (isMobile()) {
      centerAfterLayout();
    }
  }

  function handleMediaChange() {
    applyState();
  }

  function handleResize() {
    if (!isMobile()) return;
    centerAfterLayout();
  }

  function bindMediaChange() {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return;
    }

    mediaQuery.addListener(handleMediaChange);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    bindMediaChange();
    window.addEventListener("resize", handleResize);
    applyState();
  }

  return {
    init,
    refresh,
    center
  };
}
