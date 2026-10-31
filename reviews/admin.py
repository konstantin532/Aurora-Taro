from django.contrib import admin, messages
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("created_at", "display_name", "short_text", "has_video", "consent_publish", "status")
    list_filter = ("status",)
    search_fields = ("display_name", "text", "user__email")
    readonly_fields = ("user", "consent_publish", "created_at", "moderated_at", "preview")
    fields = ("user", "display_name", "text", "video", "preview", "consent_publish", "status", "created_at", "moderated_at")
    actions = ("approve", "reject")

    @admin.display(description="отзыв")
    def short_text(self, obj):
        return obj.text[:80] + ("…" if len(obj.text) > 80 else "")

    @admin.display(boolean=True, description="видео")
    def has_video(self, obj):
        return bool(obj.video)

    @admin.display(description="посмотреть видео")
    def preview(self, obj):
        if not obj.video:
            return "—"
        return format_html('<video src="{}" controls preload="metadata" style="max-width:420px;width:100%"></video>',
                           reverse("media", args=[obj.video.name]))

    def save_model(self, request, obj, form, change):
        if obj.status == Review.Status.APPROVED and not obj.consent_publish:
            obj.status = Review.Status.PENDING
            messages.warning(request, "Без согласия клиента отзыв публиковать нельзя.")
        if "status" in form.changed_data:
            obj.moderated_at = timezone.now()
        super().save_model(request, obj, form, change)

    @admin.action(description="Опубликовать")
    def approve(self, request, queryset):
        n = queryset.filter(consent_publish=True).update(status=Review.Status.APPROVED, moderated_at=timezone.now())
        self.message_user(request, f"Опубликовано отзывов: {n}.", messages.SUCCESS)

    @admin.action(description="Не публиковать")
    def reject(self, request, queryset):
        queryset.update(status=Review.Status.REJECTED, moderated_at=timezone.now())
