# ripenv

An end-to-end workflow for keeping `.env` secrets encrypted. The Python CLI performs all cryptography locally while the Next.js dashboard manages team membership and public keys.

## Threat Model

-   Plaintext `.env` files never leave your machine.
-   Private keys are generated client-side (browser or CLI) and are always stored encrypted with Argon2id + XSalsa20-Poly1305 SecretBox.
-   The web app only sees public keys and encrypted private keys.
-   File keys (FKs) are rotated per encryption run and wrapped individually for each recipient via X25519 SealedBox.

## Quickstart

1. Clone the repo and install dependencies for the web app:
    ```bash
    cd web
    pnpm install
    pnpm dev
    ```
2. Configure Supabase environment variables in `.env.local` (URL + anon key) and run the SQL schema from `web/README.md`.
3. Visit `http://localhost:3000/keys`, sign in via magic link, generate your keypair, upload it, and download `mykey.enc.json`.
4. Create a project on `/dashboard`, add members by email, and ensure each member uploads a public key on `/keys`.
5. Export the recipients list from `/projects/<id>` to download `recipients.export.json`.
6. Install the CLI in editable mode:
    ```bash
    cd ../cli
    pip install -e .
    ```
7. Optionally run `ripenv init` to mint an additional encrypted keyfile stored locally.
8. Encrypt your `.env` with recipients:
    ```bash
    ripenv encrypt --env .env --recipients recipients.export.json --out .
    ```
    Commit `.env.enc` and `ripenv.manifest.json` alongside your code. Teammates decrypt with:
    ```bash
    ripenv decrypt --enc .env.enc --manifest ripenv.manifest.json --email teammate@example.com --keyfile mykey.enc.json
    ```

## Rotating Secrets

Re-run `ripenv encrypt` whenever membership changes or you need to rotate the file key. This produces a fresh FK, regenerates `ripenv.manifest.json`, and leaves existing plaintext `.env` untouched.

## Folder Structure

-   `cli/` – Python CLI (Click + PyNaCl) with tests and packaging metadata.
-   `web/` – Next.js + Tailwind frontend wired to Supabase for auth, membership, and key storage.

## Limitations & Roadmap

-   No manifest signing yet; future work could add Ed25519 signatures to detect tampering.
-   CLI currently uses XSalsa20-Poly1305 via SecretBox; potential upgrade path to XChaCha20-Poly1305 when PyNaCl exposes it.
-   Browser key generation depends on WASM Argon2 (argon2-browser); mobile support may need tuning for memory usage.
-   CI/CD integration is out of scope; consider adding automated encryption checks before deployments.
