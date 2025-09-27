from __future__ import annotations

import os
from pathlib import Path

from nacl.exceptions import CryptoError
from nacl.public import PrivateKey

from .crypto import argon2id_kek, b64d, b64e, generate_keypair, secretbox_decrypt, secretbox_encrypt
from .types import KeyFile

DEFAULT_KEYFILE_NAME = "mykey.enc.json"


def create_keyfile(password: str, out_path: Path) -> KeyFile:
    sk_bytes, pk_bytes = generate_keypair()
    salt = os.urandom(16)
    kek = argon2id_kek(password, salt)
    enc_private = secretbox_encrypt(kek, sk_bytes)

    keyfile = KeyFile(
        publicKey=b64e(pk_bytes),
        encPrivateKey=b64e(enc_private),
        salt=b64e(salt),
        kdf="argon2id",
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(keyfile.model_dump_json(indent=2))
    return keyfile


def load_keyfile(path: Path) -> KeyFile:
    data = path.read_text()
    return KeyFile.model_validate_json(data)


def unlock_private_key(password: str, keyfile: KeyFile) -> PrivateKey:
    if keyfile.kdf != "argon2id":
        raise ValueError("Unsupported KDF in keyfile")

    salt = b64d(keyfile.salt)
    enc_private = b64d(keyfile.encPrivateKey)
    kek = argon2id_kek(password, salt)

    try:
        sk_bytes = secretbox_decrypt(kek, enc_private)
    except CryptoError as exc:
        raise ValueError("Unable to decrypt private key; check password and file integrity") from exc

    return PrivateKey(sk_bytes)


def save_keyfile(keyfile: KeyFile, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(keyfile.model_dump_json(indent=2))
