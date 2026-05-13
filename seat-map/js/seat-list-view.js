/* =========================================================
   Seat List View
   ---------------------------------------------------------
   負責左側看台卡片：
   1. 依資料產生 .seat-card
   2. 綁定卡片點擊事件
   3. 更新卡片複選狀態
   4. 依 Zone 篩選顯示 / 隱藏卡片
   5. 顯示卡片時，補上動畫 class 與 --card-index
   6. 沒有任何座位可顯示時，顯示「無座位」
   7. 需要時將指定卡片捲入可視範圍
   ========================================================= */

const CARD_ENTER_CLASS = "is-entering";

function createElement(tagName, className) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
}

function createEmptyState() {
  const item = createElement("li", "seat-list-empty");

  item.textContent = "無座位";
  item.hidden = true;
  item.setAttribute("aria-hidden", "true");

  return item;
}

function restartCardEnterAnimation(card, visibleIndex) {
  if (!card) return;

  card.style.setProperty("--card-index", visibleIndex);

  // 同一個元素重複套用相同 animation class 時，瀏覽器不一定會重播動畫。
  // 先移除 class，強制讀取 offsetWidth 觸發 reflow，再加回 class。
  card.classList.remove(CARD_ENTER_CLASS);
  void card.offsetWidth;
  card.classList.add(CARD_ENTER_CLASS);
}

function createSeatCard(seat, index, onToggle) {
  const card = createElement("li", `seat-card ${CARD_ENTER_CLASS}`);
  card.dataset.seatId = seat.id;
  card.dataset.zone = seat.zone;
  card.dataset.category = seat.category;
  card.style.setProperty("--zone-color", seat.color);
  card.style.setProperty("--card-index", index);
  card.setAttribute("aria-pressed", "false");

  const photo = createElement("div", "seat-card-photo");
  const image = document.createElement("img");
  image.src = seat.image;
  image.alt = "";
  photo.appendChild(image);

  const content = createElement("div", "seat-card__content");

  const title = document.createElement("h2");
  title.textContent = seat.title;

  const badge = createElement("span", "zone-badge");
  badge.textContent = seat.zone;

  content.append(title, badge);
  card.append(photo, content);

  card.addEventListener("click", () => {
    if (card.hidden || card.classList.contains("is-hidden")) return;
    onToggle(seat.id, { source: "list" });
  });

  // 動畫播放完移除 class，避免 hover / active 狀態被進場動畫殘留影響。
  // 下一次 Zone 篩選顯示時，setFilter() 會重新加回這個 class。
  card.addEventListener("animationend", (event) => {
    if (event.target !== card) return;
    card.classList.remove(CARD_ENTER_CLASS);
  });

  return card;
}

export function createSeatListView({ root, seats, onToggle }) {
  if (!root) {
    throw new Error("createSeatListView: 找不到 .seat-list");
  }

  // 起始狀態由 seat-map-app.js 控制；目前預設沒有任何 Zone 被選取。
  let activeZoneSet = new Set();
  let activeCategory = "grandstand";
  let emptyStateEl = null;

  function updateEmptyState(visibleCount) {
    if (!emptyStateEl) return;

    const shouldShowEmpty = visibleCount === 0;

    emptyStateEl.hidden = !shouldShowEmpty;
    emptyStateEl.classList.toggle("is-active", shouldShowEmpty);
    emptyStateEl.setAttribute("aria-hidden", shouldShowEmpty ? "false" : "true");
  }

  function render() {
    const fragment = document.createDocumentFragment();

    root.innerHTML = "";

    seats.forEach((seat, index) => {
      fragment.appendChild(createSeatCard(seat, index, onToggle));
    });

    emptyStateEl = createEmptyState();
    fragment.appendChild(emptyStateEl);

    root.appendChild(fragment);
    setFilter(activeZoneSet);
  }

  function setSelected(selectedSeatIds) {
    const selectedSet = selectedSeatIds instanceof Set ? selectedSeatIds : new Set(selectedSeatIds);

    root.querySelectorAll(".seat-card").forEach((card) => {
      const isVisible =
        activeZoneSet.has(card.dataset.zone) &&
        card.dataset.category === activeCategory;
      const isSelected = selectedSet.has(card.dataset.seatId) && isVisible;

      card.classList.toggle("is-active", isSelected);
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function normalizeCategory(value) {
    return String(value || "grandstand")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  function setFilter(activeZones, category = activeCategory) {
    activeZoneSet = activeZones instanceof Set ? activeZones : new Set(activeZones);
    activeCategory = normalizeCategory(category);

    let visibleIndex = 0;

    root.querySelectorAll(".seat-card").forEach((card) => {
      // 先記錄篩選前的可見狀態。
      // 這樣 Zone / category 改變時，只讓「剛從隱藏變成顯示」的卡片播放進場動畫，
      // 避免每次切換條件都讓整個清單重新刷新一次。
      const wasVisible = !card.hidden && !card.classList.contains("is-hidden");
      const isVisible =
        activeZoneSet.has(card.dataset.zone) &&
        card.dataset.category === activeCategory;

      card.hidden = !isVisible;
      card.classList.toggle("is-hidden", !isVisible);

      if (isVisible) {
        card.style.setProperty("--card-index", visibleIndex);

        if (!wasVisible) {
          restartCardEnterAnimation(card, visibleIndex);
        }

        visibleIndex += 1;
      } else {
        card.classList.remove(CARD_ENTER_CLASS);
      }
    });

    updateEmptyState(visibleIndex);
  }

  function scrollToSeat(seatId) {
    const card = root.querySelector(`[data-seat-id="${seatId}"]`);
    if (!card || card.hidden) return;

    card.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth"
    });
  }

  return {
    render,
    setSelected,
    setFilter,
    scrollToSeat
  };
}
