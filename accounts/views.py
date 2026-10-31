import logging
from smtplib import SMTPException

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import url_has_allowed_host_and_scheme, urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.http import require_POST

from booking.models import Booking
from reviews.models import Review
from site_content.models import SiteProfile
from tarot.cards import TOTAL

from .forms import DeleteAccountForm, LoginForm, RegisterForm
from .models import User

BACKEND = "django.contrib.auth.backends.ModelBackend"
logger = logging.getLogger(__name__)


def send_activation(request, user):
    """Return sent, local, recent or failed without treating a connection error as registration failure."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    url = request.build_absolute_uri(reverse("accounts:activate", args=[uid, token]))
    brand = SiteProfile.load().brand
    body = render_to_string("accounts/email/activate.txt", {"user": user, "url": url, "brand": brand})
    local_mail = settings.EMAIL_BACKEND == "django.core.mail.backends.filebased.EmailBackend"
    key = f"activation-sent:{user.pk}"
    if not cache.add(key, True, 120):
        return "local" if local_mail else "recent"
    try:
        sent = send_mail(f"Подтвердите почту — {brand}", body, None, [user.email])
    except (SMTPException, OSError):
        cache.delete(key)
        logger.warning("Не удалось передать письмо подтверждения почтовому серверу")
        return "failed"
    if not sent:
        cache.delete(key)
        return "failed"
    return "local" if local_mail else "sent"


def register(request):
    if request.user.is_authenticated:
        return redirect("accounts:cabinet")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        delivery = send_activation(request, user)
        request.session["pending_email"] = user.email
        request.session["activation_delivery"] = delivery
        return redirect("accounts:check-email")
    return render(request, "accounts/register.html", {"form": form})


def check_email(request):
    return render(request, "accounts/check_email.html", {
        "email": request.session.get("pending_email", ""),
        "delivery": request.session.get("activation_delivery", ""),
    })


def _user_from_uid(uidb64):
    try:
        return User.objects.filter(pk=int(force_str(urlsafe_base64_decode(uidb64)))).first()
    except (TypeError, ValueError, OverflowError):
        return None


def activate(request, uidb64, token):
    # Ссылку подтверждаем кнопкой (POST): почтовые сканеры открывают ссылки сами и «съели» бы её.
    user = _user_from_uid(uidb64)
    valid = user is not None and default_token_generator.check_token(user, token)
    if request.method == "POST" and valid:
        user.is_active = True
        user.save(update_fields=["is_active"])
        login(request, user, backend=BACKEND)
        messages.success(request, "Почта подтверждена. Добро пожаловать в кабинет!")
        return redirect("accounts:cabinet")
    return render(request, "accounts/activate.html", {"valid": valid, "user_obj": user})


def login_view(request):
    if request.user.is_authenticated:
        return redirect("accounts:cabinet")
    form = LoginForm(request, request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            login(request, form.user, backend=BACKEND)
            nxt = request.POST.get("next") or request.GET.get("next")
            if nxt and url_has_allowed_host_and_scheme(nxt, {request.get_host()}, request.is_secure()):
                return redirect(nxt)
            return redirect("accounts:cabinet")
        if form.inactive_user:
            delivery = send_activation(request, form.inactive_user)
            request.session["pending_email"] = form.inactive_user.email
            request.session["activation_delivery"] = delivery
            delivery_message = {
                "local": "Отправка почты пока не настроена. Обратитесь к администратору сайта.",
                "sent": "Письмо со ссылкой отправлено ещё раз. Проверьте входящие и папку «Спам».",
                "recent": "Повторить отправку можно через две минуты.",
                "failed": "Не удалось отправить письмо. Попробуйте войти ещё раз чуть позже.",
            }[delivery]
            form.add_error(None, delivery_message)
    return render(request, "accounts/login.html", {"form": form, "next": request.GET.get("next", "")})


@require_POST
def logout_view(request):
    logout(request)
    return redirect("home")


@login_required
def cabinet(request):
    user = request.user
    now = timezone.now()
    bookings = user.bookings.select_related("slot", "service").order_by("-slot__start")
    upcoming = [b for b in bookings if b.slot.start >= now and b.status in Booking.ACTIVE]
    past = [b for b in bookings if b not in upcoming]
    collected = user.cards.count()
    return render(request, "accounts/cabinet.html", {
        "upcoming": sorted(upcoming, key=lambda b: b.slot.start),
        "past": past[:30],
        "spreads": user.spreads.all()[:12],
        "reviews": user.reviews.order_by("-created_at"),
        "collected": collected,
        "total": TOTAL,
        "percent": round(collected * 100 / TOTAL),
    })


@login_required
def delete_account(request):
    form = DeleteAccountForm(request.user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = request.user
        logout(request)
        for review in Review.objects.filter(user=user):
            review.delete()
        user.delete()
        messages.success(request, "Кабинет и все ваши данные удалены.")
        return redirect("home")
    return render(request, "accounts/delete.html", {"form": form})
