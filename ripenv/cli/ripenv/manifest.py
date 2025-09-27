from __future__ import annotations

from pathlib import Path

from .crypto import b64d, b64e, sealedbox_wrap
from .types import Manifest, ManifestRecipient, RecipientsExport

MANIFEST_FILENAME = "ripenv.manifest.json"


def build_manifest(project_id: str, fk: bytes, recipients: RecipientsExport) -> Manifest:
    manifest_recipients = []
    for recipient in recipients.recipients:
        pk_bytes = b64d(recipient.publicKey)
        wrapped = sealedbox_wrap(pk_bytes, fk)
        manifest_recipients.append(
            ManifestRecipient(
                email=recipient.email,
                publicKey=recipient.publicKey,
                wrappedKey=b64e(wrapped),
            )
        )

    return Manifest(projectId=project_id, recipients=manifest_recipients)


def save_manifest(manifest: Manifest, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / MANIFEST_FILENAME
    manifest_path.write_text(manifest.model_dump_json(indent=2))
    return manifest_path


def load_manifest(path: Path) -> Manifest:
    return Manifest.model_validate_json(path.read_text())
