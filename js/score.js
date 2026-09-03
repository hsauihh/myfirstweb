(function () {
  var btn = document.querySelector(".primary-button");
  var scoreEl = document.querySelector("[data-score]");
  if (!btn || !scoreEl) return;

  btn.addEventListener("click", function () {
    var target = 0.86;
    var frames = 20;
    var step = target / frames;
    var frame = 0;
    scoreEl.textContent = "0.00";
    var interval = setInterval(function () {
      frame++;
      var v = Math.min(target, frame * step);
      scoreEl.textContent = v.toFixed(2);
      if (frame >= frames) clearInterval(interval);
    }, 50);
  });
})();
