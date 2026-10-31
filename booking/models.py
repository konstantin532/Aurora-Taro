from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone, formats


class Slot(models.Model):
    start = models.DateTimeField("начало", unique=True)
    duration_minutes = models.PositiveSmallIntegerField("длительность, минут", default=60)
    is_open = models.BooleanField("открыто для записи", default=True)
    note = models.CharField("заметка", max_length=120, blank=True, help_text="Видна клиенту, например «только онлайн».")

    class Meta:
        verbose_name = "окно для записи"
        verbose_name_plural = "окна для записи"
        ordering = ["start"]

    def __str__(self):
        return formats.date_format(timezone.localtime(self.start), "j E, l, H:i")

    @property
    def end(self):
        return self.start + timedelta(minutes=self.duration_minutes)

    def active_booking(self):
        return self.bookings.filter(status__in=Booking.ACTIVE).select_related("user").first()


class Booking(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "ждёт подтверждения"
        CONFIRMED = "confirmed", "подтверждена"
        DONE = "done", "состоялась"
        CANCELLED = "cancelled", "отменена"

    ACTIVE = (Status.NEW, Status.CONFIRMED, Status.DONE)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings", verbose_name="клиент")
    slot = models.ForeignKey(Slot, on_delete=models.PROTECT, related_name="bookings", verbose_name="время")
    service = models.ForeignKey("site_content.Service", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="услуга")
    format = models.CharField("формат", max_length=40, blank=True)
    topic = models.CharField("тема", max_length=80, blank=True)
    question = models.TextField("вопрос клиента", blank=True, max_length=2000)
    status = models.CharField("статус", max_length=10, choices=Status.choices, default=Status.NEW)
    result_note = models.TextField("заметка для клиента", blank=True,
                                   help_text="Клиент увидит её в кабинете: например, конспект расклада.")
    created_at = models.DateTimeField("создана", auto_now_add=True)

    class Meta:
        verbose_name = "запись"
        verbose_name_plural = "записи на консультацию"
        ordering = ["-slot__start"]
        constraints = [
            models.UniqueConstraint(fields=["slot"], condition=~Q(status="cancelled"), name="booking_one_active_per_slot"),
        ]

    def __str__(self):
        return f"{self.slot} — {self.user}"

    @property
    def can_cancel(self):
        return self.status in (self.Status.NEW, self.Status.CONFIRMED) and self.slot.start > timezone.now()
