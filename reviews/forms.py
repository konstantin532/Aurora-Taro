from django import forms
from django.conf import settings

from .models import Review


class ReviewForm(forms.ModelForm):
    consent_publish = forms.BooleanField(
        required=True, label="Я согласна(-ен), чтобы отзыв и видео опубликовали на сайте",
        error_messages={"required": "Без согласия мы не сможем показать отзыв на сайте."},
    )

    class Meta:
        model = Review
        fields = ("display_name", "text", "video", "consent_publish")
        labels = {"display_name": "Подпись под отзывом", "text": "Ваш отзыв",
                  "video": "Видео (необязательно)"}
        help_texts = {"display_name": "Например «Ольга, Казань». Можно только имя."}
        widgets = {
            "text": forms.Textarea(attrs={"rows": 6, "maxlength": 3000}),
            "video": forms.ClearableFileInput(attrs={
                "accept": "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm",
                "data-max-mb": settings.AURORA_REVIEW_VIDEO_MAX_MB,
            }),
        }
