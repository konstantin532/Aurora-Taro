import re

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from accounts.models import User
from reviews.models import Review

from .helpers import MP4, MediaTestCase, make_user

PASSWORD = "Taro-secret-2026"


def register(client, **overrides):
    data = {"first_name": "Ольга", "email": "Olga@Example.com", "password1": PASSWORD, "password2": PASSWORD,
            "adult": "on", "consent": "on"}
    data.update(overrides)
    return client.post(reverse("accounts:register"), data)


class RegistrationTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_register_creates_inactive_user_and_sends_link(self):
        resp = register(self.client)
        self.assertRedirects(resp, reverse("accounts:check-email"))
        user = User.objects.get()
        self.assertEqual(user.email, "olga@example.com")
        self.assertFalse(user.is_active)
        self.assertIsNotNone(user.consent_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/accounts/activate/", mail.outbox[0].body)

    def test_consent_and_age_are_required(self):
        resp = register(self.client, consent="", adult="")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(User.objects.exists())
        self.assertContains(resp, "Без согласия")
        self.assertContains(resp, "только для взрослых")

    def test_duplicate_email_is_case_insensitive(self):
        make_user("olga@example.com")
        resp = register(self.client, email="OLGA@example.com")
        self.assertContains(resp, "уже зарегистрирована")
        self.assertEqual(User.objects.count(), 1)

    def test_activation_needs_post_and_works_once(self):
        register(self.client)
        link = re.search(r"https?://[^/]+(/accounts/activate/\S+)", mail.outbox[0].body)[1]
        # Почтовый сканер открывает ссылку GET-запросом: кабинет от этого не активируется.
        self.client.get(link)
        self.assertFalse(User.objects.get().is_active)
        resp = self.client.post(link)
        self.assertRedirects(resp, reverse("accounts:cabinet"))
        self.assertTrue(User.objects.get().is_active)
        self.client.logout()
        resp = self.client.post(link)
        self.assertContains(resp, "больше не работает")

    def test_login_with_unconfirmed_email_resends_link(self):
        register(self.client)
        cache.clear()
        resp = self.client.post(reverse("accounts:login"), {"email": "olga@example.com", "password": PASSWORD})
        self.assertContains(resp, "ещё не подтверждена")
        self.assertEqual(len(mail.outbox), 2)

    def test_login_locks_after_many_failures(self):
        make_user("anna@example.com", password=PASSWORD)
        for _ in range(8):
            self.client.post(reverse("accounts:login"), {"email": "anna@example.com", "password": "wrong-pass"})
        resp = self.client.post(reverse("accounts:login"), {"email": "anna@example.com", "password": PASSWORD})
        self.assertContains(resp, "Слишком много попыток")
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_ignores_external_next(self):
        make_user("anna@example.com", password=PASSWORD)
        resp = self.client.post(reverse("accounts:login") + "?next=https://evil.example/",
                                {"email": "anna@example.com", "password": PASSWORD, "next": "https://evil.example/"})
        self.assertRedirects(resp, reverse("accounts:cabinet"))

    def test_cabinet_requires_login(self):
        resp = self.client.get(reverse("accounts:cabinet"))
        self.assertEqual(resp.status_code, 302)
        self.assertIn(reverse("accounts:login"), resp["Location"])


class DeleteAccountTests(MediaTestCase):
    def test_delete_removes_user_and_video_files(self):
        user = make_user()
        review = Review.objects.create(user=user, display_name="Анна", text="Спасибо", consent_publish=True,
                                       video=SimpleUploadedFile("v.mp4", MP4, content_type="video/mp4"))
        path = review.video.path
        self.client.force_login(user)
        resp = self.client.post(reverse("accounts:delete"), {"password": "wrong"})
        self.assertContains(resp, "Пароль не подходит")
        resp = self.client.post(reverse("accounts:delete"), {"password": PASSWORD})
        self.assertRedirects(resp, reverse("home"))
        self.assertFalse(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(Review.objects.exists())
        import os
        self.assertFalse(os.path.exists(path))


class ActivationDeliveryTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_registration_survives_email_server_failure(self):
        from smtplib import SMTPException
        from unittest.mock import patch

        with patch('accounts.views.send_mail', side_effect=SMTPException('server unavailable')):
            response = register(self.client)
        self.assertEqual(response.status_code, 302)
        self.assertFalse(User.objects.get().is_active)
        page = self.client.get(response['Location'])
        self.assertContains(page, 'Не удалось отправить письмо')
        self.assertNotContains(page, 'Мы отправили письмо')
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_failed_email_can_be_retried_without_waiting(self):
        from smtplib import SMTPException
        from unittest.mock import patch

        with patch('accounts.views.send_mail', side_effect=[SMTPException('server unavailable'), 1]):
            register(self.client)
            response = self.client.post(reverse('accounts:login'), {'email': 'olga@example.com', 'password': PASSWORD})
        self.assertContains(response, 'Письмо со ссылкой отправлено ещё раз')
        self.assertNotContains(response, 'Повторить отправку можно')
        self.assertFalse(User.objects.get().is_active)
        page = self.client.get(reverse('accounts:check-email'))
        self.assertContains(page, 'Мы отправили письмо')
        self.assertNotContains(page, 'Не удалось отправить письмо')

    def test_zero_sent_messages_is_reported_as_failure(self):
        from unittest.mock import patch

        with patch('accounts.views.send_mail', return_value=0):
            response = register(self.client)
        self.assertContains(self.client.get(response['Location']), 'Не удалось отправить письмо')
        self.assertFalse(User.objects.get().is_active)

    def test_cooldown_does_not_claim_another_email_was_sent(self):
        register(self.client)
        response = self.client.post(reverse('accounts:login'), {'email': 'olga@example.com', 'password': PASSWORD})
        self.assertEqual(len(mail.outbox), 1)
        self.assertContains(response, 'Повторить отправку можно через две минуты')
        self.assertNotContains(response, 'Мы отправили письмо со ссылкой ещё раз')


class LocalMailNoticeTests(TestCase):
    def test_file_mail_is_not_described_as_real_delivery(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from django.test import override_settings

        cache.clear()
        with TemporaryDirectory() as directory:
            with override_settings(EMAIL_BACKEND='django.core.mail.backends.filebased.EmailBackend', EMAIL_FILE_PATH=directory):
                response = register(self.client)
                page = self.client.get(response['Location'])
                self.assertContains(page, 'Отправка почты пока не настроена')
                self.assertNotContains(page, 'Мы отправили письмо')
                self.assertEqual(len(list(Path(directory).iterdir())), 1)
        self.assertFalse(User.objects.get().is_active)
