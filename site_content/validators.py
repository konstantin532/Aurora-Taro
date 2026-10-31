from pathlib import Path

from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

VIDEO_TYPES = {".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm"}
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def _head(f, n=16):
    pos = f.tell() if hasattr(f, "tell") else 0
    f.seek(0)
    data = f.read(n)
    f.seek(pos)
    return data


@deconstructible
class VideoValidator:
    """Пускает только MP4, MOV и WebM разумного размера — по расширению и по первым байтам файла."""

    def __init__(self, max_mb):
        self.max_mb = max_mb

    def __call__(self, f):
        ext = Path(f.name).suffix.lower()
        if ext not in VIDEO_TYPES:
            raise ValidationError("Подходят видео в форматах MP4, MOV или WebM.")
        if f.size > self.max_mb * 1024 * 1024:
            raise ValidationError(f"Видео слишком большое: можно до {self.max_mb} МБ.")
        head = _head(f)
        is_iso = head[4:8] == b"ftyp"
        is_webm = head[:4] == b"\x1a\x45\xdf\xa3"
        if not (is_iso if ext != ".webm" else is_webm):
            raise ValidationError("Файл не похож на видео. Выберите другой файл.")

    def __eq__(self, other):
        return isinstance(other, VideoValidator) and other.max_mb == self.max_mb


def validate_image(f):
    ext = Path(f.name).suffix.lower()
    if ext not in IMAGE_TYPES:
        raise ValidationError("Подходят картинки JPG, PNG или WebP.")
    if f.size > 15 * 1024 * 1024:
        raise ValidationError("Картинка слишком большая: можно до 15 МБ.")
    head = _head(f)
    ok = head[:3] == b"\xff\xd8\xff" or head[:8] == b"\x89PNG\r\n\x1a\n" or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")
    if not ok:
        raise ValidationError("Файл не похож на картинку.")
