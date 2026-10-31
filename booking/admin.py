from datetime import timedelta

from django.contrib import admin, messages

from .models import Booking, Slot


@admin.register(Slot)
class SlotAdmin(admin.ModelAdmin):
    list_display = ("__str__", "duration_minutes", "is_open", "booked_by", "note")
    list_filter = ("is_open",)
    date_hierarchy = "start"
    actions = ("copy_next_week", "close_slots", "open_slots")

    @admin.display(description="кто записан")
    def booked_by(self, obj):
        booking = obj.active_booking()
        return str(booking.user) if booking else "свободно"

    @admin.action(description="Повторить выбранные окна через неделю")
    def copy_next_week(self, request, queryset):
        made = 0
        for slot in queryset:
            _, created = Slot.objects.get_or_create(
                start=slot.start + timedelta(days=7),
                defaults={"duration_minutes": slot.duration_minutes, "note": slot.note},
            )
            made += created
        self.message_user(request, f"Добавлено окон: {made}.", messages.SUCCESS)

    @admin.action(description="Закрыть для записи")
    def close_slots(self, request, queryset):
        queryset.update(is_open=False)

    @admin.action(description="Открыть для записи")
    def open_slots(self, request, queryset):
        queryset.update(is_open=True)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("slot", "user", "service", "topic", "status")
    list_filter = ("status",)
    search_fields = ("user__email", "user__first_name", "question")
    readonly_fields = ("user", "created_at")
    list_select_related = ("slot", "user", "service")
    actions = ("mark_confirmed", "mark_done", "mark_cancelled")
    fields = ("user", "slot", "service", "format", "topic", "question", "status", "result_note", "created_at")

    @admin.action(description="Подтвердить")
    def mark_confirmed(self, request, queryset):
        queryset.update(status=Booking.Status.CONFIRMED)

    @admin.action(description="Отметить «состоялась»")
    def mark_done(self, request, queryset):
        queryset.update(status=Booking.Status.DONE)

    @admin.action(description="Отменить")
    def mark_cancelled(self, request, queryset):
        queryset.update(status=Booking.Status.CANCELLED)
