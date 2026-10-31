from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import FaqItem, ProcessStep, Service, SiteProfile, Story


@admin.register(SiteProfile)
class SiteProfileAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Титул", {"fields": ("reader_name", "brand", "city", "formats")}),
        ("О себе", {"fields": ("about",)}),
        ("Запись", {"fields": ("topics",)}),
        ("Контакты на сайте", {"fields": ("telegram", "whatsapp", "email")}),
        ("Уведомления", {"fields": ("notify_email",)}),
    )

    def has_add_permission(self, request):
        return not SiteProfile.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "duration", "price", "is_active", "order")
    list_editable = ("price", "is_active", "order")


@admin.register(ProcessStep)
class ProcessStepAdmin(admin.ModelAdmin):
    list_display = ("title", "order")
    list_editable = ("order",)


@admin.register(FaqItem)
class FaqItemAdmin(admin.ModelAdmin):
    list_display = ("question", "order")
    list_editable = ("order",)


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ("title", "happened_on", "has_video", "is_published", "order")
    list_editable = ("is_published", "order")
    list_filter = ("is_published",)
    readonly_fields = ("preview",)
    fields = ("title", "text", "happened_on", "video", "poster", "preview", "is_published", "order")

    @admin.display(boolean=True, description="видео")
    def has_video(self, obj):
        return bool(obj.video)

    @admin.display(description="как выглядит")
    def preview(self, obj):
        if not obj.video:
            return "—"
        return format_html('<video src="{}" controls preload="metadata" style="max-width:420px;width:100%"></video>',
                           reverse("media", args=[obj.video.name]))
