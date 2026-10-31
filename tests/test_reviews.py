from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.urls import reverse

from reviews.models import Review
from site_content.validators import VideoValidator

from .helpers import MP4, MediaTestCase, make_user


def video(name="clip.mp4", data=MP4):
    return SimpleUploadedFile(name, data, content_type="video/mp4")


class ReviewTests(MediaTestCase):
    def setUp(self):
        super().setUp()
        self.anna = make_user("anna@example.com")
        self.boris = make_user("boris@example.com")
        self.mom = make_user("mom@example.com", is_staff=True)

    def send(self, user, **extra):
        self.client.force_login(user)
        data = {"display_name": "Анна, Казань", "text": "Всё сбылось!", "consent_publish": "on", "video": video()}
        data.update(extra)
        return self.client.post(reverse("reviews:new"), data)

    def test_review_with_video_waits_for_moderation(self):
        resp = self.send(self.anna)
        self.assertRedirects(resp, reverse("accounts:cabinet"))
        r = Review.objects.get()
        self.assertEqual(r.status, Review.Status.PENDING)
        self.assertTrue(r.video.name.startswith("reviews/"))
        self.assertNotIn("clip", r.video.name)
        self.client.logout()
        self.assertNotContains(self.client.get(reverse("experience")), "Всё сбылось")

    def test_pending_video_is_private(self):
        self.send(self.anna)
        url = reverse("media", args=[Review.objects.get().video.name])
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_login(self.boris)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_login(self.anna)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.client.force_login(self.mom)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Cache-Control"], "private, no-store")

    def test_approved_video_is_public_and_seekable(self):
        self.send(self.anna)
        r = Review.objects.get()
        r.status = Review.Status.APPROVED
        r.save()
        self.client.logout()
        url = reverse("media", args=[r.video.name])
        resp = self.client.get(url, headers={"Range": "bytes=4-11"})
        self.assertEqual(resp.status_code, 206)
        self.assertEqual(b"".join(resp.streaming_content), MP4[4:12])
        self.assertEqual(resp["Content-Range"], f"bytes 4-11/{len(MP4)}")
        self.assertEqual(resp["Content-Type"], "video/mp4")
        self.assertContains(self.client.get(reverse("experience")), "Всё сбылось")

    def test_without_consent_review_is_not_accepted(self):
        resp = self.send(self.anna, consent_publish="")
        self.assertContains(resp, "Без согласия")
        self.assertFalse(Review.objects.exists())

    def test_fake_or_wrong_files_are_rejected(self):
        for name, data in [("clip.mp4", b"MZ this is a program, not a video" * 10), ("clip.exe", MP4), ("clip.mp4.html", MP4)]:
            resp = self.send(self.anna, video=video(name, data))
            self.assertEqual(resp.status_code, 200, name)
        self.assertFalse(Review.objects.exists())

    def test_size_limit(self):
        with self.assertRaisesMessage(ValidationError, "до 1 МБ"):
            VideoValidator(1)(video(data=MP4 + b"\x00" * (1024 * 1024)))

    def test_traversal_outside_media_is_refused(self):
        self.client.force_login(self.mom)
        for path in ["reviews/../../aurora/settings.py", "var/secret_key.txt", "stories/../reviews/x.mp4"]:
            self.assertEqual(self.client.get("/media/" + path).status_code, 404, path)

    def test_admin_action_publishes_only_with_consent(self):
        r1 = Review.objects.create(user=self.anna, display_name="А", text="да", consent_publish=True)
        r2 = Review.objects.create(user=self.boris, display_name="Б", text="нет", consent_publish=False)
        self.mom.is_superuser = True
        self.mom.save()
        self.client.force_login(self.mom)
        self.client.post(reverse("admin:reviews_review_changelist"),
                         {"action": "approve", "_selected_action": [r1.pk, r2.pk]})
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual(r1.status, Review.Status.APPROVED)
        self.assertEqual(r2.status, Review.Status.PENDING)

    def test_three_pending_reviews_limit(self):
        for i in range(3):
            Review.objects.create(user=self.anna, display_name="А", text=str(i), consent_publish=True)
        resp = self.send(self.anna)
        self.assertRedirects(resp, reverse("accounts:cabinet"))
        self.assertEqual(Review.objects.count(), 3)
