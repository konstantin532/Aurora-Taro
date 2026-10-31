import secrets

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .cards import CARDS, GROUPS, TOTAL, daily_card, mark
from .models import CollectedCard, Spread
from .services import SPREADS_COUNTED_PER_DAY, unlock


@require_POST
def api_day_open(request):
    card, reversed_ = daily_card(timezone.localdate())
    data = {"card": card["id"], "reversed": reversed_, "new": [], "auth": request.user.is_authenticated}
    if request.user.is_authenticated:
        data["new"] = unlock(request.user, [card["id"]], CollectedCard.Source.DAY)
        data["collected"] = request.user.cards.count()
    return JsonResponse(data)


@require_POST
def api_spread(request):
    rng = secrets.SystemRandom()
    cards = [{"id": c["id"], "reversed": rng.randrange(100) < 35} for c in rng.sample(CARDS, 3)]
    data = {"cards": cards, "new": [], "auth": request.user.is_authenticated}
    if request.user.is_authenticated:
        today = Spread.objects.filter(user=request.user, counted=True, created_at__date=timezone.localdate()).count()
        counted = today < SPREADS_COUNTED_PER_DAY
        Spread.objects.create(user=request.user, cards=cards, counted=counted)
        if counted:
            data["new"] = unlock(request.user, [c["id"] for c in cards], CollectedCard.Source.SPREAD)
        data["counted"] = counted
        data["collectLeft"] = max(0, SPREADS_COUNTED_PER_DAY - today - int(counted))
        data["collected"] = request.user.cards.count()
    return JsonResponse(data)


@login_required
def collection(request):
    opened = dict(request.user.cards.values_list("card_id", "first_at"))
    groups = []
    for key, label in GROUPS:
        items = [
            {"card": c, "mark": mark(c), "opened": c["id"] in opened, "at": opened.get(c["id"])}
            for c in CARDS if (c["arcana"] == "major" if key == "major" else c["suit"] == key)
        ]
        groups.append({"key": key, "label": label, "items": items, "opened": sum(i["opened"] for i in items)})
    return render(request, "tarot/collection.html", {
        "groups": groups, "collected": len(opened), "total": TOTAL,
        "percent": round(len(opened) * 100 / TOTAL),
    })
