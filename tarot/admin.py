from django.contrib import admin

from .models import CollectedCard, Spread


@admin.register(CollectedCard)
class CollectedCardAdmin(admin.ModelAdmin):
    list_display = ("user", "__str__", "source", "first_at")
    list_filter = ("source",)
    search_fields = ("user__email", "user__first_name")
    autocomplete_fields = ("user",)


@admin.register(Spread)
class SpreadAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "__str__", "counted")
    search_fields = ("user__email",)
    readonly_fields = ("user", "cards", "counted", "created_at")

    def has_add_permission(self, request):
        return False
