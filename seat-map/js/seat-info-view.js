/* =========================================================
   Seat Info View
   ---------------------------------------------------------
   負責下方詳細資訊 info-bar：
   1. 更新圖片
   2. 更新標題
   3. 更新描述
   4. 複選全部取消時，可清空或還原預設資訊
   ========================================================= */

export function createSeatInfoView({ root }) {
  if (!root) {
    throw new Error("createSeatInfoView: 找不到 .info-bar");
  }

  const image = root.querySelector(".info-image img");
  const title = root.querySelector(".info-copy h2");
  const text = root.querySelector(".info-copy p");

  const defaultState = {
    imageSrc: image ? image.getAttribute("src") : "",
    imageAlt: image ? image.getAttribute("alt") : "",
    title: title ? title.textContent : "",
    text: text ? text.textContent : ""
  };

  function update(seat) {
    if (!seat) return;

    if (image) {
      image.src = seat.image;
      image.alt = seat.title;
    }

    if (title) {
      title.textContent = seat.title;
    }

    if (text) {
      text.textContent = seat.description;
    }
  }

  function reset() {
    if (image) {
      image.src = defaultState.imageSrc;
      image.alt = defaultState.imageAlt;
    }

    if (title) {
      title.textContent = defaultState.title || "請選擇看台";
    }

    if (text) {
      text.textContent = defaultState.text || "從左側座位清單或右側地圖選取看台後，這裡會顯示座位說明。";
    }
  }

  return {
    update,
    reset
  };
}
