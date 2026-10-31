/* Точка входа: инициализация каркаса, дашборд, настройки, чеклист самопроверки. */
(function (T) {

  /* ---------- инициализация каркаса ---------- */
  function initChrome() {
    const burger = T.$("#hamburger");
    const sidebar = T.$("#sidebar");
    const overlay = T.$("#sidebar-overlay");

    const closeSidebar = () => {
      sidebar.classList.remove("sidebar--open");
      overlay.hidden = true;
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Открыть меню");
    };
    burger.addEventListener("click", () => {
      const open = sidebar.classList.toggle("sidebar--open");
      overlay.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });

    const pt = T.$("#presentation-toggle");
    pt.addEventListener("click", () => {
      const on = document.body.classList.toggle("presentation-mode");
      pt.setAttribute("aria-pressed", String(on));
      T.toast(on ? "Режим презентации включён" : "Режим презентации выключен", "info", 2200);
    });

    T.updateNavBadge = function () {
      const b = T.$("[data-nav-badge]");
      if (!b) return;
      const n = T.journal.entries.length;
      b.textContent = n;
      b.hidden = n === 0;
    };
    updateHeaderName();
  }

  function updateHeaderName() {
    const el = T.$("#header-name");
    el.hidden = !T.settings.name;
    el.textContent = T.settings.name ? "Рады видеть, " + T.settings.name : "";
  }

  /* ---------- дашборд ---------- */
  function greet() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "Доброе утро";
    if (h >= 11 && h < 17) return "Добрый день";
    if (h >= 17 && h < 23) return "Добрый вечер";
    return "Доброй ночи";
  }

  T.pages.dashboard = {
    title: "Кабинет",
    render() {
      const name = T.settings.name ? ", " + T.esc(T.settings.name) : "";
      const day = T.cardOfDay();
      const meaning = day.reversed ? day.card.reversed : day.card.upright;

      const lastEntry = T.journal.last();
      const lastHTML = lastEntry
        ? '<p class="small-caps journal-entry__date">' + T.fmtDateTime(lastEntry.date) + "</p>" +
          '<h3 class="journal-entry__spread">' + T.esc(lastEntry.spreadName) + "</h3>" +
          (lastEntry.question ? '<p class="spread-meta">«' + T.esc(lastEntry.question) + "»</p>" : "") +
          '<div class="journal-entry__cards">' +
          lastEntry.cards.slice(0, 5).map((c) =>
            T.cardHTML(T.cardById(c.cardId), c.reversed, { size: "sm", flipped: true })).join("") + "</div>" +
          '<a class="btn btn--ghost btn--sm" href="#/journal" style="align-self:flex-start">Весь журнал</a>'
        : '<div class="empty-state"><p class="empty-state__title">Журнал пуст</p>' +
          '<p>Первый расклад станет первой записью.</p></div>';

      const fav = (() => {
        const counts = {};
        T.journal.entries.forEach((e) => (counts[e.spreadName] = (counts[e.spreadName] || 0) + 1));
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : "—";
      })();

      return '<section class="dashboard" aria-labelledby="dsh-title">' +
        '<div class="page-header"><h1 class="page-title" id="dsh-title">Кабинет</h1>' +
        '<p class="small-caps text-muted">' + T.fmtDate(new Date()) + "</p></div>" +

        '<div class="glass-card bg-constellation" data-tilt style="padding:var(--space-6)">' +
        '<div class="page-header"><h2 class="section-title">' + greet() + name + "</h2>" +
        '<p class="small-caps text-muted">тихой практики под ' + T.moonPhase().name.toLowerCase() + "</p></div>" +
        T.moonBadge() + '<p class="lede" style="margin-top:var(--space-3)">' +
        (T.settings.name
          ? "Колода вымыта, звёзды на месте. Начните с карты дня — или сразу с расклада."
          : "Кабинет готов. Назовите себя в настройках — и журнал станет личным.") + "</p></div>" +

        '<div class="glass-card" data-tilt><div class="card-day">' +
        '<button class="tarot-card tarot-card--lg tarot-card--clickable" data-card-of-day ' +
        'aria-label="Карта дня закрыта — нажмите, чтобы открыть">' +
        T.cardHTML(day.card, day.reversed, { size: "lg" }).replace(/^<div[^>]*>|<\/div>$/g, "") +
        "</button>" +
        '<div class="card-day__caption"><p class="small-caps text-muted">Карта дня</p>' +
        '<h3 class="section-title" data-day-name hidden></h3>' +
        '<p class="text-serif" data-day-meaning hidden>' + T.esc(meaning) + "</p>" +
        '<a class="btn btn--ghost btn--sm" data-day-link href="#/glossary/' + day.card.id + '" hidden>Значение в словаре</a></div>' +
        "</div></div>" +

        '<div class="grid-2">' +
        '<div class="glass-card" data-tilt><h2 class="section-title">Последний сеанс</h2>' + lastHTML + "</div>" +
        '<div class="glass-card" data-tilt><h2 class="section-title">Статистика практики</h2><div class="stat-list">' +
        '<div class="stat-list__row"><span>Всего гаданий</span><span class="stat-list__value">' + T.journal.entries.length + "</span></div>" +
        '<div class="stat-list__row"><span>Любимый расклад</span><span class="stat-list__value" style="font-size:1rem">' + T.esc(fav) + "</span></div>" +
        '<div class="stat-list__row"><span>Карт в словаре</span><span class="stat-list__value">78</span></div>' +
        "</div></div></div>" +

        '<div class="grid-3">' +
        '<a class="glass-card action-card" data-tilt href="#/spread"><span class="action-card__title">Новый расклад</span>' +
        '<span class="action-card__desc">От одной карты до Кельтского креста.</span><span class="action-card__arrow">начать →</span></a>' +
        '<a class="glass-card action-card" data-tilt href="#/deck"><span class="action-card__title">Колода · 78</span>' +
        '<span class="action-card__desc">Все арканы, поиск и мгновенный словарь.</span><span class="action-card__arrow">открыть →</span></a>' +
        '<a class="glass-card action-card" data-tilt href="#/journal"><span class="action-card__title">Журнал</span>' +
        '<span class="action-card__desc">История сеансов и экспорт в JSON.</span><span class="action-card__arrow">листать →</span></a>' +
        "</div></section>";
    },
    mount(root) {
      const btn = T.$("[data-card-of-day]", root);
      btn.addEventListener("click", () => {
        const day = T.cardOfDay();
        const flipped = btn.querySelector(".tarot-card__inner").parentElement.classList.toggle("tarot-card--flipped");
        btn.setAttribute("aria-label", "Карта дня: " + day.card.name + (day.reversed ? ", перевёрнутая" : ", прямая"));
        T.$("[data-day-name]", root).hidden = false;
        T.$("[data-day-name]", root).textContent = day.card.name + (day.reversed ? " · перевёрнутая" : "");
        T.$("[data-day-meaning]", root).hidden = false;
        T.$("[data-day-link]", root).hidden = false;
        if (flipped) T.toast("Карта дня: " + day.card.name, "success", 2600);
      });
    },
  };

  /* ---------- колода ---------- */
  let deckFilter = "all", deckQuery = "";
  T.pages.deck = {
    title: "Колода",
    render() {
      return '<section class="deck-view" aria-labelledby="dck-title">' +
        '<div class="page-header"><h1 class="page-title" id="dck-title">Колода · 78</h1></div>' +
        '<div class="glass-card"><div class="filter-bar">' +
        '<div class="field"><label class="field-label" for="deck-search">Поиск</label>' +
        '<input class="input filter-bar__search" id="deck-search" data-deck-search placeholder="По названию…" value="' + T.esc(deckQuery) + '"></div>' +
        '<div class="form-actions">' +
        '<button class="btn btn--secondary btn--sm" data-suit="all" aria-pressed="' + (deckFilter === "all") + '">Все</button>' +
        '<button class="btn btn--secondary btn--sm" data-suit="major" aria-pressed="' + (deckFilter === "major") + '">Старшие</button>' +
        '<button class="btn btn--secondary btn--sm" data-suit="wands" aria-pressed="' + (deckFilter === "wands") + '">Жезлы</button>' +
        '<button class="btn btn--secondary btn--sm" data-suit="cups" aria-pressed="' + (deckFilter === "cups") + '">Кубки</button>' +
        '<button class="btn btn--secondary btn--sm" data-suit="swords" aria-pressed="' + (deckFilter === "swords") + '">Мечи</button>' +
        '<button class="btn btn--secondary btn--sm" data-suit="pentacles" aria-pressed="' + (deckFilter === "pentacles") + '">Пентакли</button>' +
        "</div></div></div>" +
        '<div class="grid-auto" data-deck-grid></div></section>';
    },
    mount(root) {
      const grid = T.$("[data-deck-grid]", root);

      const paint = () => {
        const q = deckQuery.trim().toLowerCase();
        const cards = T.CARDS.filter((c) => {
          const okSuit = deckFilter === "all" ||
            (deckFilter === "major" ? c.arcana === "major" : c.suit === deckFilter);
          const okQ = !q || c.name.toLowerCase().includes(q) ||
            c.keywords.some((k) => k.toLowerCase().includes(q));
          return okSuit && okQ;
        });
        grid.innerHTML = cards.length
          ? cards.map((c) =>
            '<button class="glass-card deck-tile" data-goto="' + c.id + '">' +
            T.cardHTML(c, false, { size: "sm", flipped: true }) +
            '<span class="deck-tile__name">' + T.esc(c.name) + "</span></button>").join("")
          : '<div class="empty-state"><p class="empty-state__title">Ничего не найдено</p></div>';
        T.$$("[data-goto]", grid).forEach((b) =>
          b.addEventListener("click", () => (location.hash = "#/glossary/" + b.dataset.goto)));
        T.tilt(grid);
      };

      T.$("[data-deck-search]", root).addEventListener("input", (e) => { deckQuery = e.target.value; paint(); });
      T.$$("[data-suit]", root).forEach((b) =>
        b.addEventListener("click", () => {
          deckFilter = b.dataset.suit;
          T.$$("[data-suit]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          paint();
        }));

      /* скелетоны при первом заходе — жизнь страницы */
      grid.innerHTML = Array.from({ length: 12 })
        .map(() => '<div class="skeleton skeleton-card"></div>').join("");
      setTimeout(paint, 420);
    },
  };

  /* ---------- словарь ---------- */
  T.pages.glossary = {
    title: "Словарь",
    render(cardId) {
      const groups =
        '<optgroup label="Старшие арканы">' +
        T.CARDS.filter((c) => c.arcana === "major").map((c) =>
          '<option value="' + c.id + '">' + c.name + "</option>").join("") + "</optgroup>" +
        ["wands", "cups", "swords", "pentacles"].map((s) =>
          '<optgroup label="' + T.SUIT_LABELS[s] + '">' +
          T.CARDS.filter((c) => c.suit === s).map((c) =>
            '<option value="' + c.id + '">' + c.name + "</option>").join("") + "</optgroup>").join("");

      return '<section class="glossary" aria-labelledby="gls-title">' +
        '<div class="page-header"><h1 class="page-title" id="gls-title">Словарь значений</h1></div>' +
        '<div class="glass-card"><div class="field">' +
        '<label class="field-label" for="glossary-select">Выберите карту</label>' +
        '<select class="select" id="glossary-select">' + groups + "</select></div></div>" +
        '<div data-glossary-detail>' + glossaryDetail(cardId || "m0") + "</div></section>";
    },
    mount(root, cardId) {
      const sel = T.$("#glossary-select", root);
      const detail = T.$("[data-glossary-detail]", root);
      if (cardId) sel.value = cardId;
      sel.addEventListener("change", () => {
        location.hash = "#/glossary/" + sel.value; /* перерендер через роутер */
      });
      const revBtn = T.$("[data-reverse-flip]", root);
      if (revBtn) revBtn.addEventListener("click", () => {
        const cardEl = T.$(".card-detail__figure .tarot-card", root);
        cardEl.classList.toggle("reversed");
        revBtn.textContent = cardEl.classList.contains("reversed") ? "Показать прямой" : "Показать перевёрнутой";
      });
    },
  };

  function glossaryDetail(cardId) {
    const c = T.cardById(cardId) || T.CARDS[0];
    return '<div class="card-detail"><div class="grid-2">' +
      '<div class="glass-card card-detail__figure" data-tilt>' +
      T.cardHTML(c, false, { size: "lg", flipped: true }) +
      '<button class="btn btn--ghost btn--sm" data-reverse-flip style="margin-top:var(--space-4)">Показать перевёрнутой</button></div>' +
      '<div class="glass-card"><h2 class="section-title">' + T.esc(c.name) + "</h2>" +
      '<p class="spread-meta">' + (c.arcana === "major" ? "Старший аркан" : T.SUIT_LABELS[c.suit] + " · младший аркан") + "</p>" +
      '<hr class="divider--gold">' +
      '<p class="small-caps text-muted">Прямое положение</p>' +
      '<p class="reading-text" style="padding:var(--space-4)">' + T.esc(c.upright) + "</p>" +
      '<p class="small-caps text-muted" style="margin-top:var(--space-4)">Перевёрнутое положение</p>' +
      '<p class="reading-text" style="padding:var(--space-4)">' + T.esc(c.reversed) + "</p>" +
      '<div class="tag-list" style="margin-top:var(--space-4)">' +
      c.keywords.map((k) => '<span class="tag">' + T.esc(k) + "</span>").join("") + "</div></div></div></div>";
  }

  /* ---------- настройки ---------- */
  T.pages.settings = {
    title: "Настройки",
    render() {
      return '<section class="settings-form" aria-labelledby="stt-title">' +
        '<div class="page-header"><h1 class="page-title" id="stt-title">Настройки</h1></div>' +
        '<form class="glass-card container--narrow" data-settings>' +
        '<div class="field"><label class="field-label" for="set-name">Ваше имя</label>' +
        '<input class="input" id="set-name" data-set-name maxlength="40" placeholder="Как подписать журнал?" value="' + T.esc(T.settings.name) + '"></div>' +
        '<div class="field"><label class="field-label" for="set-deck">Рабочая колода</label>' +
        '<select class="select" id="set-deck" data-set-deck>' +
        '<option value="rider"' + (T.settings.deck === "rider" ? " selected" : "") + ">Райдер–Уэйт</option>" +
        '<option value="marseille"' + (T.settings.deck === "marseille" ? " selected" : "") + ">Марсельская</option>" +
        "</select></div>" +
        '<div class="field"><span class="field-label">Перевёрнутые карты</span>' +
        '<button class="toggle" role="switch" aria-checked="' + T.settings.reversals + '" aria-label="Перевёрнутые карты" data-set-rev></button>' +
        '<p class="form-hint">При включении каждая вытянутая карта с равной вероятностью ложится перевёрнутой.</p></div>' +
        '<div class="form-actions">' +
        '<button class="btn btn--primary" type="submit">Сохранить</button>' +
        '<button class="btn btn--danger" type="button" data-reset>Сбросить все данные</button></div>' +
        "</form></section>";
    },
    mount(root) {
      const form = T.$("[data-settings]", root);
      const rev = T.$("[data-set-rev]", root);
      rev.addEventListener("click", () =>
        rev.setAttribute("aria-checked", String(rev.getAttribute("aria-checked") !== "true")));

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        T.settings.name = T.$("[data-set-name]", root).value.trim();
        T.settings.deck = T.$("[data-set-deck]", root).value;
        T.settings.reversals = rev.getAttribute("aria-checked") === "true";
        T.saveSettings();
        updateHeaderName();
        T.toast("Настройки сохранены", "success");
        T.renderContext();
      });

      const reset = T.$("[data-reset]", root);
      reset.addEventListener("click", () => {
        if (reset.dataset.armed === "1") {
          T.storage.remove(T.SETTINGS_KEY);
          T.storage.remove(T.JOURNAL_KEY);
          T.toast("Данные сброшены. Перезагрузка…", "warning");
          setTimeout(() => location.reload(), 700);
        } else {
          reset.dataset.armed = "1";
          reset.textContent = "Точно сбросить? Нажмите ещё раз";
          setTimeout(() => { reset.dataset.armed = ""; reset.textContent = "Сбросить все данные"; }, 3200);
        }
      });
    },
  };

  /* ---------- запуск ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initChrome();
    if (!location.hash) location.hash = "#/dashboard";
    T.navigate();
    T.toast("Кабинет открыт. Колода к вашим услугам.", "info", 2600);
  });

  /* ---------- чеклист самопроверки (по ТЗ) ---------- */
  setTimeout(() => {
    const d = document.querySelector(".dashboard");
    const g = document.querySelector(".glass-card");
    const gapOk = d && getComputedStyle(d).gap === "20px";
    const blurOk = g && /blur/.test(getComputedStyle(g).backdropFilter || "");
    console.log(
      "%cAurora Tarot · самопроверка каскада\n" +
      "%c · .dashboard gap === " + (d ? getComputedStyle(d).gap : "—") + " → " + (gapOk ? "OK" : "FAIL") +
      "\n · .glass-card backdrop-filter → " + (g ? getComputedStyle(g).backdropFilter || "нет" : "—") + " → " + (blurOk ? "OK" : "FAIL") +
      "\n · карт в колоде: " + AT.CARDS.length + " → " + (AT.CARDS.length === 78 ? "OK" : "FAIL"),
      "font-weight:bold", ""
    );
  }, 900);
})(window.AT);
