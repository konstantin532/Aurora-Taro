import json

from django.test import TestCase
from django.urls import reverse

from site_content.models import Service, SiteProfile

from .helpers import make_user


class PageTests(TestCase):
    def test_home_passes_site_data_from_admin(self):
        profile = SiteProfile.load()
        profile.reader_name = "Мирослава"
        profile.telegram = "miro_tarot"
        profile.save()
        Service.objects.create(title="Тестовый расклад", price="999 ₽", order=99)
        resp = self.client.get(reverse("home"))
        self.assertEqual(resp.status_code, 200)
        site = json.loads(resp.context["site_data"] and json.dumps(resp.context["site_data"]))
        self.assertEqual(site["readerName"], "Мирослава")
        self.assertIn("Тестовый расклад", [s["title"] for s in site["services"]])
        self.assertContains(resp, 'id="site-data"')
        self.assertContains(resp, 'id="server-data"')

    def test_seeded_content_exists(self):
        self.assertTrue(Service.objects.exists())
        self.assertIn("Райдер–Уэйт", SiteProfile.load().about)

    def test_public_pages(self):
        for name in ("home", "experience", "privacy", "accounts:login", "accounts:register", "accounts:password-reset"):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

    def test_header_shows_cabinet_when_logged_in(self):
        self.client.force_login(make_user())
        self.assertContains(self.client.get(reverse("experience")), "Кабинет")

    def test_admin_is_at_custom_path_and_needs_staff(self):
        self.assertEqual(self.client.get("/admin/").status_code, 404)
        resp = self.client.get("/masterskaya/")
        self.assertEqual(resp.status_code, 302)
        self.client.force_login(make_user())
        self.assertEqual(self.client.get("/masterskaya/").status_code, 302)

    def test_text_is_escaped(self):
        profile = SiteProfile.load()
        profile.brand = "<script>alert(1)</script>"
        profile.save()
        resp = self.client.get(reverse("experience"))
        self.assertNotContains(resp, "<script>alert(1)</script>")
        self.assertNotContains(self.client.get(reverse("home")), "<script>alert(1)</script>")
