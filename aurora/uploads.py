from django.conf import settings
from django.core.files.uploadhandler import FileUploadHandler, StopUpload


class RequestSizeLimitHandler(FileUploadHandler):
    """Обрывает загрузку слишком большого запроса до того, как он попадёт на диск."""

    def handle_raw_input(self, input_data, META, content_length, boundary, encoding=None):
        if content_length and content_length > settings.AURORA_MAX_REQUEST_MB * 1024 * 1024:
            raise StopUpload(connection_reset=True)

    def receive_data_chunk(self, raw_data, start):
        return raw_data

    def file_complete(self, file_size):
        return None
