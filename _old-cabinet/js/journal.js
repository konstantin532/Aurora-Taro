/* Журнал: localStorage, фильтр, экспорт JSON (blob), страница журнала. */
(function (T) {

  const j = {
    entries: T.storage.get(T.JOURNAL_KEY, []),
    save() { T.storage.set(T.JOURNAL_KEY, this.entries); },
    add(entry) {
      this.entries.unshift(Object.assign({ id: Date.now(), date: Date.now() }, entry));
      this.save();
      if (T.updateNavBadge) T.updateNavBadge();
    },
    remove(id) {
      this.entries = this.entries.filter((e) => e.id !== id);
      this.save();
    },
    clear() { this.entries = []; this.save(); },
    last() { return this.entries[0] || null; },
    export() {
      const blob = new Blob([JSON.stringify(this.entries, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aurora-tarot-journal.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      T.toast("Журнал выгружен в JSON", "success");
    },
  };
  T.journal = j;

  function summaryOf(entry) {
    if (entry.verdict === "yes") return "Ответ: ДА. " + entry.cards[0].name + " — " + (entry.cards[0].reversed ? "" : "прямая");
    if (entry.verdict === "no")  return "Ответ: НЕТ. " + entry.cards[0].name;
    return entry.cards.map((c) => c.name + (c.reversed ? " (перев.)" : "")).join(" → ");
  }

  function entryHTML(e) {
    const cards = e.cards.map((c) => T.cardHTML(T.cardById(c.cardId), c.reversed, { size: "sm", flipped: true })).join("");
    return '<article class="journal-entry" data-entry-id="' + e.id + '">' +
      '<p class="small-caps journal-entry__date">' + T.fmtDateTime(e.date) + "</p>" +
      '<h3 class="journal-entry__spread">' + T.esc(e.spreadName) + "</h3>" +
      (e.question ? '<p class="spread-meta">«' + T.esc(e.question) + "»</p>" : "") +
      '<div class="journal-entry__cards">' + cards + "</div>" +
      '<p class="journal-entry__summary">' + T.esc(e.summary || summaryOf(e)) + "</p>" +
      '<div class="journal-entry__actions">' +
        '<button class="btn btn--ghost btn--sm" data-journal-export>Экспорт</button>' +
        '<button class="btn btn--ghost btn--sm btn--danger" data-journal-del>' + T.icon.trash(14) + " Удалить</button>" +
      "</div></article>";
  }

  let filterValue = "all";

  T.pages.journal = {
    title: "Журнал гаданий",
    render() {
      const spreadOptions = Object.keys(T.SPREADS).map((k) =>
        '<option value="' + k + '">' + T.esc(T.SPREADS[k].name) + "</option>").join("");
      return '<section class="journal" aria-labelledby="jrn-title">' +
        '<div class="page-header"><h1 class="page-title" id="jrn-title">Журнал гаданий</h1>' +
        '<button class="btn btn--secondary" data-journal-export-all>' + T.icon.download(15) + " Экспорт JSON</button></div>" +
        '<div class="glass-card"><div class="filter-bar"><div class="field">' +
        '<label class="field-label" for="journal-filter">Фильтр по раскладу</label>' +
        '<select class="select" id="journal-filter"><option value="all">Все расклады</option>' + spreadOptions + "</select>" +
        "</div></div></div>" +
        '<div data-journal-list></div></section>';
    },
    mount(root) {
      const sel = T.$("#journal-filter", root);
      sel.value = filterValue;
      const list = T.$("[data-journal-list]", root);

      const paint = () => {
        const entries = filterValue === "all" ? j.entries : j.entries.filter((e) => e.spreadId === filterValue);
        list.innerHTML = entries.length
          ? entries.map(entryHTML).join("")
          : '<div class="empty-state"><p class="empty-state__title">Записей пока нет</p>' +
            '<p>Совершите первый расклад — и он появится здесь.</p>' +
            '<a class="btn btn--ghost btn--sm" href="#/spread">К раскладам</a></div>';
        T.$$("[data-journal-del]", list).forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = Number(btn.closest("[data-entry-id]").dataset.entryId);
            j.remove(id);
            T.toast("Запись удалена", "warning");
            paint();
          });
        });
        T.$$("[data-journal-export]", list).forEach((btn) =>
          btn.addEventListener("click", () => j.export()));
      };

      sel.addEventListener("change", () => { filterValue = sel.value; paint(); });
      T.$("[data-journal-export-all]", root).addEventListener("click", () => {
        if (!j.entries.length) { T.toast("Журнал пуст — нечего экспортировать", "warning"); return; }
        j.export();
      });
      paint();
    },
  };
})(window.AT);
