from __future__ import annotations

import base64
from typing import Tuple

from argon2.low_level import Type, hash_secret_raw
from nacl.exceptions import CryptoError
from nacl.public import PrivateKey, PublicKey, SealedBox
from nacl.secret import SecretBox
from nacl.utils import random

SECRETBOX_NONCE_SIZE = SecretBox.NONCE_SIZE
KEY_LENGTH = SecretBox.KEY_SIZE


def generate_keypair() -> Tuple[bytes, bytes]:
    sk = PrivateKey.generate()
    pk = sk.public_key
    return bytes(sk), bytes(pk)


def argon2id_kek(password: str, salt: bytes) -> bytes:
    password_bytes = password.encode("utf-8")
    return hash_secret_raw(
        secret=password_bytes,
        salt=salt,
        time_cost=2,
        memory_cost=65536,
        parallelism=1,
        hash_len=KEY_LENGTH,
        type=Type.ID,
    )


def secretbox_encrypt(key: bytes, plaintext: bytes) -> bytes:
    if len(key) != KEY_LENGTH:
        raise ValueError("SecretBox key must be 32 bytes")
    nonce = random(SECRETBOX_NONCE_SIZE)
    box = SecretBox(key)
    encrypted = box.encrypt(plaintext, nonce)
    return nonce + encrypted.ciphertext


def secretbox_decrypt(key: bytes, payload: bytes) -> bytes:
    if len(key) != KEY_LENGTH:
        raise ValueError("SecretBox key must be 32 bytes")
    if len(payload) < SECRETBOX_NONCE_SIZE:
        raise ValueError("Payload too short to contain nonce")
    nonce = payload[:SECRETBOX_NONCE_SIZE]
    ciphertext = payload[SECRETBOX_NONCE_SIZE:]
    box = SecretBox(key)
    return box.decrypt(ciphertext, nonce)


def sealedbox_wrap(pk_bytes: bytes, data: bytes) -> bytes:
    pk = PublicKey(pk_bytes)
    return SealedBox(pk).encrypt(data)


def sealedbox_unwrap(sk: PrivateKey, data: bytes) -> bytes:
    return SealedBox(sk).decrypt(data)


file_encrypt = secretbox_encrypt
file_decrypt = secretbox_decrypt


def b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def b64d(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)
