from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from booking.models import Booking, Slot

from .helpers import make_user


def slot(hours=48):
    return Slot.objects.create(start=timezone.now() + timedelta(hours=hours))


class BookingTests(TestCase):
    def setUp(self):
        self.anna = make_user("anna@example.com")
        self.boris = make_user("boris@example.com")

    def book(self, user, s, **extra):
        self.client.force_login(user)
        data = {"slot": s.pk, "topic": "Другое", "format": "Онлайн", "question": "Что меня ждёт?"}
        data.update(extra)
        return self.client.post(reverse("booking:book"), data)

    def test_booking_requires_login(self):
        resp = self.client.get(reverse("booking:book"))
        self.assertEqual(resp.status_code, 302)

    def test_book_free_slot(self):
        s = slot()
        resp = self.book(self.anna, s)
        self.assertRedirects(resp, reverse("accounts:cabinet"))
        b = Booking.objects.get()
        self.assertEqual((b.user, b.slot, b.status), (self.anna, s, Booking.Status.NEW))

    def test_taken_slot_cannot_be_booked_by_another_client(self):
        s = slot()
        self.book(self.anna, s)
        resp = self.book(self.boris, s)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "уже заняли")
        self.assertEqual(Booking.objects.count(), 1)

    def test_database_blocks_double_booking_but_allows_after_cancel(self):
        s = slot()
        first = Booking.objects.create(user=self.anna, slot=s)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Booking.objects.create(user=self.boris, slot=s)
        first.status = Booking.Status.CANCELLED
        first.save()
        Booking.objects.create(user=self.boris, slot=s)

    def test_slot_too_soon_is_not_offered(self):
        s = slot(hours=1)
        resp = self.book(self.anna, s)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Booking.objects.exists())

    def test_closed_slot_is_not_offered(self):
        s = slot()
        s.is_open = False
        s.save()
        self.book(self.anna, s)
        self.assertFalse(Booking.objects.exists())

    def test_limit_of_three_upcoming_bookings(self):
        for h in (30, 40, 50):
            self.book(self.anna, slot(h))
        resp = self.book(self.anna, slot(60))
        self.assertContains(resp, "три будущие записи")
        self.assertEqual(Booking.objects.count(), 3)

    def test_client_cannot_cancel_someone_elses_booking(self):
        b = Booking.objects.create(user=self.anna, slot=slot())
        self.client.force_login(self.boris)
        resp = self.client.post(reverse("booking:cancel", args=[b.pk]))
        self.assertEqual(resp.status_code, 404)
        b.refresh_from_db()
        self.assertEqual(b.status, Booking.Status.NEW)

    def test_client_cancels_own_booking_and_slot_frees_up(self):
        s = slot()
        b = Booking.objects.create(user=self.anna, slot=s)
        self.client.force_login(self.anna)
        self.client.post(reverse("booking:cancel", args=[b.pk]))
        b.refresh_from_db()
        self.assertEqual(b.status, Booking.Status.CANCELLED)
        self.assertRedirects(self.book(self.boris, s), reverse("accounts:cabinet"))

    def test_cabinet_shows_only_own_bookings(self):
        Booking.objects.create(user=self.anna, slot=slot(), question="секрет Анны")
        self.client.force_login(self.boris)
        resp = self.client.get(reverse("accounts:cabinet"))
        self.assertNotContains(resp, "секрет Анны")
        self.assertContains(resp, "Записей пока нет")
