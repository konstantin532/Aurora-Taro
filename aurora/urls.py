from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from site_content import views as site_views
from tarot import views as tarot_views

admin.site.site_header = "Аврора · Таро — мастерская"
admin.site.site_title = "Мастерская"
admin.site.index_title = "Что сделать сегодня?"

urlpatterns = [
    path("", site_views.home, name="home"),
    path("experience/", site_views.experience, name="experience"),
    path("privacy/", site_views.privacy, name="privacy"),
    path("media/<path:path>", site_views.media_file, name="media"),
    path("accounts/", include("accounts.urls")),
    path("booking/", include("booking.urls")),
    path("reviews/", include("reviews.urls")),
    path("collection/", tarot_views.collection, name="collection"),
    path("api/day/open/", tarot_views.api_day_open, name="api-day-open"),
    path("api/spread/", tarot_views.api_spread, name="api-spread"),
    path(settings.AURORA_ADMIN_PATH, admin.site.urls),
]
