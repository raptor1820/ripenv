# ripenv CLI

Local-first encryption tooling for ripenv projects. All cryptography is performed with [PyNaCl](https://pynacl.readthedocs.io/), and private keys never leave your machine unencrypted.

## Installation

```bash
pip install -e .
```

This exposes the `ripenv` console script.

## Commands

### `ripenv init`

Generates a fresh X25519 keypair, encrypts the private key with Argon2id + SecretBox, and stores the resulting `mykey.enc.json` in both the current working directory and `~/.ripenv/`.

```
ripenv init
```

Pass `--filename` to customise the output name and `--force` to overwrite existing files.

### `ripenv encrypt`

Encrypts a plaintext `.env` file for the project recipients exported from the web dashboard.

```
ripenv encrypt --env .env --recipients recipients.export.json --out .
```

Outputs:

-   `.env.enc`: binary file containing `nonce || ciphertext` encrypted with XSalsa20-Poly1305 SecretBox.
-   `ripenv.manifest.json`: metadata with wrapped file keys (FKs) for each project member.

Use `--force` to replace existing outputs.

### `ripenv decrypt`

Decrypts `.env.enc` using your password-protected keyfile.

```
ripenv decrypt --enc .env.enc --manifest ripenv.manifest.json --email you@example.com --keyfile mykey.enc.json
```

Specify `--force` to overwrite an existing `.env` file.

## Troubleshooting

-   **Bad password**: you'll see `Unable to decrypt private key; check password and file integrity`. Re-run with the correct password.
-   **Missing manifest entry**: ensure your email matches the manifest exactly (case-insensitive).
-   **Corrupt encrypted file**: if someone modified `.env.enc` or the manifest, decryption will fail. Re-request fresh artefacts from the project owner.

## Tests

```
pytest
```

The round-trip test exercises encryption, manifest generation, and decryption using in-memory recipients.
