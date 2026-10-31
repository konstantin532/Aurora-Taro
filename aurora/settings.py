"""Настройки сайта «Аврора · Таро».

Локально всё работает без настройки. На хостинге задайте переменные окружения:
AURORA_DEBUG=0, AURORA_SECRET_KEY, AURORA_ALLOWED_HOSTS, AURORA_CSRF_TRUSTED_ORIGINS,
AURORA_EMAIL_HOST / _PORT / _USER / _PASSWORD, AURORA_DEFAULT_FROM_EMAIL.
"""

import os
import secrets
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Локальные SMTP-настройки; переменные хостинга имеют приоритет, пароль не интерполируется.
load_dotenv(BASE_DIR / ".env", override=False, interpolate=False)
VAR_DIR = Path(os.environ.get("AURORA_VAR_DIR", BASE_DIR / "var"))
VAR_DIR.mkdir(parents=True, exist_ok=True)


def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("AURORA_DEBUG", True)


def _secret_key():
    key = os.environ.get("AURORA_SECRET_KEY")
    if key:
        return key
    if not DEBUG:
        raise ImproperlyConfigured("AURORA_SECRET_KEY is required when AURORA_DEBUG=0")
    path = VAR_DIR / "secret_key.txt"
    if not path.exists():
        path.write_text(secrets.token_urlsafe(50), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


SECRET_KEY = _secret_key()
ALLOWED_HOSTS = env_list("AURORA_ALLOWED_HOSTS", "127.0.0.1,localhost")
CSRF_TRUSTED_ORIGINS = env_list("AURORA_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "site_content",
    "tarot",
    "booking",
    "reviews",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "aurora.urls"
WSGI_APPLICATION = "aurora.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "site_content.context.site",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("AURORA_DB_PATH", VAR_DIR / "db.sqlite3"),
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "accounts:cabinet"
LOGOUT_REDIRECT_URL = "home"

LANGUAGE_CODE = "ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

# Видео не лежат в открытой папке: их отдаёт site_content.views.media_file после проверки прав.
MEDIA_ROOT = VAR_DIR / "media"
MEDIA_URL = "/media/"

AURORA_REVIEW_VIDEO_MAX_MB = 200
AURORA_STORY_VIDEO_MAX_MB = 1024
AURORA_MAX_REQUEST_MB = AURORA_STORY_VIDEO_MAX_MB + 20
FILE_UPLOAD_HANDLERS = [
    "aurora.uploads.RequestSizeLimitHandler",
    "django.core.files.uploadhandler.MemoryFileUploadHandler",
    "django.core.files.uploadhandler.TemporaryFileUploadHandler",
]

AURORA_ADMIN_PATH = os.environ.get("AURORA_ADMIN_PATH", "masterskaya/")
AURORA_NOTIFY_EMAIL = os.environ.get("AURORA_NOTIFY_EMAIL", "")

if os.environ.get("AURORA_EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["AURORA_EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("AURORA_EMAIL_PORT", "465"))
    EMAIL_HOST_USER = os.environ.get("AURORA_EMAIL_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("AURORA_EMAIL_PASSWORD", "")
    EMAIL_USE_SSL = EMAIL_PORT == 465
    EMAIL_USE_TLS = EMAIL_PORT == 587
else:
    # Без почтового сервера письма складываются файлами в var/sent-emails — их можно открыть Блокнотом.
    EMAIL_BACKEND = "django.core.mail.backends.filebased.EmailBackend"
    EMAIL_FILE_PATH = VAR_DIR / "sent-emails"
EMAIL_TIMEOUT = int(os.environ.get("AURORA_EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = (os.environ.get("AURORA_DEFAULT_FROM_EMAIL")
                      or os.environ.get("AURORA_EMAIL_USER")
                      or "Аврора · Таро <no-reply@localhost>")

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("AURORA_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
