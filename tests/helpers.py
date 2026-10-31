import shutil
import tempfile

from django.test import TestCase, override_settings

from accounts.models import User

MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 4000


class MediaTestCase(TestCase):
    """Каждый тест пишет загрузки во временную папку, а не в var/media."""

    def setUp(self):
        super().setUp()
        self._media = tempfile.mkdtemp(prefix="aurora-test-media-")
        self._override = override_settings(MEDIA_ROOT=self._media)
        self._override.enable()

    def tearDown(self):
        self._override.disable()
        shutil.rmtree(self._media, ignore_errors=True)
        super().tearDown()


def make_user(email="anna@example.com", password="Taro-secret-2026", **extra):
    extra.setdefault("first_name", email.split("@")[0].title())
    return User.objects.create_user(email=email, password=password, is_active=True, **extra)
