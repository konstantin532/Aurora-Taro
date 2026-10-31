from .models import CollectedCard

SPREADS_COUNTED_PER_DAY = 3


def unlock(user, card_ids, source):
    """Добавляет карты в коллекцию и возвращает те, что открылись впервые."""
    have = set(user.cards.filter(card_id__in=card_ids).values_list("card_id", flat=True))
    fresh = [cid for cid in dict.fromkeys(card_ids) if cid not in have]
    CollectedCard.objects.bulk_create(
        [CollectedCard(user=user, card_id=cid, source=source) for cid in fresh], ignore_conflicts=True
    )
    return fresh
