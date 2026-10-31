import json
from pathlib import Path

CARDS = json.loads(Path(__file__).with_name("cards.json").read_text(encoding="utf-8"))
BY_ID = {c["id"]: c for c in CARDS}
TOTAL = len(CARDS)
ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII",
         "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"]
SUIT_LABELS = {"wands": "Жезлы", "cups": "Кубки", "swords": "Мечи", "pentacles": "Пентакли"}
GROUPS = [("major", "Старшие арканы")] + list(SUIT_LABELS.items())


def mark(card):
    if card["arcana"] == "major":
        return "Аркан " + ROMAN[int(card["id"][1:])]
    return SUIT_LABELS[card["suit"]]


def _fnv1a(text):
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def daily_card(day):
    """Та же формула, что в static/js/app.js: карта дня одна на всех."""
    h = _fnv1a(f"aurora:{day.year}-{day.month}-{day.day}")
    return CARDS[h % TOTAL], (h >> 11) % 3 == 0
