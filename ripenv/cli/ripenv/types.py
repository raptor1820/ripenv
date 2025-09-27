from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class KeyFile(BaseModel):
    publicKey: str = Field(..., min_length=1)
    encPrivateKey: str = Field(..., min_length=1)
    salt: str = Field(..., min_length=1)
    kdf: Literal["argon2id"]


class Recipient(BaseModel):
    email: EmailStr
    publicKey: str = Field(..., min_length=1)


class RecipientsExport(BaseModel):
    projectId: str = Field(..., min_length=1)
    recipients: List[Recipient]

    @field_validator("recipients")
    @classmethod
    def ensure_unique_emails(cls, value: List[Recipient]) -> List[Recipient]:
        emails = {r.email for r in value}
        if len(emails) != len(value):
            raise ValueError("Duplicate recipient emails detected")
        return value


class ManifestRecipient(BaseModel):
    email: EmailStr
    publicKey: str = Field(..., min_length=1)
    wrappedKey: str = Field(..., min_length=1)


class Manifest(BaseModel):
    version: Literal[1] = 1
    projectId: str = Field(..., min_length=1)
    algo: Literal["xsalsa20poly1305"] = "xsalsa20poly1305"
    recipients: List[ManifestRecipient]

    @field_validator("recipients")
    @classmethod
    def ensure_recipients_not_empty(cls, value: List[ManifestRecipient]) -> List[ManifestRecipient]:
        if not value:
            raise ValueError("Manifest must contain at least one recipient")
        emails = {r.email for r in value}
        if len(emails) != len(value):
            raise ValueError("Duplicate manifest recipient emails detected")
        return value
