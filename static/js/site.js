/* Аврора · Таро — общее для всех страниц: меню, звук карт, награда «новая карта», загрузка видео. */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- меню ---------- */
  function closeMenu() {
    const nav = $("#site-nav");
    const btn = $("[data-menu]");
    if (!nav || !btn) return;
    nav.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }
  function initMenu() {
    const nav = $("#site-nav");
    const btn = $("[data-menu]");
    if (!nav || !btn) return;
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { closeMenu(); btn.focus(); }
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
  }

  /* ---------- звук ---------- */
  // Звуки собираются из шума и тонов прямо в браузере: без файлов и без чужих записей.
  const KEY = "aurora-sound";
  let ctx = null;
  const enabled = () => { try { return localStorage.getItem(KEY) === "on"; } catch (e) { return false; } };
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function rustle(c, dur, freq, gain, when) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = .9;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + when);
  }
  function chime(c, freq, dur, when, gain) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + when;
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + .05);
  }
  function play(name) {
    if (!enabled()) return;
    const c = audio();
    if (!c) return;
    if (name === "flip") rustle(c, .11, 2400, .55, 0);
    else if (name === "shuffle") for (let i = 0; i < 8; i++) rustle(c, .05, 1500 + Math.random() * 1500, .38, i * .075);
    else if (name === "reward") { chime(c, 659.3, .7, 0, .14); chime(c, 987.8, .9, .12, .11); chime(c, 1318.5, 1.2, .24, .08); }
  }
  function initSound() {
    const btn = $("[data-sound]");
    if (!btn) return;
    const sync = () => {
      const on = enabled();
      btn.setAttribute("aria-pressed", String(on));
      btn.title = on ? "Звук карт включён" : "Звук карт выключен";
    };
    sync();
    btn.addEventListener("click", () => {
      try { localStorage.setItem(KEY, enabled() ? "off" : "on"); } catch (e) { /* приватный режим */ }
      sync();
      play("flip");
    });
  }

  /* ---------- награда ---------- */
  function announce(text) {
    const el = $("#announcer");
    if (!el) return;
    el.textContent = "";
    window.setTimeout(() => { el.textContent = text; }, 40);
  }
  function reward(opts) {
    const zone = $("[data-toasts]");
    if (!zone || !opts.cards || !opts.cards.length) return;
    const many = opts.cards.length > 1;
    const el = document.createElement("div");
    el.className = "reward";
    el.innerHTML =
      '<div class="reward__cards" aria-hidden="true">' + opts.cards.slice(0, 3).map((c) =>
        '<img src="' + esc(opts.staticBase) + "img/cards/" + esc(c.id) + '.jpg" alt="" width="480" height="831">').join("") + "</div>" +
      '<div><p class="reward__title">' + (many ? "Новые карты в альбоме" : "Новая карта в альбоме") + "</p>" +
      '<p class="reward__name">' + opts.cards.map((c) => esc(c.name)).join(", ") + "</p>" +
      '<p class="reward__meta">' + opts.collected + " из " + opts.total + ' · <a href="' + esc(opts.collectionUrl) + '">открыть альбом</a></p></div>' +
      '<button class="reward__close" type="button" aria-label="Закрыть">×</button>';
    const close = () => {
      if (!el.isConnected) return;
      if (reduced()) { el.remove(); return; }
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };
    $(".reward__close", el).addEventListener("click", close);
    let timer = window.setTimeout(close, 9000);
    el.addEventListener("mouseenter", () => window.clearTimeout(timer));
    el.addEventListener("focusin", () => window.clearTimeout(timer));
    el.addEventListener("mouseleave", () => { timer = window.setTimeout(close, 4000); });
    zone.appendChild(el);
    play("reward");
    announce((many ? "Новые карты в альбоме: " : "Новая карта в альбоме: ") +
      opts.cards.map((c) => c.name).join(", ") + ". Всего " + opts.collected + " из " + opts.total + ".");
  }

  /* ---------- загрузка видео с отзывом ---------- */
  function initUpload() {
    const form = $("[data-upload]");
    if (!form) return;
    const input = $('input[type="file"][data-max-mb]', form);
    const btn = $('button[type="submit"]', form);
    const progress = $("[data-progress]", form);
    let error = null;
    const showError = (msg) => {
      if (!error) {
        error = document.createElement("p");
        error.className = "field__error";
        input.insertAdjacentElement("afterend", error);
      }
      error.textContent = msg;
      error.hidden = !msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
    };
    if (input) input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      const max = Number(input.dataset.maxMb);
      showError(f && f.size > max * 1024 * 1024
        ? "Видео весит " + Math.round(f.size / 1048576) + " МБ, а можно до " + max + " МБ. Обрежьте его или снимите покороче." : "");
    });
    form.addEventListener("submit", (e) => {
      const f = input && input.files && input.files[0];
      if (error && !error.hidden) { e.preventDefault(); input.focus(); return; }
      if (!f || !window.XMLHttpRequest || !window.FormData) { btn.disabled = true; return; }
      e.preventDefault();
      btn.disabled = true;
      progress.hidden = false;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", form.getAttribute("action") || window.location.href);
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) progress.textContent = "Видео загружается: " + Math.round(ev.loaded * 100 / ev.total) + "%. Не закрывайте страницу.";
      });
      xhr.addEventListener("load", () => {
        if (xhr.responseURL && xhr.responseURL !== window.location.href) { window.location.href = xhr.responseURL; return; }
        document.open();
        document.write(xhr.responseText);
        document.close();
      });
      xhr.addEventListener("error", () => {
        btn.disabled = false;
        progress.textContent = "Связь прервалась. Проверьте интернет и попробуйте ещё раз.";
      });
      xhr.send(new FormData(form));
    });
  }

  window.Aurora = { play, reward, closeMenu, announce };

  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    initSound();
    initUpload();
  });
})();
