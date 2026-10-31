"""SMTP setup round trips use only temporary files and fake browser/mail commands."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from unittest import mock

from django.test import SimpleTestCase
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("store_smtp_secret", ROOT / "tools" / "store_smtp_secret.py")
STORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STORE)


class SmtpSecretStorageTests(SimpleTestCase):
    def test_password_round_trip_keeps_special_characters_and_spaces(self):
        password = "  p'a\\ss \"${HOME}\" `command` # знак  "
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / ".env"
            target.write_text("UNCHANGED='value'\n", encoding="utf-8")
            STORE.store_password(password, target)
            STORE.store_password(password, target)
            values = dotenv_values(target, interpolate=False)
            self.assertEqual(values["AURORA_EMAIL_PASSWORD"], password)
            self.assertEqual(values["UNCHANGED"], "value")
            self.assertEqual(target.read_text(encoding="utf-8").count("AURORA_EMAIL_PASSWORD="), 1)

    def test_invalid_password_does_not_create_a_file(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / ".env"
            for password in ("", "line\nbreak", "carriage\rreturn", "nul\0byte"):
                with self.subTest(password_type=repr(password[:4])):
                    with self.assertRaises(ValueError):
                        STORE.store_password(password, target)
            self.assertFalse(target.exists())

    def test_stdin_entrypoint_does_not_print_password(self):
        password = "fake-private-value"
        output = io.StringIO()
        with mock.patch.object(sys, "argv", ["store_smtp_secret.py"]), mock.patch.object(
            sys, "stdin", io.StringIO(password)
        ), mock.patch.object(STORE, "store_password") as save, contextlib.redirect_stdout(output):
            self.assertEqual(STORE.main(), 0)
        save.assert_called_once_with(password)
        self.assertEqual(output.getvalue(), "")


class SmtpWizardProfileTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        candidates = [
            Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe",
            Path(os.environ.get("LOCALAPPDATA", "C:/unused")) / "Programs/Git/bin/bash.exe",
        ]
        cls.bash = next((str(path) for path in candidates if path.is_file()), shutil.which("bash"))
        if not cls.bash:
            raise __import__("unittest").SkipTest("Bash is unavailable; no live email was sent.")

    def run_wizard(self, provider, send=False, recipient=""):
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder)
            tools = project / "tools"
            tools.mkdir()
            for name in ("setup-email.sh", "store_smtp_secret.py"):
                shutil.copyfile(ROOT / "tools" / name, tools / name)
            fake_bin = project / "fake-bin"
            fake_bin.mkdir()
            uv = fake_bin / "uv"
            uv.write_text(
                '#!/usr/bin/env bash\n'
                'if [[ "$1" != run || "$2" != python ]]; then exit 98; fi\n'
                'if [[ "$3" == tools/store_smtp_secret.py ]]; then\n'
                '  exec "$SMTP_TEST_PYTHON" "$3"\n'
                'fi\n'
                'if [[ "$3" == manage.py && "$4" == sendtestemail ]]; then\n'
                '  printf "%s\\n" "$@" > "$SMTP_TEST_CALL_LOG"\n'
                '  exit 0\n'
                'fi\n'
                'exit 99\n',
                encoding="utf-8",
                newline="\n",
            )
            uv.chmod(0o700)
            browser = fake_bin / "wslview"
            browser.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8", newline="\n")
            browser.chmod(0o700)
            log = project / "mail-command.txt"
            env = os.environ.copy()
            env.update(
                PATH=str(fake_bin) + os.pathsep + env.get("PATH", ""),
                SMTP_TEST_PYTHON=Path(sys.executable).as_posix(),
                SMTP_TEST_CALL_LOG=log.as_posix(),
                PYTHONDONTWRITEBYTECODE="1",
            )
            password = "  fake-пароль-p'a\\ss${HOME}`literal`  "
            answers = f"\n{provider}\n\nsender@example.test\n{password}\n{'y' if send else 'n'}\n"
            if send:
                answers += recipient + "\n"
            result = subprocess.run(
                [self.bash, "tools/setup-email.sh"], cwd=project, env=env,
                input=answers.encode("utf-8"), capture_output=True, timeout=30,
            )
            stdout = result.stdout.decode("utf-8")
            stderr = result.stderr.decode("utf-8")
            self.assertEqual(result.returncode, 0, stdout + stderr)
            self.assertNotIn(password, stdout + stderr)
            values = dotenv_values(project / ".env", interpolate=False)
            self.assertEqual(values["AURORA_EMAIL_PASSWORD"], password)
            return values, log.read_text(encoding="utf-8").splitlines() if log.exists() else []

    def test_each_provider_saves_a_working_ssl_profile_without_sending(self):
        for provider, host in ((1, "smtp.yandex.ru"), (2, "smtp.mail.ru"), (3, "smtp.rambler.ru")):
            with self.subTest(provider=provider):
                values, command = self.run_wizard(provider)
                self.assertEqual(values["AURORA_EMAIL_HOST"], host)
                self.assertEqual(int(values["AURORA_EMAIL_PORT"]), 465)
                self.assertEqual(int(values["AURORA_EMAIL_TIMEOUT"]), 15)
                self.assertEqual(values["AURORA_DEFAULT_FROM_EMAIL"], values["AURORA_EMAIL_USER"])
                self.assertEqual(command, [])

    def test_test_email_requires_yes_and_accepts_other_recipient_services(self):
        _, command = self.run_wizard(1, send=True, recipient="receiver@mail.ru")
        self.assertEqual(command, ["run", "python", "manage.py", "sendtestemail", "--", "receiver@mail.ru"])

    def test_test_email_defaults_to_sender(self):
        _, command = self.run_wizard(2, send=True)
        self.assertEqual(command[-1], "sender@example.test")
