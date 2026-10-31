from django.urls import path

from . import views

app_name = "booking"

urlpatterns = [
    path("", views.book, name="book"),
    path("<int:pk>/cancel/", views.cancel, name="cancel"),
]
