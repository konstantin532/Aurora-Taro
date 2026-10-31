from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.urls import reverse

from site_content.notify import notify_owner

from .forms import ReviewForm
from .models import Review

MAX_PENDING = 3


@login_required
def new_review(request):
    pending = request.user.reviews.filter(status=Review.Status.PENDING).count()
    if pending >= MAX_PENDING:
        messages.info(request, "Ваши отзывы ещё на проверке. Новый можно будет отправить, когда я их посмотрю.")
        return redirect("accounts:cabinet")
    form = ReviewForm(request.POST or None, request.FILES or None,
                      initial={"display_name": request.user.display_name()})
    if request.method == "POST" and form.is_valid():
        review = form.save(commit=False)
        review.user = request.user
        review.save()
        notify_owner(
            "Новый отзыв на проверку",
            f"{review.display_name} прислал(а) отзыв{' с видео' if review.video else ''}.\n\nПосмотреть и опубликовать: "
            + request.build_absolute_uri(reverse("admin:reviews_review_change", args=[review.pk])),
        )
        messages.success(request, "Спасибо! Отзыв появится на сайте после проверки.")
        return redirect("accounts:cabinet")
    return render(request, "reviews/new.html", {"form": form})
