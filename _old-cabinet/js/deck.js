/* Fisher–Yates, карта дня (детерминированная), настройки, хранилище. */
(function (T) {

  T.storage = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
      catch (e) { return def; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  };

  T.SETTINGS_KEY = "aurora.settings";
  T.JOURNAL_KEY = "aurora.journal";

  T.settings = Object.assign(
    { name: "", deck: "rider", reversals: true },
    T.storage.get(T.SETTINGS_KEY, {})
  );
  T.saveSettings = () => T.storage.set(T.SETTINGS_KEY, T.settings);

  /* Fisher–Yates, без мутации оригинала */
  T.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* djb2-hash → детерминированный выбор */
  function dayHash(date) {
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    let h = 5381;
    String(seed).split("").forEach((ch) => { h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; });
    return h >>> 0;
  }

  /* карта дня: у одного дня — всегда одна и та же */
  T.cardOfDay = function (date = new Date()) {
    const h = dayHash(date);
    const card = T.CARDS[h % T.CARDS.length];
    const reversed = !!(Math.floor(h / 65536) % 2);
    return { card, reversed };
  };

  /* совет дня — тоже детерминированный */
  T.dailyAdvice = function (date = new Date()) {
    const LIST = [
      "Не спрашивай, верен ли путь, — спроси, твой ли он.",
      "Карта закрывает вопрос не ответом, а зеркалом.",
      "Сегодня важнее не тянуть карту, а услышать первую мысль до неё.",
      "Перевёрнутая карта не запрещает — она подсказывает угол.",
      "Сомнение — тоже карта. Прочитай его, прежде чем тянуть новую.",
      "Сначала вопрос, потом колода. Не наоборот.",
      "Тот, кто записывает расклады, учится вдвое быстрее.",
      "Задай вопрос так, чтобы ответ мог быть «нет».",
      "Кельтский крест не терпит спешки. Ни в раскладе, ни в жизни.",
      "Колода помнит руки. Сегодня — день бережного перемешивания.",
    ];
    return LIST[dayHash(date) % LIST.length];
  };

  T.drawPosition = function (card) {
    return { card, reversed: T.settings.reversals ? Math.random() < 0.5 : false };
  };
})(window.AT);
