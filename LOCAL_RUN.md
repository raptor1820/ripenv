# Running ripenv Locally

This guide walks through installing dependencies, configuring Supabase, and using both the Next.js dashboard and the Python CLI.

---

## 1. Prerequisites

-   **Node.js** 18 or newer and npm
-   **Python** 3.10+ with pip (a virtual environment is recommended)
-   A Supabase project with the required tables (`profiles`, `projects`, `project_members`) and policies applied
-   Access to the Supabase anon key and URL for the frontend

Directory layout reminder:

```
ripenv/
├── cli/          # Python package for the ripenv CLI
└── web/          # Next.js dashboard
```

---

## 2. Frontend Setup (Next.js Dashboard)

1. **Install dependencies**:

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\web
    npm install
    ```

2. **Configure environment variables**:

    Create `web/.env.local` with:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
    ```

3. **Run the development server**:

    ```pwsh
    npm run dev
    ```

    Visit the URL printed in the console (typically http://localhost:3000).

4. **Production build (optional)**:

    ```pwsh
    npm run build
    npm run start
    ```

---

## 3. Backend Setup (Supabase)

1. Apply the SQL migrations that create the `profiles`, `projects`, and `project_members` tables and the associated RLS policies.
2. Ensure email magic link auth is enabled so users can sign in through the dashboard.
3. Each user should sign in at least once so a row appears in `profiles`.

> If you need to recreate the policies, refer to the SQL scripts previously shared in the project documentation.

---

## 4. CLI Setup (Python)

1. **Install dependencies**:

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\cli
    pip install -e .
    ```

    This installs the CLI in editable mode so local changes take effect immediately.

2. **Run tests (optional but recommended)**:

    ```pwsh
    pytest
    ```

3. **Check the CLI is available**:

    ```pwsh
    ripenv --help
    ```

---

## 5. Typical Frontend Workflow

1. Launch the dev server (`npm run dev`).
2. Sign in via magic link.
3. Create a project on `/dashboard`.
4. Invite members (email addresses) on `/projects/<id>`.
5. Each member visits `/keys` to generate a keypair:
    - Downloads `mykey.enc.json` (encrypted private key)
    - Supabase now stores their public key
6. Project owner exports `recipients.export.json` from `/projects/<id>` for CLI use.

---

## 6. Encrypting an Environment File

1.  Prepare the plaintext env file, e.g., `deploy/.env.production`.
2.  Use the CLI to produce the encrypted env (`.env.enc`) and companion manifest (`ripenv.manifest.json`):

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\cli
    ripenv encrypt \`
        --env ..\deploy\.env.production \`
        --recipients ..\web\recipients.export.json \`
        --out ..\deploy
    ```

    Optional flags:

    -   `--force` overwrites existing `.env.enc` / `ripenv.manifest.json` in the output directory.
    -   Omit `--out` to drop the files in the current directory.

    The encrypted env uses a fresh symmetric key, and the manifest stores that key encrypted for each recipient.

---

## 7. Decrypting an Environment File

1.  Recipient needs their encrypted keyfile (from `/keys`) stored locally.
2.  Run the decrypt command, supplying the encrypted env, manifest, email, and keyfile path:

    ```pwsh
    ripenv decrypt \`
        --enc ..\deploy\.env.enc \`
        --manifest ..\deploy\ripenv.manifest.json \`
        --email teammate@example.com \`
        --keyfile C:\path\to\mykey.enc.json
    ```

    The CLI prompts for the password set on `/keys`, unwraps the manifest entry for that email, and writes a restored `.env` next to `.env.enc` (use `--force` to overwrite an existing file).

3.  Source or copy the regenerated `.env` into your tooling, then delete it when finished.

---

## 8. Integration Flow Summary

-   The **Next.js app** manages projects, members, and key generation (client-side with WebCrypto).
-   **Supabase** stores public keys, encrypted private keys, and project membership.
-   The **CLI** consumes exported recipient lists to encrypt env files and allows members to decrypt them (`ripenv encrypt` / `ripenv decrypt`).
-   CI/CD can run `ripenv encrypt` to publish updated env manifests whenever secrets change.

---

## 9. Troubleshooting Tips

-   Ensure Supabase env vars are present before starting the web app; missing values will throw an error during import.
-   If `npm run build` fails, check the console output for lint or type errors.
-   For CLI issues, re-run `pip install -e .` to make sure dependencies are installed, and use `ripenv --help` to inspect available commands.
-   Make sure each invited member has a `profiles` row; if not, have them sign in once or insert manually.

---

You now have the full workflow to run the dashboard and CLI locally, manage encrypted env files, and collaborate securely with your team.
