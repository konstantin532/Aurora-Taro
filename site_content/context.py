from .models import SiteProfile


def site(request):
    return {"site": SiteProfile.load()}
