/* Схемы раскладов, доска со слотами, тасование, чтение, страницы spread+reading. */
(function (T) {

  T.SPREADS = {
    one: {
      name: "Одна карта", hint: "Быстрый ответ на суть вопроса", layout: "row",
      slots: [{ label: "Суть" }],
    },
    three: {
      name: "Три карты", hint: "Прошлое — Настоящее — Будущее", layout: "row",
      slots: [{ label: "Прошлое" }, { label: "Настоящее" }, { label: "Будущее" }],
    },
    celtic: {
      name: "Кельтский крест", hint: "Классика из десяти карт", layout: "celtic",
      slots: [
        { label: "Суть", area: "c1" },
        { label: "Препятствие", area: "c2", cross: true },
        { label: "Основа", area: "c3" },
        { label: "Прошлое", area: "c4" },
        { label: "Возможное", area: "c5" },
        { label: "Будущее", area: "c6" },
        { label: "Вы сами", area: "o7" },
        { label: "Окружение", area: "o8" },
        { label: "Надежды и страхи", area: "o9" },
        { label: "Итог", area: "o10" },
      ],
    },
    yesno: {
      name: "Да — Нет", hint: "Одна карта, прямой ответ", layout: "row",
      slots: [{ label: "Ответ" }],
    },
  };

  /* текущий сеанс расклада (в памяти) */
  T.session = null;
  function newSession(spreadId) {
    T.session = {
      spreadId, question: "", deck: T.shuffle(T.CARDS),
      drawn: [], complete: false,
    };
  }

  /* ---------- доска ---------- */
  function slotHTML(slot, i, spread) {
    const drawn = T.session && T.session.drawn[i];
    const cls = ["spread-slot", slot.cross ? " spread-slot--cross" : ""];
    const style = slot.area && !slot.cross ? ' style="grid-area:' + slot.area + '"' : "";
    let inner = '<span class="spread-slot__label">' + T.esc(slot.label) + "</span>";
    if (drawn) {
      cls.push("spread-slot--filled");
      const card = T.CARDS.find((c) => c.id === drawn.cardId);
      inner = T.cardHTML(card, drawn.reversed, {
        fill: true, button: true, dealt: true,
        ariaLabel: "Карта " + (i + 1) + " закрыта — нажмите, чтобы открыть",
      });
    }
    return '<div class="' + cls.join(" ").trim() + '" data-slot="' + i + '"' + style + ">" + inner + "</div>";
  }

  function renderBoard(root) {
    const spread = T.SPREADS[T.session.spreadId];
    const slotsEl = T.$("[data-slots]", root);
    slotsEl.className = spread.layout === "celtic" ? "celtic-cross" : "slots-row";
    slotsEl.innerHTML = spread.slots.map((s, i) => slotHTML(s, i, spread)).join("");

    /* прогресс */
    const prog = T.$("[data-board-progress]", root);
    const n = T.session.drawn.length, total = spread.slots.length;
    prog.setAttribute("aria-valuenow", n);
    T.$(".progress__fill", root).style.width = (total ? (n / total) * 100 : 0) + "%";
    T.$("[data-progress-text]", root).textContent = "Выложено " + n + " из " + total;

    /* флип карт в слотах */
    T.$$("[data-slot] .tarot-card", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.closest("[data-slot]").dataset.slot);
        const d = T.session.drawn[i];
        const card = T.CARDS.find((c) => c.id === d.cardId);
        const wasFlipped = btn.classList.toggle("tarot-card--flipped");
        btn.setAttribute("aria-label", wasFlipped
          ? card.name + ", позиция «" + spread.slots[i].label + "», " + (d.reversed ? "перевёрнутая" : "прямая")
          : "Карта " + (i + 1) + " закрыта — нажмите, чтобы открыть");
      });
    });

    /* веер: клик = вытянуть */
    const fan = T.$("[data-fan]", root);
    fan.hidden = T.session.complete || !T.session.deck.length;
    const readBtn = T.$("[data-read]", root);
    readBtn.hidden = !T.session.complete;

    T.$("[data-shuffle]", root).addEventListener("click", () => {
      fan.classList.remove("fan-deck--shuffling");
      void fan.offsetWidth; /* перезапуск анимации */
      fan.classList.add("fan-deck--shuffling");
      T.session.deck = T.shuffle(T.session.deck);
      T.toast("Колода перетасована", "info", 2200);
    });

    fan.onclick = () => {
      if (T.session.complete) return;
      const idx = T.session.drawn.length;
      const card = T.session.deck.pop();
      const pos = T.drawPosition(card);
      T.session.drawn.push({ cardId: card.id, reversed: pos.reversed });
      T.session.question = T.$("[data-question]", root).value.trim();
      const slotEl = T.$('[data-slot="' + idx + '"]', root);
      T.flyCard(fan, slotEl, () => {
        renderBoard(root);
        if (T.session.drawn.length === spread.slots.length) {
          T.session.complete = true;
          renderBoard(root);
          T.toast("Расклад выложен полностью — можно читать", "success");
        }
      });
    };
  }

  T.pages.spread = {
    title: "Расклад",
    render() {
      const options = Object.keys(T.SPREADS).map((k) => {
        const s = T.SPREADS[k];
        return '<button class="glass-card spread-option" data-spread-pick="' + k + '" aria-pressed="' +
          (T.session && T.session.spreadId === k) + '">' +
          '<span class="spread-name">' + s.name + "</span>" +
          '<span class="spread-meta">' + s.hint + "</span>" +
          '<span class="badge">' + s.slots.length + "</span></button>";
      }).join("");

      return '<section class="spread-board" aria-labelledby="spd-title">' +
        '<div class="page-header"><h1 class="page-title" id="spd-title">Расклад</h1>' +
        '<p class="spread-meta">выберите схему — и тяните карты из колоды</p></div>' +
        '<div class="glass-card"><h2 class="section-title">Схема</h2>' +
        '<div class="grid-2">' + options + "</div></div>" +
        '<div class="glass-card"><div class="field">' +
        '<label class="field-label" for="spread-question">Ваш вопрос (необязательно)</label>' +
        '<input class="input" id="spread-question" data-question maxlength="160" placeholder="О чём спрашиваем колоду?"' +
        ' value="' + T.esc(T.session ? T.session.question : "") + '"></div></div>' +
        '<div class="glass-card" data-board hidden>' +
        '<div class="page-header"><h2 class="section-title" data-spread-name></h2><span class="spread-meta" data-spread-meta></span></div>' +
        '<div class="progress" data-board-progress role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0" aria-label="Прогресс расклада"><div class="progress__fill"></div></div>' +
        '<p class="small-caps text-muted" data-progress-text></p>' +
        '<div class="scroll-x"><div data-slots class="slots-row"></div></div></div>' +
        '<div class="glass-card" data-deck-zone hidden>' +
        '<h2 class="section-title">Колода</h2>' +
        '<p class="spread-meta">Нажмите на стопку, чтобы вытянуть карту; клик по лежащей карте открывает её.</p>' +
        '<div class="deck-zone">' +
        '<button class="fan-deck" data-fan aria-label="Вытянуть карту из колоды">' +
        '<span class="fan-deck__card"></span><span class="fan-deck__card"></span>' +
        '<span class="fan-deck__card"></span><span class="fan-deck__card"></span></button>' +
        '<div class="form-actions">' +
        '<button class="btn btn--secondary" data-shuffle>' + T.icon.shuffle(15) + " Перетасовать</button>" +
        '<button class="btn btn--primary" data-read hidden>Читать расклад</button></div></div></div></section>';
    },
    mount(root) {
      T.$$("[data-spread-pick]", root).forEach((btn) => {
        btn.addEventListener("click", () => {
          T.$$("[data-spread-pick]", root).forEach((b) => b.setAttribute("aria-pressed", "false"));
          btn.setAttribute("aria-pressed", "true");
          const id = btn.dataset.spreadPick;
          if (T.session && T.session.spreadId === id) return;
          newSession(id);
          T.session.question = T.$("[data-question]", root).value.trim();
          T.toast("Схема: " + T.SPREADS[id].name, "info", 2200);
          paint();
        });
      });

      function paint() {
        if (!T.session) return;
        const spread = T.SPREADS[T.session.spreadId];
        const board = T.$("[data-board]", root);
        board.hidden = false;
        T.$("[data-spread-name]", root).textContent = spread.name;
        T.$("[data-spread-meta]", root).textContent = spread.hint;
        T.$("[data-board-progress]", root).setAttribute("aria-valuemax", spread.slots.length);
        T.$("[data-deck-zone]", root).hidden = false;
        renderBoard(root);
      }

      if (T.session) paint();

      T.$("[data-read]", root).addEventListener("click", () => {
        T.session.question = T.$("[data-question]", root).value.trim();
        location.hash = "#/reading";
      });
    },
  };

  /* ---------- страница толкования ---------- */
  function buildSummary(session) {
    const spread = T.SPREADS[session.spreadId];
    if (session.spreadId === "yesno") {
      const d = session.drawn[0];
      return d.reversed ? "Колода говорит «нет» — и просит не форсировать вопрос." : "Колода говорит «да» — дверь открыта.";
    }
    const last = session.drawn[spread.slots.length - 1];
    const lastCard = T.CARDS.find((c) => c.id === last.cardId);
    return "Кульминация расклада — «" + spread.slots[spread.slots.length - 1].label + "»: " +
      lastCard.name + (last.reversed ? " (перевёрнутая)." : ".");
  }

  T.pages.reading = {
    title: "Толкование",
    render() {
      if (!T.session || !T.session.complete) {
        return '<section class="reading-result" aria-labelledby="rdg-title">' +
          '<div class="page-header"><h1 class="page-title" id="rdg-title">Толкование</h1></div>' +
          '<div class="empty-state"><p class="empty-state__title">Расклад не завершён</p>' +
          '<p>Сначала выложите все карты на доске расклада.</p>' +
          '<a class="btn btn--ghost btn--sm" href="#/spread">К доске расклада</a></div></section>';
      }
      const s = T.session, spread = T.SPREADS[s.spreadId];
      const verdictHTML = s.spreadId === "yesno"
        ? '<p class="verdict">' + (s.drawn[0].reversed ? "НЕТ" : "ДА") + "</p>" : "";

      const positions = spread.slots.map((slot, i) => {
        const d = s.drawn[i];
        const card = T.CARDS.find((c) => c.id === d.cardId);
        const meaning = d.reversed ? card.reversed : card.upright;
        return '<div class="glass-card reading-pos">' +
          T.cardHTML(card, d.reversed, { size: "md", flipped: true, dealt: true }) +
          '<div class="reading-pos__text">' +
          '<p class="small-caps text-muted">' + T.esc(slot.label) + "</p>" +
          '<h3 class="section-title">' + T.esc(card.name) + (d.reversed ? " · перевёрнутая" : "") + "</h3>" +
          '<p class="text-serif">' + T.esc(meaning) + "</p></div></div>";
      }).join("");

      const tags = {};
      s.drawn.forEach((d) => {
        T.CARDS.find((c) => c.id === d.cardId).keywords.forEach((k) => (tags[k] = true));
      });
      const tagHTML = Object.keys(tags).map((k) => '<span class="tag">' + T.esc(k) + "</span>").join("");

      return '<section class="reading-result" aria-labelledby="rdg-title">' +
        '<div class="page-header"><h1 class="page-title" id="rdg-title">Толкование</h1></div>' +
        '<div class="glass-card bg-constellation">' +
        '<h2 class="section-title">' + T.esc(spread.name) + "</h2>" +
        '<p class="spread-meta">' + (s.question ? "«" + T.esc(s.question) + "»" : T.esc(spread.hint)) + "</p>" +
        verdictHTML + "</div>" +
        '<div class="grid-2">' + positions + "</div>" +
        '<div class="glass-card"><h2 class="section-title">Итог</h2>' +
        '<p class="lede">' + T.esc(buildSummary(s)) + "</p>" +
        '<div class="tag-list">' + tagHTML + "</div>" +
        '<hr class="divider--gold">' +
        '<div class="form-actions">' +
        '<button class="btn btn--primary" data-save-reading>Сохранить в журнал</button>' +
        '<a class="btn btn--ghost" href="#/spread">Новый расклад</a></div></div></section>';
    },
    mount(root) {
      const btn = T.$("[data-save-reading]", root);
      if (!btn || !T.session) return;
      btn.addEventListener("click", () => {
        const s = T.session;
        T.journal.add({
          spreadId: s.spreadId, spreadName: T.SPREADS[s.spreadId].name,
          question: s.question, summary: buildSummary(s),
          verdict: s.spreadId === "yesno" ? (s.drawn[0].reversed ? "no" : "yes") : null,
          cards: s.drawn,
        });
        btn.disabled = true;
        btn.textContent = "Сохранено";
        T.toast("Расклад записан в журнал", "success");
        if (T.updateNavBadge) T.updateNavBadge();
      });
    },
  };
})(window.AT);
