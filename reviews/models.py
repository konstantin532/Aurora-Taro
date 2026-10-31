import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from site_content.models import delete_file, replace_files
from site_content.validators import VideoValidator


def review_upload(instance, filename):
    return f"reviews/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "ждёт проверки"
        APPROVED = "approved", "опубликован"
        REJECTED = "rejected", "не опубликован"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews", verbose_name="клиент")
    display_name = models.CharField("подпись", max_length=80, help_text="Как подписать отзыв на сайте.")
    text = models.TextField("отзыв", max_length=3000)
    video = models.FileField("видео", upload_to=review_upload, blank=True,
                             validators=[VideoValidator(settings.AURORA_REVIEW_VIDEO_MAX_MB)])
    consent_publish = models.BooleanField("согласие на публикацию", default=False)
    status = models.CharField("статус", max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField("прислан", auto_now_add=True)
    moderated_at = models.DateTimeField("проверен", null=True, blank=True)

    class Meta:
        verbose_name = "отзыв"
        verbose_name_plural = "отзывы клиентов"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.display_name}: {self.text[:40]}"


@receiver(pre_save, sender=Review)
def _review_replace(sender, instance, **kwargs):
    replace_files(Review, instance, "video")


@receiver(post_delete, sender=Review)
def _review_delete(sender, instance, **kwargs):
    delete_file(instance.video)
