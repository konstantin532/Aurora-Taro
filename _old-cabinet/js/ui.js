/* Иконки, тосты, tilt-эффект, SVG фаз луны, утилиты. */
(function (T) {

  T.$  = (sel, root) => (root || document).querySelector(sel);
  T.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  T.esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  T.reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- иконки (инлайн SVG, currentColor) ---------- */
  const S = '<svg viewBox="0 0 24 24" width="W" height="W" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const icon = (w, body) => S.replace(/W/g, w) + body + "</svg>";
  T.icon = {
    info:    (w) => icon(w, '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11.5V16"/>'),
    success: (w) => icon(w, '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5.5-6"/>'),
    warning: (w) => icon(w, '<path d="M12 3.5 22 20.5H2Z"/><path d="M12 10v4.5M12 17.8h.01"/>'),
    danger:  (w) => icon(w, '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
    trash:   (w) => icon(w, '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'),
    download:(w) => icon(w, '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14"/>'),
    shuffle: (w) => icon(w, '<path d="M3 6h4l10 12h4M3 18h4M17 6h4m0 0-2.5-2.5M21 6l-2.5 2.5M21 18l-2.5-2.5M21 18l-2.5 2.5"/>'),
    spark:   (w) => icon(w, '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>'),
  };

  /* ---------- тосты ---------- */
  T.toast = function (msg, type = "info", timeout = 3800) {
    const root = T.$("#toasts");
    while (root.children.length >= 4) root.firstChild.remove();
    const el = document.createElement("div");
    el.className = "toast toast--" + type;
    el.innerHTML = '<span class="toast__icon">' + T.icon[type](18) + "</span><span>" + msg + "</span>";
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 400);
    }, timeout);
  };

  /* ---------- tilt-эффект стеклянных карточек ---------- */
  T.tilt = function (root) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || T.reduced()) return;
    T.$$("[data-tilt]", root).forEach((card) => {
      if (card._tiltBound) return;
      card._tiltBound = true;
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const ry = (px - 0.5) * 12;  /* ±6deg */
        const rx = (0.5 - py) * 12;
        card.style.transform = "perspective(600px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
        card.style.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
        card.classList.add("glass-card--tilting");
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.classList.remove("glass-card--tilting");
      });
    });
  };

  /* ---------- фазы луны: SVG по возрасту 0–29.53 ---------- */
  T.moonPhase = function (date = new Date()) {
    const SYNODIC = 29.530588853;
    const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
    let age = ((date.getTime() - NEW_MOON) / 86400000) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const idx = Math.floor((age / SYNODIC) * 8 + 0.5) % 8;
    const NAMES = ["Новолуние","Растущий серп","Первая четверть","Растущая луна",
                   "Полнолуние","Убывающая луна","Последняя четверть","Убывающий серп"];
    return { age, index: idx, name: NAMES[idx] };
  };

  /* 8 иконок фаз: тёмный диск + светлая доля */
  const P = {
    0: "",
    1: '<path d="M12 2a10 10 0 0 1 0 20 5.5 10 0 0 0 0-20z" fill="var(--text-primary)"/>',
    2: '<path d="M12 2a10 10 0 0 1 0 20z" fill="var(--text-primary)"/>',
    3: '<path d="M12 2a10 10 0 0 1 0 20 4 10 0 0 1 0-20z" fill="var(--text-primary)"/>',
    4: '<circle cx="12" cy="12" r="10" fill="var(--text-primary)"/>',
    5: '<path d="M12 2a10 10 0 0 0 0 20 4 10 0 0 0 0-20z" fill="var(--text-primary)"/>',
    6: '<path d="M12 2a10 10 0 0 0 0 20z" fill="var(--text-primary)"/>',
    7: '<path d="M12 2a10 10 0 0 0 0 20 5.5 10 0 0 1 0-20z" fill="var(--text-primary)"/>',
  };
  T.moonSVG = function (index, size = 34) {
    return '<svg class="moon-badge__icon" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--space-mid)" stroke="var(--gold-line)"/>' +
      (P[index] || "") + "</svg>";
  };
  T.moonBadge = function (date = new Date()) {
    const m = T.moonPhase(date);
    return '<span class="moon-badge">' + T.moonSVG(m.index) +
      '<span class="moon-badge__label"><b>' + m.name + "</b><span>возраст луны: " +
      m.age.toFixed(1) + " дн.</span></span></span>";
  };

  /* ---------- прочее ---------- */
  T.fmtDate = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  T.fmtDateTime = (d) => new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  /* карта: рубашка+лицо, единый шаблон */
  T.cardHTML = function (card, reversed, opts = {}) {
    const size = opts.size ? " tarot-card--" + opts.size : "";
    const extra = [
      opts.fill ? " tarot-card--fill" : "",
      opts.dealt ? " tarot-card--dealt" : "",
      opts.flipped ? " tarot-card--flipped" : "",
      reversed ? " reversed" : "",
      opts.clickable ? " tarot-card--clickable" : "",
    ].join("");
    const tag = opts.button ? "button" : "div";
    const label = opts.ariaLabel ? ' aria-label="' + T.esc(opts.ariaLabel) + '"' : "";
    return "<" + tag + ' class="tarot-card' + size + extra + '"' + label + ">" +
      '<span class="tarot-card__inner">' +
      '<span class="tarot-card__back"></span>' +
      '<span class="tarot-card__face"><span class="tarot-card__face-name">' + T.esc(card.name) + "</span>" +
      '<span class="tarot-card__face-meta">' + (card.arcana === "major" ? "Старший аркан" : T.SUIT_LABELS[card.suit]) +
      "</span></span></span></" + tag + ">";
  };

  /* перелёт карты от стопки к слоту */
  T.flyCard = function (fromEl, toEl, onDone) {
    if (T.reduced() || !fromEl || !toEl) { onDone(); return; }
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "tarot-card";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText =
      "position:fixed;left:" + a.left + "px;top:" + a.top + "px;width:" + a.width +
      "px;height:" + a.height + "px;margin:0;z-index:var(--z-toast);transition:transform .5s cubic-bezier(.2,.8,.2,1);pointer-events:none;";
    ghost.innerHTML = '<span class="tarot-card__inner"><span class="tarot-card__back"></span></span>';
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const sc = b.width / a.width;
      ghost.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sc + ") rotate(" + (Math.random() * 14 - 7).toFixed(1) + "deg)";
    });
    const finish = () => { ghost.remove(); onDone(); };
    ghost.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 650); /* страховка */
  };
})(window.AT);
