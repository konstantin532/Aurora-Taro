import mimetypes
import re

from django.http import FileResponse, HttpResponse, StreamingHttpResponse

from .validators import IMAGE_TYPES, VIDEO_TYPES

CHUNK = 512 * 1024
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _read_range(f, length):
    try:
        while length > 0:
            data = f.read(min(CHUNK, length))
            if not data:
                break
            length -= len(data)
            yield data
    finally:
        f.close()


def ranged_file_response(request, path):
    """Отдаёт файл с поддержкой Range: без неё видео нельзя перемотать."""
    content_type = VIDEO_TYPES.get(path.suffix.lower()) or IMAGE_TYPES.get(path.suffix.lower()) \
        or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    size = path.stat().st_size
    match = RANGE_RE.fullmatch(request.headers.get("Range", "").strip())
    if match and (match[1] or match[2]):
        if match[1]:
            start = int(match[1])
            end = int(match[2]) if match[2] else size - 1
        else:
            start, end = max(size - int(match[2]), 0), size - 1
        end = min(end, size - 1)
        if start >= size or start > end:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{size}"
            return resp
        f = path.open("rb")
        f.seek(start)
        resp = StreamingHttpResponse(_read_range(f, end - start + 1), status=206, content_type=content_type)
        resp["Content-Range"] = f"bytes {start}-{end}/{size}"
        resp["Content-Length"] = str(end - start + 1)
    else:
        resp = FileResponse(path.open("rb"), content_type=content_type)
    resp["Accept-Ranges"] = "bytes"
    resp["Content-Disposition"] = "inline"
    return resp
