from __future__ import annotations

import json
from pathlib import Path

from click.testing import CliRunner

from ripenv.keyfile import create_keyfile
from ripenv.main import DEFAULT_ENV_NAME, ENCRYPTED_ENV_NAME, MANIFEST_FILENAME, app


def test_encrypt_decrypt_roundtrip(tmp_path: Path) -> None:
    password = "Sup3rSecret!"

    alice_keyfile = create_keyfile(password, tmp_path / "alice.enc.json")
    bob_keyfile = create_keyfile(password, tmp_path / "bob.enc.json")

    env_path = tmp_path / DEFAULT_ENV_NAME
    env_content = b"SECRET=value\nANOTHER_SECRET=123\n"
    env_path.write_bytes(env_content)

    recipients_payload = {
        "projectId": "project-123",
        "recipients": [
            {"email": "alice@example.com", "publicKey": alice_keyfile.publicKey},
            {"email": "bob@example.com", "publicKey": bob_keyfile.publicKey},
        ],
    }
    recipients_path = tmp_path / "recipients.export.json"
    recipients_path.write_text(json.dumps(recipients_payload))

    runner = CliRunner()

    encrypt_result = runner.invoke(
        app,
        [
            "encrypt",
            "--env",
            str(env_path),
            "--recipients",
            str(recipients_path),
            "--out",
            str(tmp_path),
            "--force",
        ],
    )
    assert encrypt_result.exit_code == 0, encrypt_result.output

    enc_path = tmp_path / ENCRYPTED_ENV_NAME
    manifest_path = tmp_path / MANIFEST_FILENAME
    assert enc_path.exists()
    assert manifest_path.exists()

    decrypt_result = runner.invoke(
        app,
        [
            "decrypt",
            "--enc",
            str(enc_path),
            "--manifest",
            str(manifest_path),
            "--email",
            "bob@example.com",
            "--keyfile",
            str(tmp_path / "bob.enc.json"),
            "--force",
        ],
        input=f"{password}\n",
    )
    assert decrypt_result.exit_code == 0, decrypt_result.output

    decrypted_path = tmp_path / DEFAULT_ENV_NAME
    assert decrypted_path.read_bytes() == env_content

    corrupted_payload = bytearray(enc_path.read_bytes())
    corrupted_payload[10] ^= 0xFF
    enc_path.write_bytes(bytes(corrupted_payload))

    failure_result = runner.invoke(
        app,
        [
            "decrypt",
            "--enc",
            str(enc_path),
            "--manifest",
            str(manifest_path),
            "--email",
            "bob@example.com",
            "--keyfile",
            str(tmp_path / "bob.enc.json"),
            "--force",
        ],
        input=f"{password}\n",
    )
    assert failure_result.exit_code != 0
    assert "Failed to decrypt" in failure_result.output
