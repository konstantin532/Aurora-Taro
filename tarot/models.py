from django.conf import settings
from django.db import models

from .cards import BY_ID


class CollectedCard(models.Model):
    class Source(models.TextChoices):
        DAY = "day", "карта дня"
        SPREAD = "spread", "пробный расклад"
        GIFT = "gift", "подарок таролога"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cards", verbose_name="клиент")
    card_id = models.CharField("карта", max_length=12, choices=[(k, v["name"]) for k, v in BY_ID.items()])
    source = models.CharField("откуда", max_length=10, choices=Source.choices)
    first_at = models.DateTimeField("открыта", auto_now_add=True)

    class Meta:
        verbose_name = "карта в коллекции"
        verbose_name_plural = "коллекции карт"
        constraints = [models.UniqueConstraint(fields=["user", "card_id"], name="collected_card_once")]

    def __str__(self):
        return BY_ID.get(self.card_id, {}).get("name", self.card_id)


class Spread(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="spreads", verbose_name="клиент")
    cards = models.JSONField("карты")
    counted = models.BooleanField("пошёл в коллекцию", default=False)
    created_at = models.DateTimeField("когда", auto_now_add=True)

    class Meta:
        verbose_name = "пробный расклад"
        verbose_name_plural = "пробные расклады"
        ordering = ["-created_at"]

    def __str__(self):
        return ", ".join(BY_ID[c["id"]]["name"] for c in self.cards if c["id"] in BY_ID)

    def card_list(self):
        return [{"card": BY_ID[c["id"]], "reversed": c["reversed"]} for c in self.cards if c["id"] in BY_ID]
