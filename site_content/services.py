from django.templatetags.static import static

from .models import FaqItem, ProcessStep, Service


def site_json(profile):
    """Данные для книги на главной: то же, что раньше лежало в js/site-config.js."""
    return {
        "readerName": profile.reader_name,
        "brand": profile.brand,
        "city": profile.city,
        "formats": profile.format_list,
        "about": profile.about_paragraphs,
        "process": [{"title": s.title, "text": s.text} for s in ProcessStep.objects.all()],
        "services": [
            {"title": s.title, "desc": s.description, "duration": s.duration, "price": s.price}
            for s in Service.objects.filter(is_active=True)
        ],
        "topics": profile.topic_list,
        "faq": [{"q": f.question, "a": f.answer} for f in FaqItem.objects.all()],
        "contacts": {"telegram": profile.telegram, "whatsapp": profile.whatsapp, "email": profile.email},
        "static": static(""),
    }
