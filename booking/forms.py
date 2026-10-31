from datetime import timedelta

from django import forms
from django.utils import timezone

from site_content.models import Service

from .models import Booking, Slot

LEAD_TIME = timedelta(hours=2)
MAX_ACTIVE_PER_USER = 3


def available_slots():
    return Slot.objects.filter(is_open=True, start__gte=timezone.now() + LEAD_TIME) \
        .exclude(bookings__status__in=Booking.ACTIVE).order_by("start")


class BookingForm(forms.Form):
    slot = forms.ModelChoiceField(queryset=Slot.objects.none(), widget=forms.RadioSelect, label="Время",
                                  error_messages={"required": "Выберите время.",
                                                  "invalid_choice": "Это время уже заняли. Выберите другое."})
    service = forms.ModelChoiceField(queryset=Service.objects.none(), required=False, label="Консультация",
                                     empty_label="Ещё не решила(-л) — подскажите")
    format = forms.ChoiceField(label="Формат", widget=forms.RadioSelect, required=False)
    topic = forms.ChoiceField(label="Тема")
    question = forms.CharField(label="Ваш вопрос", required=False, max_length=2000,
                               widget=forms.Textarea(attrs={"rows": 4}))

    def __init__(self, *args, profile, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        self.fields["slot"].queryset = available_slots()
        self.fields["service"].queryset = Service.objects.filter(is_active=True)
        self.fields["format"].choices = [(f, f) for f in profile.format_list]
        if profile.format_list:
            self.fields["format"].initial = profile.format_list[0]
        self.fields["topic"].choices = [(t, t) for t in profile.topic_list]

    def clean(self):
        active = Booking.objects.filter(user=self.user, status__in=(Booking.Status.NEW, Booking.Status.CONFIRMED),
                                        slot__start__gte=timezone.now()).count()
        if active >= MAX_ACTIVE_PER_USER:
            raise forms.ValidationError("У вас уже три будущие записи. Чтобы добавить ещё, отмените одну из них в кабинете.")
        return self.cleaned_data
