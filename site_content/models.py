import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .validators import VideoValidator, validate_image


def lines(text):
    return [line.strip() for line in (text or "").splitlines() if line.strip()]


class SiteProfile(models.Model):
    reader_name = models.CharField("имя таролога на титуле", max_length=60, default="Аврора")
    brand = models.CharField("название в шапке", max_length=60, default="Аврора · Таро")
    city = models.CharField("город", max_length=60, blank=True)
    about = models.TextField("глава «О тарологе»", help_text="Абзацы разделяйте пустой строкой.", blank=True)
    formats = models.CharField("форматы встречи", max_length=120, default="Онлайн, Лично", help_text="Через запятую.")
    topics = models.TextField("темы для записи", default="Отношения и любовь\nРабота и деньги\nВыбор и перемены\nДругое",
                              help_text="Каждая тема с новой строки.")
    telegram = models.CharField("Telegram", max_length=60, blank=True, help_text="Ник без @.")
    whatsapp = models.CharField("WhatsApp", max_length=30, blank=True, help_text="Номер только цифрами, например 79001234567.")
    email = models.EmailField("почта для клиентов", blank=True)
    notify_email = models.EmailField("почта для уведомлений", blank=True,
                                     help_text="Сюда приходят письма о новых записях и отзывах.")

    class Meta:
        verbose_name = "профиль сайта"
        verbose_name_plural = "профиль сайта"

    def __str__(self):
        return "Профиль сайта"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def format_list(self):
        return [f.strip() for f in self.formats.split(",") if f.strip()]

    @property
    def topic_list(self):
        return lines(self.topics) or ["Другое"]

    @property
    def about_paragraphs(self):
        return [p.strip() for p in self.about.replace("\r\n", "\n").split("\n\n") if p.strip()]


class Ordered(models.Model):
    order = models.PositiveSmallIntegerField("порядок", default=0)

    class Meta:
        abstract = True
        ordering = ["order", "id"]


class ProcessStep(Ordered):
    title = models.CharField("шаг", max_length=80)
    text = models.TextField("описание")

    class Meta(Ordered.Meta):
        verbose_name = "шаг консультации"
        verbose_name_plural = "как проходит консультация"

    def __str__(self):
        return self.title


class Service(Ordered):
    title = models.CharField("название", max_length=100)
    description = models.CharField("описание", max_length=200, blank=True)
    duration = models.CharField("длительность", max_length=40, blank=True)
    price = models.CharField("цена", max_length=40, blank=True, help_text="Например «1 500 ₽». Пусто — «по запросу».")
    is_active = models.BooleanField("показывать", default=True)

    class Meta(Ordered.Meta):
        verbose_name = "услуга"
        verbose_name_plural = "услуги и цены"

    def __str__(self):
        return self.title


class FaqItem(Ordered):
    question = models.CharField("вопрос", max_length=200)
    answer = models.TextField("ответ")

    class Meta(Ordered.Meta):
        verbose_name = "вопрос"
        verbose_name_plural = "вопросы и ответы"

    def __str__(self):
        return self.question


def story_upload(instance, filename):
    return f"stories/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class Story(Ordered):
    title = models.CharField("заголовок", max_length=120)
    text = models.TextField("рассказ", blank=True)
    video = models.FileField("видео", upload_to=story_upload, blank=True,
                             validators=[VideoValidator(settings.AURORA_STORY_VIDEO_MAX_MB)],
                             help_text="MP4, MOV или WebM.")
    poster = models.FileField("обложка видео", upload_to=story_upload, blank=True, validators=[validate_image],
                              help_text="Картинка, которая видна до запуска видео. Необязательно.")
    happened_on = models.DateField("когда", null=True, blank=True)
    is_published = models.BooleanField("опубликовано", default=False)
    created_at = models.DateTimeField("добавлено", auto_now_add=True)

    class Meta(Ordered.Meta):
        verbose_name = "история из практики"
        verbose_name_plural = "опыт: истории и видео"

    def __str__(self):
        return self.title


def delete_file(field_file):
    if field_file and field_file.name:
        field_file.storage.delete(field_file.name)


def replace_files(model, instance, *fields):
    """Удаляет старый файл с диска, когда в админке загрузили новый или очистили поле."""
    if not instance.pk:
        return
    old = model.objects.filter(pk=instance.pk).first()
    if not old:
        return
    for name in fields:
        before, after = getattr(old, name), getattr(instance, name)
        if before and before.name != (after.name if after else None):
            delete_file(before)


@receiver(pre_save, sender=Story)
def _story_replace(sender, instance, **kwargs):
    replace_files(Story, instance, "video", "poster")


@receiver(post_delete, sender=Story)
def _story_delete(sender, instance, **kwargs):
    delete_file(instance.video)
    delete_file(instance.poster)
