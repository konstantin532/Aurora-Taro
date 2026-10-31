@echo off
rem Запуск сайта на этом компьютере: двойной щелчок по файлу.
cd /d "%~dp0"
uv run python manage.py migrate --noinput
start "" http://127.0.0.1:8000/
uv run python manage.py runserver 127.0.0.1:8000
