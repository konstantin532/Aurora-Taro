from itertools import groupby

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from site_content.models import SiteProfile
from site_content.notify import notify_owner

from .forms import BookingForm
from .models import Booking


@login_required
def book(request):
    profile = SiteProfile.load()
    form = BookingForm(request.POST or None, profile=profile, user=request.user)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        try:
            with transaction.atomic():
                booking = Booking.objects.create(
                    user=request.user, slot=d["slot"], service=d["service"], format=d.get("format") or "",
                    topic=d["topic"], question=d["question"],
                )
        except IntegrityError:
            form.add_error("slot", "Это время только что заняли. Выберите другое.")
        else:
            notify_owner(
                f"Новая запись: {booking.slot}",
                f"{request.user} записался(-ась) на {booking.slot}.\nТема: {booking.topic}\nФормат: {booking.format}\n"
                f"Вопрос: {booking.question or '—'}\n\nПодтвердите запись в мастерской: "
                + request.build_absolute_uri(reverse("admin:booking_booking_change", args=[booking.pk])),
            )
            messages.success(request, "Вы записаны! Я подтвержу время — статус появится в кабинете.")
            return redirect("accounts:cabinet")
    slots = list(form.fields["slot"].queryset)
    days = [(day, list(items)) for day, items in groupby(slots, key=lambda s: timezone.localtime(s.start).date())]
    return render(request, "booking/book.html", {"form": form, "days": days})


@login_required
@require_POST
def cancel(request, pk):
    booking = get_object_or_404(Booking, pk=pk, user=request.user)
    if booking.can_cancel:
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status"])
        notify_owner(f"Запись отменена: {booking.slot}", f"{request.user} отменил(а) запись на {booking.slot}.")
        messages.success(request, "Запись отменена. Это время снова свободно.")
    else:
        messages.error(request, "Эту запись уже нельзя отменить здесь — напишите тарологу.")
    return redirect("accounts:cabinet")
