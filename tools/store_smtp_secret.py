"""Write an SMTP password from stdin to this project's ignored .env file."""

import sys
from pathlib import Path

from dotenv import set_key

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def store_password(password: str, env_file: Path = ENV_FILE) -> None:
    """Preserve every character; settings must load with interpolate=False."""
    if not password or any(character in password for character in "\r\n\0"):
        raise ValueError("Password must be nonempty and contain no CR, LF or NUL.")
    env_file.touch(mode=0o600, exist_ok=True)
    set_key(env_file, "AURORA_EMAIL_PASSWORD", password, quote_mode="always")


def main() -> int:
    if len(sys.argv) != 1:
        print("Пароль передаётся только через стандартный ввод.", file=sys.stderr)
        return 2
    try:
        store_password(sys.stdin.read())
    except (OSError, ValueError):
        print("Не удалось сохранить SMTP-пароль. Проверьте ввод и доступ к .env.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
