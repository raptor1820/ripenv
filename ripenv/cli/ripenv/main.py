from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import click
from click import Context
from dotenv import dotenv_values
from pydantic import ValidationError
from rich.console import Console

from . import crypto
from .keyfile import (
    DEFAULT_KEYFILE_NAME,
    create_keyfile,
    load_keyfile,
    save_keyfile,
    unlock_private_key,
)
from .manifest import MANIFEST_FILENAME, build_manifest, load_manifest, save_manifest
from .types import KeyFile, Manifest, ManifestRecipient, RecipientsExport

console = Console()
DEFAULT_ENV_NAME = ".env"
ENCRYPTED_ENV_NAME = ".env.enc"
HOME_KEY_DIR = Path.home() / ".ripenv"


def abort(message: str) -> None:
    raise click.ClickException(message)


def check_overwrite(path: Path, force: bool) -> None:
    if path.exists() and not force:
        abort(f"Refusing to overwrite existing file: {path}. Use --force to override.")


@click.group()
@click.version_option("0.1.0", prog_name="ripenv")
@click.pass_context
def app(ctx: Context) -> None:
    """ripenv CLI to encrypt and decrypt environment secrets locally."""
    ctx.ensure_object(dict)


@app.command()
@click.option("--filename", default=DEFAULT_KEYFILE_NAME, show_default=True, help="Output filename for the encrypted key.")
@click.option("--force", is_flag=True, help="Overwrite existing keyfiles if present.")
def init(filename: str, force: bool) -> None:
    """Generate an encrypted keyfile protected by a password."""
    password = click.prompt("Password", hide_input=True, confirmation_prompt=True)

    cwd_key_path = Path.cwd() / filename
    check_overwrite(cwd_key_path, force)
    home_key_path = HOME_KEY_DIR / filename
    check_overwrite(home_key_path, force)

    keyfile = create_keyfile(password, cwd_key_path)
    save_keyfile(keyfile, home_key_path)

    console.print(f":sparkles: Wrote encrypted keyfile to [bold]{cwd_key_path}[/bold] and [bold]{home_key_path}[/bold]")


@app.command()
@click.option("--env", "env_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / DEFAULT_ENV_NAME, show_default=True, help="Path to the plaintext .env file.")
@click.option("--recipients", "recipients_path", type=click.Path(path_type=Path, exists=True), required=True, help="Path to recipients.export.json from the web app.")
@click.option("--out", "out_dir", type=click.Path(path_type=Path), default=Path.cwd(), show_default=True, help="Directory to place encrypted outputs.")
@click.option("--force", is_flag=True, help="Overwrite existing encrypted outputs if present.")
def encrypt(env_path: Path, recipients_path: Path, out_dir: Path, force: bool) -> None:
    """Encrypt a .env file using project recipients."""
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    env_bytes = env_path.read_bytes()
    if not env_bytes:
        console.print("[yellow]Warning: .env file appears to be empty.[/yellow]")

    # Basic schema validation of the .env file to ensure it's parseable.
    dotenv_values(env_path)

    try:
        recipients = RecipientsExport.model_validate_json(recipients_path.read_text())
    except ValidationError as exc:
        abort(f"Invalid recipients export: {exc}")

    fk = os.urandom(crypto.KEY_LENGTH)
    payload = crypto.file_encrypt(fk, env_bytes)

    enc_path = out_dir / ENCRYPTED_ENV_NAME
    check_overwrite(enc_path, force)
    enc_path.write_bytes(payload)

    manifest = build_manifest(recipients.projectId, fk, recipients)
    manifest_path = save_manifest(manifest, out_dir)

    console.print(
        ":lock: Created encrypted secret file [bold]{enc}[/bold] and manifest [bold]{manifest}[/bold]".format(
            enc=enc_path, manifest=manifest_path
        )
    )


@app.command()
@click.option("--enc", "enc_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / ENCRYPTED_ENV_NAME, show_default=True, help="Path to the encrypted .env.enc file.")
@click.option("--manifest", "manifest_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / MANIFEST_FILENAME, show_default=True, help="Path to the ripenv.manifest.json file.")
@click.option("--email", required=True, help="Email address used in the recipients manifest.")
@click.option("--keyfile", "keyfile_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / DEFAULT_KEYFILE_NAME, show_default=True, help="Path to your encrypted keyfile.")
@click.option("--force", is_flag=True, help="Overwrite existing .env if present.")
def decrypt(enc_path: Path, manifest_path: Path, email: str, keyfile_path: Path, force: bool) -> None:
    """Decrypt an encrypted .env.enc file for the specified recipient."""
    password = click.prompt("Password", hide_input=True)

    try:
        keyfile = load_keyfile(keyfile_path)
    except ValidationError as exc:
        abort(f"Invalid keyfile: {exc}")

    try:
        private_key = unlock_private_key(password, keyfile)
    except ValueError as exc:
        abort(str(exc))

    try:
        manifest = load_manifest(manifest_path)
    except ValidationError as exc:
        abort(f"Invalid manifest: {exc}")

    recipient = next((r for r in manifest.recipients if r.email.lower() == email.lower()), None)
    if not recipient:
        abort(f"No manifest entry found for {email}.")

    wrapped_fk = crypto.b64d(recipient.wrappedKey)

    try:
        fk = crypto.sealedbox_unwrap(private_key, wrapped_fk)
    except Exception as exc:  # noqa: BLE001
        abort("Failed to unwrap file key; ensure you used the correct keyfile and password.")

    enc_payload = enc_path.read_bytes()
    try:
        plaintext = crypto.file_decrypt(fk, enc_payload)
    except Exception as exc:  # noqa: BLE001
        abort("Failed to decrypt .env.enc; the file may be corrupted or the key is incorrect.")

    out_path = enc_path.parent / DEFAULT_ENV_NAME
    check_overwrite(out_path, force)
    out_path.write_bytes(plaintext)

    console.print(f":unlock: Decrypted secrets written to [bold]{out_path}[/bold]")
