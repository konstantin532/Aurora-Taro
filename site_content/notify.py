from django.conf import settings
from django.core.mail import send_mail

from .models import SiteProfile


def notify_owner(subject, body):
    to = SiteProfile.load().notify_email or settings.AURORA_NOTIFY_EMAIL
    if to:
        send_mail(subject, body, None, [to], fail_silently=True)
