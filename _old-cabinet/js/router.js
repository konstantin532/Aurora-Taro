/* Hash-роутинг: #/dashboard, #/spread, #/reading, #/journal, #/deck, #/glossary(/:id), #/settings */
(function (T) {

  const TITLES = {
    dashboard: "Кабинет", spread: "Расклад", reading: "Толкование",
    journal: "Журнал гаданий", deck: "Колода", glossary: "Словарь значений", settings: "Настройки",
  };

  function parse() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const key = T.pages[parts[0]] ? parts[0] : "dashboard";
    return { key, arg: parts[1] || null };
  }

  function renderNav(key) {
    const NAV = [
      ["dashboard", "Кабинет", '<path d="M19 14a7.5 7.5 0 0 1-9-9 7.5 7.5 0 1 0 9 9z"/>'],
      ["spread", "Расклад", '<path d="M7 4l1.7 3.8L12.5 9.5 8.7 11.2 7 15l-1.7-3.8L1.5 9.5l3.8-1.7zM17 10l1.2 2.7 2.7 1.2-2.7 1.2L17 18l-1.2-2.9-2.7-1.2 2.7-1.2zM15.5 4.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>'],
      ["journal", "Журнал", '<path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2zM5 4v14M9 8h6M9 12h6"/>'],
      ["deck", "Колода", '<rect x="6.5" y="3.5" width="11" height="15" rx="1.5"/><path d="M4.5 6.5v12a2 2 0 002 2h9M9.5 8h5"/>'],
      ["glossary", "Словарь", '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>'],
      ["settings", "Настройки", '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>'],
    ];
    const list = T.$("#nav-list");
    list.innerHTML = NAV.map(([id, label, body]) =>
      '<li><a class="nav-item" href="#/' + id + '"' + (id === key ? ' aria-current="page"' : "") + ">" +
      '<svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>" +
      '<span class="nav-item__label">' + label + "</span>" +
      (id === "journal" ? '<span class="badge" data-nav-badge hidden>0</span>' : "") + "</a></li>").join("");
    if (T.updateNavBadge) T.updateNavBadge();
  }

  function renderCrumbs(key) {
    const crumb = T.$("#breadcrumb-list");
    const isHome = key === "dashboard";
    crumb.innerHTML =
      '<li class="breadcrumb-item"' + (isHome ? ' aria-current="page"' : "") + '><a href="#/dashboard">Aurora</a></li>' +
      (isHome ? "" : '<li class="breadcrumb-item" aria-current="page">' + TITLES[key] + "</li>");
  }

  function renderContext() {
    const el = T.$("#context-panel");
    if (!el) return;
    const entries = T.journal.entries.length;
    el.innerHTML =
      '<div class="glass-card bg-stars"><p class="small-caps text-muted">Луна сегодня</p>' + T.moonBadge() + "</div>" +
      '<div class="glass-card"><p class="small-caps text-muted">Практика</p><div class="stat-list">' +
      '<div class="stat-list__row"><span>Сеансов в журнале</span><span class="stat-list__value">' + entries + "</span></div>" +
      '<div class="stat-list__row"><span>Карт в колоде</span><span class="stat-list__value">78</span></div>" +
      '<div class="stat-list__row"><span>Колода</span><span class="stat-list__value">' +
      (T.settings.deck === "rider" ? "Р.–У." : "Марс.") + "</span></div></div></div>" +
      '<div class="glass-card bg-constellation"><p class="small-caps text-muted">Совет дня</p>' +
      '<p class="text-serif">' + T.esc(T.dailyAdvice()) + "</p></div>";
  }
  T.renderContext = renderContext;

  function render() {
    const { key, arg } = parse();
    const page = T.pages[key];
    const main = T.$("#main-content");

    main.innerHTML = page.render(arg);
    if (page.mount) page.mount(main, arg);

    renderNav(key);
    renderCrumbs(key);
    renderContext();
    document.title = TITLES[key] + " · Aurora Tarot";
    T.tilt(main);
    window.scrollTo({ top: 0, behavior: "auto" });
    main.focus({ preventScroll: true });
  }

  T.navigate = render;
  window.addEventListener("hashchange", render);
})(window.AT);
