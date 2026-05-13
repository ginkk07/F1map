/* =========================================================
   Seat Map View
   ---------------------------------------------------------
   負責右側 SVG 地圖：
   1. fetch 載入 SVG，注入成 inline SVG
   2. 依 seat.mapIds 綁定 SVG 看台元素
   3. 綁定 SVG 看台點擊事件
   4. 更新 SVG 看台複選 active 狀態
   5. 依左側 Zone 篩選狀態，控制 SVG 背景 Zone 區塊顏色
   6. 統一處理看台可點擊狀態：只要因 Zone 或 category 不可點擊，就加上 is-disabled
   7. 可點擊看台會加上 is-clickable，並使用 --seat-filter-color 控制篩選開啟時的看台顏色
   8. 座位被選取後，不再把其他可點擊看台加上 is-dim；只有不可點擊才淡化

   注意：
   - 不能用 <img src="xxx.svg"> 做互動，因為 JS 無法選取 SVG 內部元素。
   - 這裡沿用原本 HTML 的 .map-svg class，但元素需從 <img> 改為 <div>。
   - SVG 裡有特殊 id，例如 observ_x40_turn3.5，所以選取時必須使用 CSS.escape。
   - Zone 篩選的主要作用在左側座位列表。
   - Zone 色套在 SVG 的 #zone-1、#zone-2、#zone-3、#zone-4 背景區塊。
   - 看台淡化不分原因：Zone 未選、category 不在目前列表內，皆視為不可點擊並套用 is-disabled。
   - 可由 initialActiveZones 控制起始啟用 Zone；seat-map-app.js 目前傳入 []，所以起始全部未選取。
   ========================================================= */

function findSvgElementById(svgRoot, id) {
  if (!svgRoot || !id) return null;

  if (window.CSS && typeof window.CSS.escape === "function") {
    return svgRoot.querySelector(`#${window.CSS.escape(id)}`);
  }

  return Array.from(svgRoot.querySelectorAll("[id]")).find((el) => el.id === id) || null;
}

function getSeatByMapTarget(seats, target) {
  const seatId = target.dataset.seatId;
  return seats.find((seat) => seat.id === seatId) || null;
}

function normalizeZone(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function zoneToSvgId(zone) {
  const normalizedZone = normalizeZone(zone);

  // SVG 目前使用 id="paddock_zone"。
  // 這裡保留特殊對應，避免必須把 SVG 改成 id="paddock-zone"。
  if (normalizedZone === "PADDOCK ZONE") {
    return "paddock_zone";
  }

  return normalizedZone.toLowerCase().replace(/\s+/g, "-");
}

function createSeatIdSet(seatIds, seats) {
  if (seatIds instanceof Set) return new Set(seatIds);
  if (Array.isArray(seatIds)) return new Set(seatIds);

  // 未提供 clickableSeatIds 時，預設所有傳入 seats 都可點擊。
  return new Set(seats.map((seat) => seat.id));
}

function createActiveZoneSet(initialActiveZones, zones, seats) {
  if (initialActiveZones instanceof Set) {
    return new Set(Array.from(initialActiveZones, normalizeZone));
  }

  if (Array.isArray(initialActiveZones)) {
    return new Set(initialActiveZones.map(normalizeZone));
  }

  // 未指定 initialActiveZones 時，保留舊行為：預設全部 Zone 啟用。
  // seat-map-app.js 會明確傳入 []，讓頁面起始狀態為全部未選取。
  return new Set(zones.length ? zones.map(normalizeZone) : seats.map((seat) => normalizeZone(seat.zone)));
}

export function createSeatMapView({ root, svgSrc, seats, zones = [], zoneColors = {}, clickableSeatIds = null, initialActiveZones = undefined, onToggle }) {
  if (!root) {
    throw new Error("createSeatMapView: 找不到 .map-svg[data-svg-src]");
  }

  let svg = null;
  const targetList = [];
  const zoneTargetList = [];
  const missingMapIds = [];
  const missingZoneIds = [];
  let activeZoneSet = createActiveZoneSet(initialActiveZones, zones, seats);
  let clickableSeatIdSet = createSeatIdSet(clickableSeatIds, seats);

  function isTargetClickable(target) {
    return activeZoneSet.has(target.dataset.zone) && clickableSeatIdSet.has(target.dataset.seatId);
  }

  async function load() {
    if (!svgSrc) {
      throw new Error("createSeatMapView: .map-svg 缺少 data-svg-src");
    }

    root.classList.add("is-loading");

    const response = await fetch(svgSrc);

    if (!response.ok) {
      throw new Error(`SVG 載入失敗：${response.status} ${response.statusText}`);
    }

    const svgText = await response.text();
    root.innerHTML = svgText;

    svg = root.querySelector("svg");

    if (!svg) {
      throw new Error("SVG 載入失敗：內容中找不到 <svg>");
    }

    svg.classList.add("map-svg__inline");
    svg.setAttribute("aria-hidden", "false");

    bindZoneTargets();
    bindSeatTargets();
    setFilter(activeZoneSet);

    root.classList.remove("is-loading");
  }

  function bindZoneTargets() {
    zoneTargetList.length = 0;
    missingZoneIds.length = 0;

    zones.forEach((zone) => {
      const normalizedZone = normalizeZone(zone);
      const zoneSvgId = zoneToSvgId(normalizedZone);
      const zoneTarget = findSvgElementById(svg, zoneSvgId);

      if (!zoneTarget) {
        missingZoneIds.push(zoneSvgId);
        console.warn(`[SeatMap] 找不到 SVG Zone 區塊：#${zoneSvgId}`);
        return;
      }

      zoneTarget.classList.add("map-zone-target");
      zoneTarget.dataset.zone = normalizedZone;
      zoneTarget.style.setProperty("--zone-color", zoneColors[normalizedZone] || "#e8ff1c");
      zoneTarget.setAttribute("aria-hidden", "true");

      zoneTargetList.push(zoneTarget);
    });
  }

  function bindSeatTargets() {
    targetList.length = 0;
    missingMapIds.length = 0;

    seats.forEach((seat) => {
      seat.mapIds.forEach((mapId) => {
        const target = findSvgElementById(svg, mapId);

        if (!target) {
          missingMapIds.push(mapId);
          console.warn(`[SeatMap] 找不到 SVG 看台：#${mapId}`);
          return;
        }

        target.classList.add("map-seat-target");
        target.dataset.seatId = seat.id;
        target.dataset.zone = normalizeZone(seat.zone);
        target.style.setProperty("--seat-color", seat.color);
        target.style.setProperty("--seat-filter-color", seat.filterColor || seat.color);
        target.setAttribute("role", "button");
        target.setAttribute("tabindex", "0");
        target.setAttribute("aria-label", seat.title);
        target.setAttribute("aria-pressed", "false");
        target.setAttribute("aria-disabled", "false");

        target.addEventListener("click", (event) => {
          event.stopPropagation();

          if (!isTargetClickable(target)) return;

          onToggle(seat.id, { source: "map" });
        });

        target.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (!isTargetClickable(target)) return;

          event.preventDefault();
          onToggle(seat.id, { source: "map" });
        });

        targetList.push(target);
      });
    });
  }

  function updateZoneTargets() {
    zoneTargetList.forEach((zoneTarget) => {
      const isZoneActive = activeZoneSet.has(zoneTarget.dataset.zone);

      zoneTarget.classList.toggle("is-zone-active", isZoneActive);
      zoneTarget.classList.toggle("is-zone-dim", !isZoneActive);
    });
  }

  function setSelected(selectedSeatIds) {
    const selectedSet = selectedSeatIds instanceof Set ? selectedSeatIds : new Set(selectedSeatIds);

    targetList.forEach((target) => {
      const seat = getSeatByMapTarget(seats, target);
      const isClickable = isTargetClickable(target);
      const isSelected = selectedSet.has(target.dataset.seatId) && isClickable;

      target.classList.toggle("is-active", isSelected);
      target.classList.toggle("is-clickable", isClickable);
      target.classList.toggle("is-disabled", !isClickable);

      // 現在的規則是：只有「不可被點擊」才淡化。
      // 其他可點擊但未被選取的看台，仍維持 --seat-filter-color，不再加 is-dim。
      target.classList.remove("is-dim", "is-zone-dim");

      target.setAttribute("aria-pressed", isSelected ? "true" : "false");
      target.setAttribute("aria-disabled", isClickable ? "false" : "true");
      target.setAttribute("tabindex", isClickable ? "0" : "-1");

      if (seat) {
        target.style.setProperty("--seat-color", seat.color);
        target.style.setProperty("--seat-filter-color", seat.filterColor || seat.color);
      }
    });

    updateZoneTargets();
  }

  function setFilter(activeZones) {
    activeZoneSet = activeZones instanceof Set ? activeZones : new Set(activeZones);
    activeZoneSet = new Set(Array.from(activeZoneSet, normalizeZone));

    updateZoneTargets();

    targetList.forEach((target) => {
      const isClickable = isTargetClickable(target);

      target.classList.toggle("is-clickable", isClickable);
      target.classList.toggle("is-disabled", !isClickable);
      target.classList.remove("is-dim", "is-zone-dim");
      target.setAttribute("aria-disabled", isClickable ? "false" : "true");
      target.setAttribute("tabindex", isClickable ? "0" : "-1");
    });
  }

  function setClickableSeatIds(seatIds) {
    clickableSeatIdSet = createSeatIdSet(seatIds, seats);

    targetList.forEach((target) => {
      const isClickable = isTargetClickable(target);

      target.classList.toggle("is-clickable", isClickable);
      target.classList.toggle("is-disabled", !isClickable);
      target.classList.remove("is-dim", "is-zone-dim");
      target.setAttribute("aria-disabled", isClickable ? "false" : "true");
      target.setAttribute("tabindex", isClickable ? "0" : "-1");
    });
  }

  function clearSelected() {
    targetList.forEach((target) => {
      target.classList.remove("is-active", "is-dim");
      target.setAttribute("aria-pressed", "false");
    });
  }

  function getMissingMapIds() {
    return [...missingMapIds];
  }

  function getMissingZoneIds() {
    return [...missingZoneIds];
  }

  return {
    load,
    setSelected,
    setFilter,
    setClickableSeatIds,
    clearSelected,
    getMissingMapIds,
    getMissingZoneIds
  };
}
