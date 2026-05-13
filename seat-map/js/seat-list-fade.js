(function () {
  function updateSeatListFade() {
    const wrap = document.querySelector(".seat-list-wrap");
    const list = document.querySelector(".seat-list");

    if (!wrap || !list) return;

    const threshold = 4;

    const hasScrollableContent = list.scrollHeight > list.clientHeight + threshold;
    const isNotAtBottom =
      list.scrollTop + list.clientHeight < list.scrollHeight - threshold;

    wrap.classList.toggle(
      "has-more",
      hasScrollableContent && isNotAtBottom
    );
  }

  window.addEventListener("load", updateSeatListFade);
  window.addEventListener("resize", updateSeatListFade);

  document.addEventListener("DOMContentLoaded", function () {
    const list = document.querySelector(".seat-list");

    if (list) {
      list.addEventListener("scroll", updateSeatListFade);
    }

    updateSeatListFade();
  });
})();