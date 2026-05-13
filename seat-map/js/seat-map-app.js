/* =========================================================
   Seat Map App - 主入口
   =========================================================

   這支檔案只負責「初始化」與「串接各模組」，不要把所有細節都塞進來。

   目前 ./js/ 內各檔案職責如下：

   1. seat-data.js
      - 看台資料來源。
      - 包含 ZONE_OPTIONS、ZONE_COLOR、SEAT_DATA。
      - ZONE_OPTIONS 是固定 Zone 篩選項目，所以 ZONE 3 即使沒有座位資料也會顯示。
      - getSeatDisplayList() 會輸出完整座位資料，供地圖綁定所有 SVG 看台。
      - getGrandstandSeatDisplayList() 會只輸出一般看臺 category: "grandstand"，並依 ZONE_OPTIONS 排序。
      - 不處理 DOM、不綁事件。

   2. seat-list-view.js
      - 依 seat-data.js 產生左側 .seat-card。
      - 處理卡片點擊。
      - 處理左側卡片複選 active 狀態。
      - 依 Zone 篩選顯示 / 隱藏卡片。
      - 顯示卡片時補上 .is-entering 與 --card-index，讓 CSS 控制進場動畫。
      - 需要時讓指定卡片捲入可視範圍。

   3. seat-map-view.js
      - 載入 singapore_f1_map.svg。
      - 將 SVG 注入為 inline SVG。
      - 依 seat.mapIds 綁定 SVG 裡的看台元素。
      - 處理 SVG 看台點擊。
      - 處理地圖看台複選 active / dim 狀態。
      - 依左側 Zone 篩選狀態控制 SVG 背景 Zone 區塊顏色。
      - 統一處理「可點擊 / 不可點擊」狀態；只要座位因 Zone 或 category 不可點擊，就加上 .is-disabled。

   4. seat-info-view.js
      - 更新下方 info-bar。
      - 包含圖片、標題、描述。
      - 當所有座位取消選取時，還原預設資訊。

   5. seat-zone-filter.js
      - 管理 .zone-nav 裡的 Zone chip。
      - 點擊 Zone chip 時切換篩選狀態。
      - 起始狀態為 0 個 Zone 被選取；左側清單顯示「無座位」，地圖看台全數淡化。
      - 不依座位資料決定 Zone 是否顯示，因此沒有 ZONE 3 座位時，ZONE 3 仍可存在。
      - 不直接操作卡片與 SVG，避免耦合。

   6. seat-map-app.js
      - 主控流程。
      - 建立各模組。
      - 使用 selectedSeatIds 管理座位複選狀態。
      - 使用 activeZoneSet 管理左側座位清單的 Zone 篩選狀態。
      - 保持「卡片、地圖可點擊狀態、info-bar、Zone 篩選」同步。

   後續如果要新增功能，建議新增獨立模組，不要直接塞進本檔案：
   - 地圖 zoom / focus：seat-map-focus.js
   - 手機橫向清單 active 判斷：seat-mobile-carousel.js
   ========================================================= */

import { ZONE_OPTIONS, ZONE_COLOR, findSeatById, getSeatDisplayList } from "./seat-data.js";
import { createSeatListView } from "./seat-list-view.js";
import { createSeatMapView } from "./seat-map-view.js";
import { createSeatInfoView } from "./seat-info-view.js";
import { createSeatZoneFilter } from "./seat-zone-filter.js";
import { createMobileSeatListToggle } from "./seat-mobile-list-toggle.js";
import { createSeatMapMobileScroll } from "./seat-map-mobile-scroll.js";
import { createSeatCategoryToggle } from "./seat-category-toggle.js";

function getRequiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`[SeatMapApp] 找不到必要元素：${selector}`);
  }

  return element;
}

function refreshSeatListFade() {
  // 目前 seat-list-fade.js 沒有對外 export，所以先用 resize 事件觸發它重算。
  // 如果你願意修改 seat-list-fade.js，可把 updateSeatListFade 掛到 window 上再直接呼叫。
  window.dispatchEvent(new Event("resize"));
}

function createSeatMapApp() {
  const seatListRoot = getRequiredElement(".seat-list");
  const mapHostRoot = getRequiredElement(".map-svg[data-svg-src]");
  const infoRoot = getRequiredElement(".info-bar");
  const zoneRoot = getRequiredElement(".zone-nav");

  // 左側列表與地圖都使用完整 SEAT_DATA。
  // 實際可見 / 可點擊項目由 activeZoneSet + activeCategory 決定。
  const listSeats = getSeatDisplayList();
  const mapSeats = getSeatDisplayList();

  // 起始狀態：所有 Zone 都未選取。
  // 這樣載入後左側座位列表會先顯示「無座位」，等使用者選 Zone 後再出現座位。
  let activeZoneSet = new Set();
  let activeCategory = "grandstand";
  const selectedSeatIds = new Set();

  // 記錄選取順序，用來決定 info-bar 顯示哪一筆。
  // 複選時：最後被選取的座位會顯示在 info-bar。
  let selectedOrder = [];
  let currentInfoSeatId = null;

  const seatListView = createSeatListView({
    root: seatListRoot,
    seats: listSeats,
    zones: ZONE_OPTIONS,
    zoneColors: ZONE_COLOR,
    onToggle: toggleSeatSelection
  });

  const seatMapView = createSeatMapView({
    root: mapHostRoot,
    svgSrc: mapHostRoot.dataset.svgSrc,
    // 地圖必須綁定完整座位資料。
    // 左側列表只顯示 grandstand，但 hospitality 仍需要被 JS 綁到，才能套用 .is-disabled 淡化。
    seats: mapSeats,
    zones: ZONE_OPTIONS,
    zoneColors: ZONE_COLOR,
    clickableSeatIds: getClickableSeatIds(),
    initialActiveZones: activeZoneSet,
    onToggle: toggleSeatSelection
  });

  const seatInfoView = createSeatInfoView({
    root: infoRoot
  });

  const seatZoneFilter = createSeatZoneFilter({
    root: zoneRoot,
    zones: ZONE_OPTIONS,
    initialActiveZones: activeZoneSet,
    onChange: applyZoneFilter
  });

  const seatCategoryToggle = createSeatCategoryToggle({
    root: document.querySelector(".seat-category-toggle"),
    initialCategory: activeCategory,
    onChange: applyCategoryFilter
  });

  const mobileSeatListToggle = createMobileSeatListToggle({
    pageRoot: document.querySelector(".seat-page"),
    sidebarRoot: document.querySelector(".seat-sidebar"),
    buttonRoot: document.querySelector(".map-help"),
    mobileQuery: "(max-width: 768px)",
    defaultOpen: true
  });

  const seatMapMobileScroll = createSeatMapMobileScroll({
    wrapRoot: document.querySelector(".map-svg-wrap"),
    mobileQuery: "(max-width: 768px)"
  });

  function getVisibleSeats() {
    return listSeats.filter((seat) => {
      return activeZoneSet.has(seat.zone) && seat.category === activeCategory;
    });
  }

  function getClickableSeatIds() {
    return new Set(getVisibleSeats().map((seat) => seat.id));
  }

  function syncClickableSeats() {
    seatMapView.setClickableSeatIds(getClickableSeatIds());
  }

  function getAvailableZonesForCategory(category = activeCategory) {
    const zoneSet = new Set();

    listSeats.forEach((seat) => {
      if (seat.category === category) {
        zoneSet.add(seat.zone);
      }
    });

    return [...zoneSet];
  }

  function syncAvailableZonesForCategory() {
    seatZoneFilter.setAvailableZones(getAvailableZonesForCategory(activeCategory), {
      emit: false
    });

    // 若 category 切換後，原本選取的 Zone 在新 category 沒內容，
    // setAvailableZones() 會移除那些 active zone，所以這裡要同步回主控狀態。
    activeZoneSet = new Set(seatZoneFilter.getActiveZones());
  }

  function isSeatVisible(seatId) {
    const seat = findSeatById(seatId);
    if (!seat) return false;

    return activeZoneSet.has(seat.zone) && seat.category === activeCategory;
  }

  function getLastSelectedVisibleSeat() {
    for (let i = selectedOrder.length - 1; i >= 0; i -= 1) {
      const seatId = selectedOrder[i];

      if (selectedSeatIds.has(seatId) && isSeatVisible(seatId)) {
        return findSeatById(seatId);
      }
    }

    return null;
  }

  function syncSelectionViews() {
    seatListView.setSelected(selectedSeatIds);
    seatMapView.setSelected(selectedSeatIds);
  }

  function syncInfoBySelection() {
    const currentSeatStillUsable =
      currentInfoSeatId && selectedSeatIds.has(currentInfoSeatId) && isSeatVisible(currentInfoSeatId);

    if (currentSeatStillUsable) {
      const seat = findSeatById(currentInfoSeatId);
      if (seat) seatInfoView.update(seat);
      return;
    }

    const fallbackSeat = getLastSelectedVisibleSeat();

    if (fallbackSeat) {
      currentInfoSeatId = fallbackSeat.id;
      seatInfoView.update(fallbackSeat);
    } else {
      currentInfoSeatId = null;
      seatInfoView.reset();
    }
  }

  function toggleSeatSelection(seatId, options = {}) {
    const seat = findSeatById(seatId);

    if (!seat) {
      console.warn(`[SeatMapApp] 找不到 seatId：${seatId}`);
      return;
    }

    // 只要因 Zone 或 category 不可點擊，就不允許被選取或取消。
    if (!isSeatVisible(seat.id)) {
      return;
    }

    const willSelect = !selectedSeatIds.has(seat.id);

    if (willSelect) {
      selectedSeatIds.add(seat.id);
      selectedOrder = selectedOrder.filter((id) => id !== seat.id);
      selectedOrder.push(seat.id);
      currentInfoSeatId = seat.id;
      seatInfoView.update(seat);
    } else {
      selectedSeatIds.delete(seat.id);
      selectedOrder = selectedOrder.filter((id) => id !== seat.id);

      if (currentInfoSeatId === seat.id) {
        currentInfoSeatId = null;
      }

      syncInfoBySelection();
    }

    syncSelectionViews();

    if (options.source === "map") {
      seatListView.scrollToSeat(seat.id);
    }

    document.dispatchEvent(
      new CustomEvent("seatmap:selectionchange", {
        detail: {
          seat,
          selected: willSelect,
          selectedSeatIds: [...selectedSeatIds],
          source: options.source || "app"
        }
      })
    );
  }

  function applyZoneFilter(activeZones, options = {}) {
    activeZoneSet = new Set(activeZones);

    seatListView.setFilter(activeZoneSet, activeCategory);
    seatMapView.setFilter(activeZoneSet);
    syncClickableSeats();
    syncSelectionViews();
    syncInfoBySelection();
    refreshSeatListFade();

    document.dispatchEvent(
      new CustomEvent("seatmap:zonechange", {
        detail: {
          activeZones: [...activeZoneSet],
          visibleSeats: getVisibleSeats(),
          selectedSeatIds: [...selectedSeatIds],
          source: options.source || "app"
        }
      })
    );
  }

  function applyCategoryFilter(category, options = {}) {
    activeCategory = String(category || "grandstand")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    syncAvailableZonesForCategory();
    seatListView.setFilter(activeZoneSet, activeCategory);
    seatMapView.setFilter(activeZoneSet);
    syncClickableSeats();
    syncSelectionViews();
    syncInfoBySelection();
    refreshSeatListFade();

    document.dispatchEvent(
      new CustomEvent("seatmap:categorychange", {
        detail: {
          activeCategory,
          visibleSeats: getVisibleSeats(),
          selectedSeatIds: [...selectedSeatIds],
          source: options.source || "app"
        }
      })
    );
  }

  function clearSelection() {
    selectedSeatIds.clear();
    selectedOrder = [];
    currentInfoSeatId = null;
    syncSelectionViews();
    seatInfoView.reset();

    document.dispatchEvent(
      new CustomEvent("seatmap:selectionchange", {
        detail: {
          seat: null,
          selected: false,
          selectedSeatIds: [],
          source: "clear-selection"
        }
      })
    );
  }

  function setSelectedSeats(seatIds) {
    selectedSeatIds.clear();
    selectedOrder = [];

    seatIds.forEach((seatId) => {
      const seat = findSeatById(seatId);
      if (!seat) return;

      selectedSeatIds.add(seat.id);
      selectedOrder.push(seat.id);
    });

    const infoSeat = getLastSelectedVisibleSeat();
    currentInfoSeatId = infoSeat ? infoSeat.id : null;

    syncSelectionViews();
    syncInfoBySelection();
  }

  async function init() {
    seatListView.render();
    seatZoneFilter.init();
    seatCategoryToggle.init();
    mobileSeatListToggle.init();
    seatMapMobileScroll.init();

    activeZoneSet = new Set(seatZoneFilter.getActiveZones());
    activeCategory = seatCategoryToggle.getActiveCategory();

    syncAvailableZonesForCategory();
    seatListView.setFilter(activeZoneSet, activeCategory);
    refreshSeatListFade();

    await seatMapView.load();
    seatMapMobileScroll.refresh();
    seatMapView.setFilter(activeZoneSet);
    syncClickableSeats();
    syncSelectionViews();
    seatInfoView.reset();

    const missingMapIds = seatMapView.getMissingMapIds();
    if (missingMapIds.length > 0) {
      console.warn("[SeatMapApp] 以下 mapIds 沒有在 SVG 中找到：", missingMapIds);
    }
  }

  return {
    init,

    // Console 測試用：SeatMapApp.toggleSeatSelection("pit-grandstand")
    toggleSeatSelection,

    // Console 測試用：SeatMapApp.setSelectedSeats(["pit-grandstand", "turn-1-grandstand"])
    setSelectedSeats,

    // Console 測試用：SeatMapApp.clearSelection()
    clearSelection,

    // Console 測試用：SeatMapApp.applyZoneFilter(["ZONE 1", "ZONE 4"])
    // 可以傳 []，代表 0 個 Zone 被選取。
    applyZoneFilter,

    // Console 測試用：SeatMapApp.applyCategoryFilter("hospitality")
    applyCategoryFilter,

    getSelectedSeatIds() {
      return [...selectedSeatIds];
    },
    getActiveZones() {
      return [...activeZoneSet];
    },
    getActiveCategory() {
      return activeCategory;
    }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const app = createSeatMapApp();
    await app.init();

    // 開發階段保留，方便你在 console 測試。
    window.SeatMapApp = app;
  } catch (error) {
    console.error("[SeatMapApp] 初始化失敗：", error);
  }
});
