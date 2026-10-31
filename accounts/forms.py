import hashlib

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import BaseUserCreationForm
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import User

MAX_FAILS = 8
LOCK_SECONDS = 15 * 60


class RegisterForm(BaseUserCreationForm):
    adult = forms.BooleanField(label="Мне исполнилось 18 лет", required=True,
                               error_messages={"required": "Консультации — только для взрослых."})
    consent = forms.BooleanField(label="Я согласна(-ен) на обработку персональных данных", required=True,
                                 error_messages={"required": "Без согласия мы не можем создать кабинет."})

    class Meta:
        model = User
        fields = ("first_name", "email")
        labels = {"first_name": "Как к вам обращаться", "email": "Почта"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["first_name"].required = True
        self.fields["first_name"].widget.attrs.update(autocomplete="given-name", maxlength=60)
        self.fields["email"].widget.attrs.update(autocomplete="email")
        self.fields["password1"].label = "Пароль"
        self.fields["password1"].help_text = "Не короче 8 знаков, не только цифры и не слишком простой, вроде 12345678."
        self.fields["password2"].help_text = ""
        self.fields["password2"].label = "Пароль ещё раз"

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("Эта почта уже зарегистрирована. Войдите или восстановите пароль.")
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_active = False
        user.consent_at = timezone.now()
        if commit:
            user.save()
        return user


def _client_ip(request):
    return request.META.get("REMOTE_ADDR", "") if request else ""


class LoginForm(forms.Form):
    email = forms.EmailField(label="Почта", widget=forms.EmailInput(attrs={"autocomplete": "email"}))
    password = forms.CharField(label="Пароль", strip=False, widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}))

    def __init__(self, request=None, *args, **kwargs):
        self.request = request
        self.user = None
        self.inactive_user = None
        super().__init__(*args, **kwargs)

    def _key(self, email):
        return "login-fail:" + hashlib.sha256(f"{_client_ip(self.request)}|{email}".encode()).hexdigest()

    def clean(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        password = self.cleaned_data.get("password")
        if not email or not password:
            return self.cleaned_data
        key = self._key(email)
        fails = cache.get(key, 0)
        if fails >= MAX_FAILS:
            raise ValidationError("Слишком много попыток входа. Подождите 15 минут и попробуйте снова.")
        user = authenticate(self.request, email=email, password=password)
        if user is None:
            waiting = User.objects.filter(email__iexact=email, is_active=False, last_login__isnull=True).first()
            if waiting and waiting.check_password(password):
                self.inactive_user = waiting
                raise ValidationError("Почта ещё не подтверждена.")
            cache.set(key, fails + 1, LOCK_SECONDS)
            raise ValidationError("Неверная почта или пароль.")
        cache.delete(key)
        self.user = user
        return self.cleaned_data


class DeleteAccountForm(forms.Form):
    password = forms.CharField(label="Пароль для подтверждения", strip=False,
                               widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}))

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_password(self):
        password = self.cleaned_data["password"]
        if not self.user.check_password(password):
            raise ValidationError("Пароль не подходит.")
        return password
