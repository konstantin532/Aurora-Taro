from datetime import date, timedelta
from unittest import mock

from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from tarot.cards import daily_card
from tarot.models import CollectedCard, Spread

from .helpers import make_user


class DailyCardTests(TestCase):
    def test_matches_browser_formula(self):
        # Эталон посчитан функцией dailyCard из static/js/app.js.
        self.assertEqual([(c["id"], r) for c, r in map(daily_card, [date(2026, 10, 31), date(2027, 1, 1), date(2026, 2, 28)])],
                         [("m2", False), ("m8", False), ("wands2", True)])


class CollectionApiTests(TestCase):
    def setUp(self):
        self.anna = make_user("anna@example.com")

    def test_anonymous_spread_draws_three_distinct_cards_and_saves_nothing(self):
        data = self.client.post(reverse("api-spread")).json()
        self.assertEqual(len({c["id"] for c in data["cards"]}), 3)
        self.assertFalse(data["auth"])
        self.assertFalse(Spread.objects.exists())

    def test_spread_unlocks_cards_three_times_a_day(self):
        self.client.force_login(self.anna)
        for i in range(3):
            data = self.client.post(reverse("api-spread")).json()
            self.assertTrue(data["counted"])
            self.assertEqual(data["collectLeft"], 2 - i)
        data = self.client.post(reverse("api-spread")).json()
        self.assertFalse(data["counted"])
        self.assertEqual(data["new"], [])
        self.assertEqual(Spread.objects.filter(user=self.anna).count(), 4)
        self.assertEqual(Spread.objects.filter(user=self.anna, counted=True).count(), 3)
        counted_ids = {c["id"] for s in Spread.objects.filter(counted=True) for c in s.cards}
        self.assertEqual(set(CollectedCard.objects.values_list("card_id", flat=True)), counted_ids)

    def test_limit_resets_next_day(self):
        self.client.force_login(self.anna)
        for _ in range(3):
            self.client.post(reverse("api-spread"))
        Spread.objects.update(created_at=timezone.now() - timedelta(days=1))
        self.assertTrue(self.client.post(reverse("api-spread")).json()["counted"])

    def test_day_card_unlocks_once(self):
        self.client.force_login(self.anna)
        with mock.patch("tarot.views.timezone.localdate", return_value=date(2026, 10, 31)):
            first = self.client.post(reverse("api-day-open")).json()
            second = self.client.post(reverse("api-day-open")).json()
        self.assertEqual(first["card"], "m2")
        self.assertEqual(first["new"], ["m2"])
        self.assertEqual(second["new"], [])
        self.assertEqual(CollectedCard.objects.get().card_id, "m2")

    def test_api_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.anna)
        self.assertEqual(client.post(reverse("api-spread")).status_code, 403)
        self.assertEqual(client.post(reverse("api-day-open")).status_code, 403)
        self.assertFalse(Spread.objects.exists())

    def test_get_is_not_allowed(self):
        self.assertEqual(self.client.get(reverse("api-spread")).status_code, 405)

    def test_collection_shows_only_own_cards(self):
        boris = make_user("boris@example.com")
        CollectedCard.objects.create(user=boris, card_id="m0", source="day")
        CollectedCard.objects.create(user=self.anna, card_id="m1", source="day")
        self.client.force_login(self.anna)
        resp = self.client.get(reverse("collection"))
        self.assertContains(resp, "<strong>1</strong> из 78")
        self.assertContains(resp, "#/card/m1")
        self.assertNotContains(resp, "#/card/m0")
