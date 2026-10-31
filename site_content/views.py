from pathlib import Path

from django.conf import settings
from django.db.models import Q
from django.http import Http404
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone

from reviews.models import Review
from tarot.cards import TOTAL, daily_card

from .media import ranged_file_response
from .models import SiteProfile, Story
from .services import site_json


def home(request):
    card, reversed_ = daily_card(timezone.localdate())
    user = request.user
    server = {
        "auth": user.is_authenticated,
        "name": user.display_name() if user.is_authenticated else "",
        "csrf": get_token(request),
        "day": {"id": card["id"], "reversed": reversed_},
        "collected": user.cards.count() if user.is_authenticated else 0,
        "total": TOTAL,
        "urls": {
            "dayOpen": reverse("api-day-open"),
            "spread": reverse("api-spread"),
            "collection": reverse("collection"),
            "book": reverse("booking:book"),
            "register": reverse("accounts:register"),
            "login": reverse("accounts:login"),
            "experience": reverse("experience"),
            "privacy": reverse("privacy"),
        },
    }
    return render(request, "book.html", {"site_data": site_json(SiteProfile.load()), "server_data": server, "is_book": True})


def experience(request):
    stories = Story.objects.filter(is_published=True)
    reviews = Review.objects.filter(status=Review.Status.APPROVED, consent_publish=True).order_by("-created_at")[:60]
    return render(request, "experience.html", {"stories": stories, "reviews": reviews})


def privacy(request):
    return render(request, "privacy.html")


def media_file(request, path):
    path = path.replace("\\", "/")
    user = request.user
    staff = user.is_authenticated and user.is_staff
    if path.startswith("reviews/"):
        review = Review.objects.filter(video=path).first()
        if not review:
            raise Http404
        public = review.status == Review.Status.APPROVED and review.consent_publish
        if not (public or staff or (user.is_authenticated and user.pk == review.user_id)):
            raise Http404
    elif path.startswith("stories/"):
        story = Story.objects.filter(Q(video=path) | Q(poster=path)).first()
        if not story:
            raise Http404
        public = story.is_published
        if not (public or staff):
            raise Http404
    else:
        raise Http404
    root = Path(settings.MEDIA_ROOT).resolve()
    full = (root / path).resolve()
    if root not in full.parents or not full.is_file():
        raise Http404
    resp = ranged_file_response(request, full)
    resp["Cache-Control"] = "public, max-age=86400" if public else "private, no-store"
    return resp
