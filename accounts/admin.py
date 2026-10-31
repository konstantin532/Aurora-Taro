from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from .models import User


class UserCreation(AdminUserCreationForm):
    class Meta:
        model = User
        fields = ("email",)


class UserChange(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChange
    add_form = UserCreation
    ordering = ("-date_joined",)
    list_display = ("email", "first_name", "is_active", "is_staff", "date_joined")
    list_filter = ("is_active", "is_staff")
    search_fields = ("email", "first_name")
    readonly_fields = ("date_joined", "last_login", "consent_at")
    fieldsets = (
        (None, {"fields": ("email", "first_name", "password")}),
        ("Согласие и даты", {"fields": ("consent_at", "date_joined", "last_login")}),
        ("Права", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)
