/* Аврора · Таро — главная страница-книга: главы, карта дня, пробный расклад, атлас.
   Данные о сайте и посетителе сервер кладёт в <script type="application/json"> (site-data, server-data). */
(function () {
  "use strict";

  const readJSON = (id) => { const el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; };
  const T = window.AT;
  const C = readJSON("site-data") || window.SITE || {};
  const S = readJSON("server-data");
  const STATIC = C.static || "";
  const A = window.Aurora || { play() {}, reward() {}, closeMenu() {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- карты ---------- */
  const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII",
    "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
  function roman(n) {
    const map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"],
      [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let out = "";
    for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
    return out;
  }
  const majorNo = (c) => Number(c.id.slice(1));
  const cardMeta = (c) => c.arcana === "major"
    ? "Старший аркан " + ROMAN[majorNo(c)]
    : T.SUIT_LABELS[c.suit] + " · младший аркан";
  const cardMark = (c) => c.arcana === "major" ? "Аркан " + ROMAN[majorNo(c)] : T.SUIT_LABELS[c.suit];

  function img(c, opts) {
    const o = opts || {};
    return '<img class="' + (o.cls || "") + '" src="' + STATIC + 'img/cards/' + c.id + '.jpg" width="480" height="831" alt="' +
      esc(o.alt == null ? c.name : o.alt) + '" decoding="async" loading="' + (o.eager ? "eager" : "lazy") + '">';
  }
  function plate(c, size, caption, opts) {
    return '<figure class="plate plate--' + size + '"><span class="plate__frame">' + img(c, opts) + "</span>" +
      (caption ? '<figcaption class="plate__caption">' + caption + "</figcaption>" : "") + "</figure>";
  }
  function flip(c, reversed, label) {
    return '<button class="flip" type="button" data-flip aria-label="' + esc(label) + '">' +
      '<span class="flip__inner"><span class="flip__back" aria-hidden="true"></span>' +
      '<span class="flip__face">' + img(c, { cls: reversed ? "is-reversed" : "", alt: "", eager: true }) +
      "</span></span></button>";
  }
  const back = () => '<span class="card-back" aria-hidden="true"></span>';
  const ornament = (cls) =>
    '<svg class="ornament ' + (cls || "") + '" viewBox="0 0 240 24" aria-hidden="true" focusable="false">' +
    '<path d="M10 12H98M142 12H230" stroke="currentColor" stroke-width=".8"/>' +
    '<path d="M101 12h9M130 12h9" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M120 3.5l7 8.5-7 8.5-7-8.5z" fill="none" stroke="currentColor" stroke-width="1"/>' +
    '<circle cx="120" cy="12" r="2.1" fill="currentColor"/>' +
    '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="235" cy="12" r="1.5" fill="currentColor"/></svg>';

  /* ---------- случай и календарь ---------- */
  function rand(n) {
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0] % n;
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Карта дня одна на всех в этот день — как запись в календаре.
  function dailyCard(d) {
    const h = hash("aurora:" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
    return { card: T.CARDS[h % T.CARDS.length], reversed: (h >>> 11) % 3 === 0 };
  }
  function todayCard(d) {
    if (S && S.day) {
      const c = T.cardById(S.day.id);
      if (c) return { card: c, reversed: S.day.reversed };
    }
    return dailyCard(d);
  }
  function post(url) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": S.csrf } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))));
  }
  function celebrate(ids, collected) {
    const cards = ids.map((id) => T.cardById(id)).filter(Boolean).map((c) => ({ id: c.id, name: c.name }));
    if (cards.length) A.reward({ cards, collected, total: S.total, collectionUrl: S.urls.collection, staticBase: STATIC });
  }
  const authLinks = () => '<a href="' + esc(S.urls.login) + '">Войдите</a> или <a href="' + esc(S.urls.register) + '">заведите кабинет</a>';

  function moonPhase(date) {
    const SYNODIC = 29.530588853;
    const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
    let age = ((date.getTime() - NEW_MOON) / 86400000) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const idx = Math.floor((age / SYNODIC) * 8 + 0.5) % 8;
    const NAMES = ["Новолуние", "Растущий серп", "Первая четверть", "Растущая луна",
      "Полнолуние", "Убывающая луна", "Последняя четверть", "Убывающий серп"];
    return { index: idx, name: NAMES[idx] };
  }
  function moonSVG(index) {
    const lit = {
      1: '<path d="M12 2a10 10 0 0 1 0 20 5.5 10 0 0 0 0-20z"/>',
      2: '<path d="M12 2a10 10 0 0 1 0 20z"/>',
      3: '<path d="M12 2a10 10 0 0 1 0 20 4 10 0 0 1 0-20z"/>',
      4: '<circle cx="12" cy="12" r="10"/>',
      5: '<path d="M12 2a10 10 0 0 0 0 20 4 10 0 0 0 0-20z"/>',
      6: '<path d="M12 2a10 10 0 0 0 0 20z"/>',
      7: '<path d="M12 2a10 10 0 0 0 0 20 5.5 10 0 0 1 0-20z"/>',
    }[index] || "";
    return '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="10" class="moon__dark"/><g class="moon__lit">' + lit + "</g></svg>";
  }
  const fmtDay = (d) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const weekday = (d) => d.toLocaleDateString("ru-RU", { weekday: "long" });

  function announce(text) {
    const el = $("#announcer");
    el.textContent = "";
    window.setTimeout(() => { el.textContent = text; }, 40);
  }

  function readingHTML(c, reversed, position) {
    return (position ? '<p class="reading__pos">' + position + "</p>" : "") +
      '<h3 class="reading__name"><a href="#/card/' + c.id + '">' + esc(c.name) + "</a></h3>" +
      '<p class="reading__state">' + (reversed ? "Перевёрнутое положение" : "Прямое положение") +
      " · " + esc(cardMark(c)) + "</p>" +
      "<p>" + esc(reversed ? c.reversed : c.upright) + "</p>";
  }

  /* ---------- главы книги ---------- */
  const CHAPTERS = [
    { id: "about", title: "О тарологе", plate: "m1", caption: "Маг, аркан I. Всё нужное уже в руках" },
    { id: "process", title: "Как проходит консультация", plate: "m9", caption: "Отшельник, аркан IX. Свет своего фонаря" },
    { id: "prices", title: "Консультации и цены", plate: "m3", caption: "Императрица, аркан III. Забота и изобилие" },
    { id: "day", title: "Карта дня" },
    { id: "trial", title: "Пробный расклад" },
    { id: "faq", title: "Вопросы", plate: "m5", caption: "Иерофант, аркан V. Учитель и ответы" },
    { id: "book", title: "Запись", plate: "m10", caption: "Колесо Фортуны, аркан X. Время повернуть" },
  ];

  function chapter(i, body, margin) {
    const ch = CHAPTERS[i];
    const side = margin != null ? margin
      : ch.plate ? plate(T.cardById(ch.plate), "small", '<span class="plate__no">Лист ' + ROMAN[majorNo(T.cardById(ch.plate))] + "</span>" + esc(ch.caption)) : "";
    return '<section class="chapter chapter--' + ch.id + '" id="' + ch.id + '" aria-labelledby="' + ch.id + '-h">' +
      '<header class="chapter__head"><p class="chapter__num">Глава ' + roman(i + 1) + "</p>" +
      '<h2 class="chapter__title" id="' + ch.id + '-h" tabindex="-1">' + esc(ch.title) + "</h2></header>" +
      '<aside class="chapter__margin">' + side + "</aside>" +
      '<div class="chapter__body">' + body + "</div>" +
      '<p class="folio" aria-hidden="true">' + (i + 1) + "</p></section>";
  }

  const P = {};

  P.home = {
    title: () => (C.brand || "Аврора · Таро") + " — консультации таро",
    render() {
      const formats = C.formats || [];
      const imprint = [C.city, formats.join(" и ").toLowerCase(), roman(new Date().getFullYear())]
        .filter(Boolean).map(esc).join(" · ");
      const priestess = T.cardById("m2");
      const today = new Date();
      const day = todayCard(today);
      const moon = moonPhase(today);

      const title =
        '<section class="title-spread" aria-labelledby="title-h">' +
        '<figure class="frontispiece">' + plate(priestess, "large", null, { eager: true, alt: "Верховная Жрица — гравюра из колоды Райдер–Уэйт 1909 года" }) +
        '<figcaption class="plate__caption"><span class="plate__no">Фронтиспис</span>Верховная Жрица, аркан II — хранительница тайного знания</figcaption></figure>' +
        '<div class="title-page">' +
        '<p class="title-page__top">Консультации таро</p>' +
        '<h1 class="title-page__name" id="title-h" tabindex="-1">' + esc(C.readerName || "Аврора") + "</h1>" +
        ornament("title-page__ornament") +
        '<p class="title-page__lede">Расклады на отношения, работу и выбор пути по классической колоде Райдер–Уэйт. Карты не решают за вас — они помогают увидеть ситуацию целиком.</p>' +
        '<div class="title-page__actions"><a class="btn btn--rubric" href="#/book">Записаться на расклад</a>' +
        '<a class="link-quiet" href="#/day">или открыть карту дня</a></div>' +
        (imprint ? '<p class="title-page__imprint">' + imprint + "</p>" : "") +
        "</div></section>";

      const about = chapter(0, (C.about || []).map((p, i) =>
        '<p class="' + (i === 0 ? "drop" : "") + '">' + esc(p) + "</p>").join(""));

      const process = chapter(1, '<ol class="steps">' + (C.process || []).map((s, i) =>
        '<li><span class="steps__no">' + (i + 1) + '</span><h3 class="steps__title">' + esc(s.title) +
        "</h3><p>" + esc(s.text) + "</p></li>").join("") + "</ol>");

      const prices = chapter(2,
        '<ul class="price-list">' + (C.services || []).map((s) =>
          '<li><div class="price-row"><span class="price-row__title">' + esc(s.title) + "</span>" +
          '<span class="leader" aria-hidden="true"></span><span class="price-row__price">' + esc(s.price || "по запросу") +
          "</span></div>" + '<p class="price-list__desc">' + esc(s.desc) + (s.duration ? " · " + esc(s.duration) : "") +
          "</p></li>").join("") + "</ul>" +
        (formats.length ? '<p class="price-note">Форматы: ' + formats.map(esc).join(" и ").toLowerCase() + ". Оплата — после согласования времени.</p>" : "") +
        '<a class="btn" href="#/book">Выбрать время</a>');

      const almanac =
        '<div class="almanac"><p class="almanac__label">Альманах</p>' +
        '<p class="almanac__day">' + today.getDate() + "</p>" +
        '<p class="almanac__month">' + esc(fmtDay(today).replace(/^\d+\s*/, "")) + ", " + esc(weekday(today)) + "</p>" +
        moonSVG(moon.index) + '<p class="almanac__moon">' + esc(moon.name) + "</p></div>";
      const dayBody =
        '<p class="drop">Одна карта на сегодня — общая для всех, кто открыл эту страницу. Подумайте о своём дне и переверните её.</p>' +
        '<div class="day">' +
        flip(day.card, day.reversed, "Карта дня закрыта. Нажмите, чтобы открыть") +
        '<div class="day__reading" data-day-reading><p class="day__hint">Карта лежит рубашкой вверх. Нажмите на неё.</p></div></div>';
      const dayCh = chapter(3, dayBody, almanac);

      const trial = chapter(4,
        '<p class="drop">Хотите почувствовать, как это устроено? Перемешайте колоду и откройте три карты: прошлое, настоящее и будущее вашего вопроса. Это игра с колодой, а не консультация — но многое становится понятнее.</p>' +
        '<a class="trial-link" href="#/spread" aria-label="Открыть пробный расклад из трёх карт">' +
        '<span class="fan">' + back() + back() + back() + "</span>" +
        '<span class="trial-link__label">Разложить три карты →</span></a>', "");

      const faq = chapter(5, '<div class="faq">' + (C.faq || []).map((f) =>
        "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>").join("") + "</div>");

      const book = chapter(6, bookingChapter());

      return '<article class="book">' + title + about + process + prices + dayCh + trial + faq + book + "</article>";
    },
    mount(root) {
      const btn = $(".chapter--day [data-flip]", root);
      const out = $("[data-day-reading]", root);
      const day = todayCard(new Date());
      btn.addEventListener("click", () => {
        if (btn.classList.contains("is-open")) return;
        btn.classList.add("is-open");
        btn.setAttribute("aria-label", "Карта дня: " + day.card.name + (day.reversed ? ", перевёрнутая" : ""));
        out.innerHTML = readingHTML(day.card, day.reversed, "") +
          '<p class="day__more"><a href="#/card/' + day.card.id + '">Подробнее о карте</a> · <a href="#/book">Разобрать с тарологом</a></p>';
        out.classList.add("is-shown");
        announce("Карта дня: " + day.card.name + ". " + (day.reversed ? day.card.reversed : day.card.upright));
        A.play("flip");
        if (!S) return;
        post(S.urls.dayOpen).then((res) => {
          if (!res.auth) {
            out.insertAdjacentHTML("beforeend", '<p class="collect-hint">' + authLinks() + " — и карта дня ляжет в вашу коллекцию.</p>");
          } else if (res.new.length) {
            btn.classList.add("is-new");
            celebrate(res.new, res.collected);
          } else {
            out.insertAdjacentHTML("beforeend", '<p class="collect-hint">Эта карта уже есть в вашем альбоме. Завтра будет новая.</p>');
          }
        }).catch(() => {});
      });
    },
  };

  /* ---------- запись ---------- */
  function contactLinks() {
    const k = C.contacts || {};
    const out = [];
    if (k.telegram) out.push('<a href="https://t.me/' + encodeURIComponent(String(k.telegram).replace(/^@/, "")) + '" target="_blank" rel="noopener">Telegram</a>');
    if (k.whatsapp) out.push('<a href="https://wa.me/' + String(k.whatsapp).replace(/\D/g, "") + '" target="_blank" rel="noopener">WhatsApp</a>');
    if (k.email) out.push('<a href="mailto:' + esc(k.email) + '">' + esc(k.email) + "</a>");
    return out.length ? '<p class="price-note">Можно и напрямую: ' + out.join(" · ") + ".</p>" : "";
  }
  function bookingChapter() {
    const urls = (S && S.urls) || {};
    const authed = Boolean(S && S.auth);
    return '<div class="book-cta"><p class="drop">' + (authed
      ? "Выберите свободное время в календаре: запись появится в вашем кабинете, а я подтвержу встречу."
      : "Запись идёт через личный кабинет: в нём видно время встречи, а после — заметки по раскладу. Регистрация занимает минуту.") + "</p>" +
      '<div class="form-actions">' + (authed
        ? '<a class="btn btn--rubric" href="' + esc(urls.book) + '">Выбрать время</a>'
        : '<a class="btn btn--rubric" href="' + esc(urls.register || "#") + '">Создать кабинет</a>' +
          '<a class="btn" href="' + esc(urls.login || "#") + '">Войти</a>') +
      "</div>" + contactLinks() + "</div>";
  }

  /* ---------- пробный расклад ---------- */
  const POSITIONS = [
    ["Прошлое", "что привело к ситуации"],
    ["Настоящее", "что происходит сейчас"],
    ["Будущее", "куда всё движется, если ничего не менять"],
  ];
  P.spread = {
    title: () => "Пробный расклад · " + (C.brand || "Аврора · Таро"),
    render() {
      return '<article class="page spread-page">' +
        '<header class="page-head"><p class="chapter__num">Пробный расклад</p>' +
        '<h1 tabindex="-1">Три карты: прошлое, настоящее, будущее</h1>' +
        '<p class="lede">Задумайте вопрос. Перемешайте колоду, затем откройте карты по одной — слева направо.</p></header>' +
        '<div class="spread-table"><div class="deck-stack" data-stack aria-hidden="true">' + back() + back() + back() + "</div>" +
        '<div><button class="btn btn--rubric" type="button" data-shuffle>Перемешать и разложить</button>' +
        '<p class="spread-table__hint" data-hint>78 карт, из них 22 старших аркана.</p></div></div>' +
        '<ol class="spread-slots">' + POSITIONS.map((p, i) =>
          '<li><p class="slot-label"><span class="slot-label__num">' + ROMAN[i + 1] + "</span> " + p[0] + '</p><div class="slot" data-slot></div>' +
          '<p class="slot-note">' + p[1] + "</p></li>").join("") + "</ol>" +
        '<ol class="readings" data-readings aria-label="Толкование расклада"></ol>' +
        '<aside class="spread-cta" data-cta hidden><p>Пробный расклад показывает общее направление. Чтобы разобрать ваш вопрос подробно и с учётом ситуации — приходите на консультацию.</p>' +
        '<a class="btn btn--rubric" href="#/book">Записаться</a></aside>' +
        "</article>";
    },
    mount(root) {
      const slots = $$("[data-slot]", root);
      const readings = $("[data-readings]", root);
      const btn = $("[data-shuffle]", root);
      const stack = $("[data-stack]", root);
      const cta = $("[data-cta]", root);
      let opened = 0;

      const localDraw = () => shuffle(T.CARDS).slice(0, 3).map((c) => ({ card: c, reversed: rand(100) < 35 }));

      function hintFor(res) {
        const base = "Откройте карты по одной — нажмите на каждую. ";
        if (!S) return esc(base);
        if (!res || !res.auth) return esc(base) + authLinks() + ", чтобы карты ложились в коллекцию.";
        if (!res.counted) return esc(base + "Сегодня в альбом уже легли три расклада — новые карты завтра.");
        return esc(base + (res.collectLeft ? "Этот расклад идёт в альбом, сегодня ещё " + res.collectLeft + "." : "Это последний расклад для альбома на сегодня."));
      }

      function deal(drawn, res) {
        const fresh = (res && res.new) || [];
        opened = 0;
        cta.hidden = true;
        readings.innerHTML = "";
        slots.forEach((slot, i) => {
          slot.classList.remove("is-dealt");
          slot.innerHTML = flip(drawn[i].card, drawn[i].reversed, POSITIONS[i][0] + ": карта закрыта. Нажмите, чтобы открыть");
          slot.style.setProperty("--i", i);
          void slot.offsetWidth;
          slot.classList.add("is-dealt");
          const f = $("[data-flip]", slot);
          f.addEventListener("click", () => {
            if (f.classList.contains("is-open")) return;
            f.classList.add("is-open");
            A.play("flip");
            const d = drawn[i];
            const isNew = fresh.includes(d.card.id);
            if (isNew) f.classList.add("is-new");
            f.setAttribute("aria-label", POSITIONS[i][0] + ": " + d.card.name + (d.reversed ? ", перевёрнутая" : "") + (isNew ? ", новая в коллекции" : ""));
            const li = document.createElement("li");
            li.className = "reading";
            li.style.order = String(i);
            li.innerHTML = readingHTML(d.card, d.reversed, ROMAN[i + 1] + " · " + POSITIONS[i][0] +
              (isNew ? ' <span class="new-badge">новая</span>' : ""));
            readings.appendChild(li);
            announce(POSITIONS[i][0] + ": " + d.card.name + ". " + (d.reversed ? d.card.reversed : d.card.upright));
            opened++;
            if (opened === 3) {
              cta.hidden = false;
              if (fresh.length) celebrate(fresh, res.collected);
            }
          });
        });
        btn.textContent = "Перемешать заново";
        $("[data-hint]", root).innerHTML = hintFor(res);
      }

      btn.addEventListener("click", () => {
        btn.disabled = true;
        A.play("shuffle");
        const request = S ? post(S.urls.spread).catch(() => null) : Promise.resolve(null);
        if (!reduced()) {
          stack.classList.remove("is-shuffling");
          void stack.offsetWidth;
          stack.classList.add("is-shuffling");
        }
        const pause = new Promise((r) => window.setTimeout(r, reduced() ? 0 : 760));
        Promise.all([request, pause]).then(([res]) => {
          stack.classList.remove("is-shuffling");
          btn.disabled = false;
          const fromServer = res && res.cards
            ? res.cards.map((c) => ({ card: T.cardById(c.id), reversed: c.reversed })).filter((d) => d.card) : [];
          deal(fromServer.length === 3 ? fromServer : localDraw(), fromServer.length === 3 ? res : null);
          $("[data-flip]", slots[0]).focus({ preventScroll: true });
        });
      });
    },
  };

  /* ---------- атлас ---------- */
  const GROUPS = [["major", "Старшие арканы"], ["wands", "Жезлы"], ["cups", "Кубки"], ["swords", "Мечи"], ["pentacles", "Пентакли"]];
  let atlasFilter = "all";
  let atlasQuery = "";
  const inGroup = (c, g) => g === "major" ? c.arcana === "major" : c.suit === g;
  const tile = (c) => '<li><a class="atlas-tile" href="#/card/' + c.id + '">' + plate(c, "tile") +
    '<span class="atlas-tile__no">' + esc(cardMark(c)) + '</span><span class="atlas-tile__name">' + esc(c.name) + "</span></a></li>";

  P.cards = {
    title: () => "Атлас карт · " + (C.brand || "Аврора · Таро"),
    render() {
      return '<article class="page atlas">' +
        '<header class="page-head"><p class="chapter__num">Атлас</p><h1 tabindex="-1">Все 78 карт</h1>' +
        '<p class="lede">Колода Райдер–Уэйт в издании 1909 года. Нажмите на карту, чтобы прочитать её значение в прямом и перевёрнутом положении.</p></header>' +
        '<div class="atlas-tools"><div class="filters" role="group" aria-label="Показать">' +
        [["all", "Все"]].concat(GROUPS).map(([id, label]) =>
          '<button class="filter" type="button" data-filter="' + id + '" aria-pressed="' + (atlasFilter === id) + '">' + label + "</button>").join("") +
        '</div><div class="field atlas-search"><label for="atlas-q">Поиск по названию или смыслу</label>' +
        '<input class="input" id="atlas-q" type="search" data-q placeholder="например, «надежда»" value="' + esc(atlasQuery) + '"></div></div>' +
        '<div data-atlas aria-live="polite"></div></article>';
    },
    mount(root) {
      const out = $("[data-atlas]", root);
      const paint = () => {
        const q = atlasQuery.trim().toLowerCase();
        const match = (c) => !q || c.name.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q));
        const groups = GROUPS.filter(([g]) => atlasFilter === "all" || atlasFilter === g)
          .map(([g, label]) => [label, T.CARDS.filter((c) => inGroup(c, g) && match(c))])
          .filter(([, list]) => list.length);
        out.innerHTML = groups.length
          ? groups.map(([label, list]) => '<section class="atlas-group"><h2 class="atlas-group__title">' + label +
            ' <span class="atlas-group__count">' + list.length + "</span></h2>" +
            '<ul class="atlas-grid">' + list.map(tile).join("") + "</ul></section>").join("")
          : '<p class="empty">Такой карты не нашлось. Попробуйте другое слово: «любовь», «выбор», «перемены».</p>';
      };
      $$("[data-filter]", root).forEach((b) => b.addEventListener("click", () => {
        atlasFilter = b.dataset.filter;
        $$("[data-filter]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        paint();
      }));
      $("[data-q]", root).addEventListener("input", (e) => { atlasQuery = e.target.value; paint(); });
      paint();
    },
  };

  /* ---------- лист карты ---------- */
  P.card = {
    title: (id) => ((T.cardById(id) || T.CARDS[0]).name) + " · " + (C.brand || "Аврора · Таро"),
    render(id) {
      const c = T.cardById(id) || T.CARDS[0];
      const i = T.CARDS.indexOf(c);
      const prev = T.CARDS[(i + T.CARDS.length - 1) % T.CARDS.length];
      const next = T.CARDS[(i + 1) % T.CARDS.length];
      return '<article class="page card-page">' +
        '<p class="crumbs"><a href="#/cards">Атлас карт</a> <span aria-hidden="true">›</span> ' + esc(cardMeta(c)) + "</p>" +
        '<div class="card-page__grid"><div class="card-page__plate">' +
        plate(c, "large", null, { eager: true, alt: c.name + " — карта колоды Райдер–Уэйт" }) +
        '<button class="btn" type="button" data-turn aria-pressed="false">Показать перевёрнутой</button></div>' +
        '<div class="card-page__text"><p class="chapter__num">' + esc(cardMeta(c)) + "</p>" +
        '<h1 class="card-page__title" tabindex="-1">' + esc(c.name) + "</h1>" +
        '<p class="keywords">' + c.keywords.map(esc).join(" · ") + "</p>" + ornament() +
        '<h2 class="sc-head">Прямое положение</h2><p class="drop">' + esc(c.upright) + "</p>" +
        '<h2 class="sc-head">Перевёрнутое положение</h2><p>' + esc(c.reversed) + "</p>" +
        '<p class="card-page__cta">Значение карты зависит от вопроса и соседних карт. <a href="#/book">Разберём ваш расклад вместе</a>.</p>' +
        "</div></div>" +
        '<nav class="pager" aria-label="Соседние карты">' +
        '<a rel="prev" href="#/card/' + prev.id + '"><small>← предыдущая</small>' + esc(prev.name) + "</a>" +
        '<a rel="next" href="#/card/' + next.id + '"><small>следующая →</small>' + esc(next.name) + "</a></nav></article>";
    },
    mount(root) {
      const btn = $("[data-turn]", root);
      const pic = $(".card-page__plate img", root);
      btn.addEventListener("click", () => {
        const on = pic.classList.toggle("is-reversed");
        btn.setAttribute("aria-pressed", String(on));
        btn.textContent = on ? "Показать прямой" : "Показать перевёрнутой";
      });
    },
  };

  /* ---------- маршруты ---------- */
  const HOME_SECTIONS = CHAPTERS.map((c) => c.id);
  let current = null;
  let first = true;

  function setNav(key) {
    $$("[data-nav]").forEach((a) => {
      if (a.dataset.nav === key) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function route() {
    const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const key = parts[0] || "";
    const arg = parts[1] ? decodeURIComponent(parts[1]) : null;
    const section = HOME_SECTIONS.includes(key) ? key : null;
    const page = !section && P[key] && key !== "home" ? key : "home";
    const main = $("#main");
    const stay = page === "home" && current === "home";

    if (!stay) {
      main.innerHTML = P[page].render(arg);
      if (P[page].mount) P[page].mount(main, arg);
      if (!first && !reduced()) {
        main.classList.remove("is-entering");
        void main.offsetWidth;
        main.classList.add("is-entering");
      }
    }
    current = page;
    document.title = P[page].title(arg);
    setNav(section || page);
    A.closeMenu();

    if (section) {
      const el = document.getElementById(section);
      el.scrollIntoView({ behavior: stay && !reduced() ? "smooth" : "auto", block: "start" });
      if (!first) $("h2", el).focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      if (!first) { const h = $("h1", main); if (h) h.focus({ preventScroll: true }); }
    }
    first = false;
  }

  function renderColophon() {
    $("#colophon").innerHTML = '<div class="colophon__inner">' + ornament() +
      '<p class="colophon__title">Колофон</p>' +
      "<p>" + esc(C.brand || "Аврора · Таро") + ". Консультации таро" +
      ((C.formats || []).length ? " — " + (C.formats || []).join(" и ").toLowerCase() : "") + ".</p>" +
      "<p>Иллюстрации — колода Райдер–Уэйт, издание 1909 года, рисунки Памелы Колман Смит; общественное достояние, сканы — Wikimedia Commons. Набрано шрифтами Cormorant Garamond и Alegreya.</p>" +
      '<p class="colophon__note">Таро — способ взглянуть на ситуацию, а не предсказание и не замена помощи врача, юриста или психолога. Консультации — для взрослых, 18+.' +
      (S && S.urls.privacy ? ' <a href="' + esc(S.urls.privacy) + '">Как мы обращаемся с данными</a>.' : "") + "</p></div>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderColophon();
    // Повторный клик по ссылке на текущий раздел тоже прокручивает к нему.
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#/"]');
      if (a && a.getAttribute("href") === window.location.hash) { e.preventDefault(); route(); }
    });
    window.addEventListener("hashchange", route);
    route();
  });
})();
